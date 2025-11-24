// Gemini Image Revision - Button Trigger (Single Record)

let cfg = input.config({
    title: "🔄 Revise Image",
    description: "Button-triggered single record revision",
    items: [
        input.config.text("apiKey", {
            label: "Gemini API Key"
        }),
        input.config.select("model", {
            label: "Model",
            options: [
                { label: "Pro (High Quality)", value: "gemini-3-pro-image-preview" },
                { label: "Flash (Fast)", value: "gemini-2.5-flash-image" }
            ]
        }),
        input.config.select("res", {
            label: "Resolution (Pro only)",
            options: [
                { label: "1K", value: "1K" },
                { label: "2K", value: "2K" },
                { label: "4K", value: "4K" }
            ]
        }),
        input.config.table("tbl", { 
            label: "Table" 
        }),
        input.config.field("imgF", {
            parentTable: "tbl",
            label: "Image Field"
        }),
        input.config.field("feedbackF", {
            parentTable: "tbl",
            label: "Feedback Field"
        }),
        input.config.field("styleF", {
            parentTable: "tbl",
            label: "Style Reference (opt)"
        }),
        input.config.field("b64F", {
            parentTable: "tbl",
            label: "Base64 Field (opt)"
        }),
        input.config.text("cloudName", {
            label: "Cloudinary Name"
        }),
        input.config.text("uploadPreset", {
            label: "Upload Preset"
        })
    ]
});

let {apiKey, model, res, tbl, imgF, feedbackF, styleF, b64F, cloudName, uploadPreset} = cfg;

// Defaults
model = model || 'gemini-3-pro-image-preview';
res = res || '1K';

// Validate
if (!apiKey?.startsWith('AIza')) throw new Error('Invalid API key');

const hasCloudinary = cloudName && uploadPreset;

// ============ HELPERS ============

function getBase64SizeMB(base64) {
    return (base64.length * 0.75) / 1048576;
}

async function resizeIfNeeded(base64, maxMB = 1.5) {
    const sizeMB = getBase64SizeMB(base64);
    if (sizeMB > maxMB) {
        output.text(`📉 Resizing ${sizeMB.toFixed(1)}MB → ${maxMB}MB`);
        return base64.substring(0, Math.floor(base64.length * (maxMB / sizeMB)));
    }
    return base64;
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let base64 = '';
    
    for (let i = 0; i < bytes.length; i += 3) {
        const byte1 = bytes[i];
        const byte2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
        const byte3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
        
        const encoded1 = byte1 >> 2;
        const encoded2 = ((byte1 & 3) << 4) | (byte2 >> 4);
        const encoded3 = ((byte2 & 15) << 2) | (byte3 >> 6);
        const encoded4 = byte3 & 63;
        
        base64 += base64Chars[encoded1] + base64Chars[encoded2];
        base64 += i + 1 < bytes.length ? base64Chars[encoded3] : '=';
        base64 += i + 2 < bytes.length ? base64Chars[encoded4] : '=';
    }
    
    return base64;
}

async function urlToB64(url) {
    const resp = await remoteFetchAsync(url);
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
    const arrayBuffer = await resp.arrayBuffer();
    return arrayBufferToBase64(arrayBuffer);
}

async function uploadToCloudinary(base64Image) {
    if (!hasCloudinary) return null;
    
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    
    const formParams = new URLSearchParams();
    formParams.append('file', `data:image/png;base64,${base64Image}`);
    formParams.append('upload_preset', uploadPreset);
    
    const resp = await remoteFetchAsync(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formParams.toString()
    });
    
    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Cloudinary ${resp.status}: ${err.substring(0, 200)}`);
    }
    
    const result = await resp.json();
    return result.secure_url || result.url;
}

async function reviseImage(imgB64, feedback, styleB64) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    imgB64 = await resizeIfNeeded(imgB64);
    if (styleB64) styleB64 = await resizeIfNeeded(styleB64);
    
    const parts = [];
    
    if (styleB64) {
        parts.push({ inline_data: { mime_type: "image/jpeg", data: styleB64 } });
    }
    
    parts.push({ inline_data: { mime_type: "image/jpeg", data: imgB64 } });
    
    parts.push({
        text: `You are an expert 2D vector illustrator. 
        
${styleB64 ? 'Image 1 is the style reference to maintain. Image 2 is the current image to revise.' : 'This is the current image to revise.'}

**Revision Request:**
${feedback}

**Instructions:**
- Apply the requested changes while maintaining the overall style and quality
- Keep the same aspect ratio as the input image
- Maintain clean vector art aesthetic
- Only change what is specifically requested
- Output the revised image`
    });
    
    const body = {
        contents: [{ parts }],
        generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 1,
            candidateCount: 1,
            responseModalities: ["TEXT", "IMAGE"]
        }
    };
    
    if (model.includes('pro')) {
        body.generationConfig.imageConfig = { imageSize: res };
    }
    
    const resp = await remoteFetchAsync(url, {
        method: 'POST',
        headers: {
            'x-goog-api-key': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    
    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`API ${resp.status}: ${err.substring(0, 100)}`);
    }
    
    const data = await resp.json();
    
    if (data.candidates?.[0]?.content) {
        for (const p of data.candidates[0].content.parts) {
            if (p.inlineData?.data) {
                return p.inlineData.data;
            }
        }
    }
    
    throw new Error('No image in response');
}

// ============ MAIN ============

async function main() {
    // Prompt user to select record (works great with button trigger)
    let rec = await input.recordAsync('Select record to revise:', tbl);
    
    if (!rec) {
        output.text('❌ Cancelled');
        return;
    }
    
    output.markdown(`# 🔄 Revising: ${rec.name || rec.id}`);
    
    // Get field values
    const images = rec.getCellValue(imgF);
    const feedback = rec.getCellValueAsString(feedbackF);
    const style = styleF ? rec.getCellValue(styleF) : null;
    
    // Validate
    if (!images?.length) {
        output.text('❌ No images to revise');
        return;
    }
    
    if (!feedback?.trim()) {
        output.text('❌ No feedback provided - add revision instructions first');
        return;
    }
    
    // Get latest image (first in array since we prepend)
    const latestImg = images[0];
    const iterationNum = images.length + 1;
    
    output.text(`📷 Source: ${latestImg.filename || 'current image'}`);
    output.text(`📝 Feedback: ${feedback.substring(0, 100)}${feedback.length > 100 ? '...' : ''}`);
    output.text(`🔄 Creating revision #${iterationNum}...`);
    
    try {
        // Convert images to base64
        output.text('⏳ Loading images...');
        const imgB64 = await urlToB64(latestImg.url);
        const styleB64 = style?.length ? await urlToB64(style[0].url) : null;
        
        // Generate revision
        output.text(`🤖 Generating with ${model.includes('pro') ? 'Pro' : 'Flash'}...`);
        const revisedB64 = await reviseImage(imgB64, feedback, styleB64);
        
        output.text('✅ Image revised!');
        output.text(`📊 Size: ${getBase64SizeMB(revisedB64).toFixed(2)}MB`);
        
        // Save base64 if field configured
        if (b64F) {
            const maxLen = 95000;
            const data = revisedB64.length > maxLen 
                ? revisedB64.substring(0, maxLen) + '...[truncated]'
                : revisedB64;
            
            await tbl.updateRecordAsync(rec.id, {
                [b64F.name]: `data:image/png;base64,${data}`
            });
            output.text('💾 Base64 saved');
        }
        
        // Upload to Cloudinary and update attachment
        if (hasCloudinary) {
            output.text('☁️ Uploading to Cloudinary...');
            const cloudUrl = await uploadToCloudinary(revisedB64);
            
            if (cloudUrl) {
                const existing = images || [];
                const newAttachment = {
                    url: cloudUrl,
                    filename: `revision_${iterationNum}_${Date.now()}.png`
                };
                
                // Prepend (newest first)
                await tbl.updateRecordAsync(rec.id, {
                    [imgF.name]: [newAttachment, ...existing]
                });
                
                output.text('📎 Attached to record');
            }
        } else {
            output.text('⚠️ Cloudinary not configured - image not saved as attachment');
        }
        
        output.markdown(`
---
## ✅ Done!
**Revision #${iterationNum}** created successfully.

### Next Steps
1. Review the new image (first in attachment field)
2. Update feedback with new instructions
3. Click the button again to iterate
        `);
        
    } catch (e) {
        output.markdown(`
---
## ❌ Error
${e.message}

Please check your configuration and try again.
        `);
    }
}

await main();
