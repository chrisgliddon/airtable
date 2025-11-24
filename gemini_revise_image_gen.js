// Gemini Image Revision with Feedback

let cfg = input.config({
    title: "🔄 Gemini Image Revision",
    description: "Revise images via Gemini AI using feedback",
    items: [
        input.config.text("apiKey", {
            label: "Gemini API Key",
            description: "Gemini key (AIza...)"
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
        input.config.view("view", {
            parentTable: "tbl",
            label: "View"
        }),
        input.config.field("imgF", {
            parentTable: "tbl",
            label: "Image Field",
            description: "Attachment field with generated images (reads last, appends new)"
        }),
        input.config.field("feedbackF", {
            parentTable: "tbl",
            label: "Feedback Field",
            description: "Long text field with revision instructions"
        }),
        input.config.field("styleF", {
            parentTable: "tbl",
            label: "Style Reference (opt)",
            description: "Optional: maintain style consistency"
        }),
        input.config.field("b64F", {
            parentTable: "tbl",
            label: "Base64 Field (opt)"
        }),
        input.config.text("cloudName", {
            label: "Cloudinary Name"
        }),
        input.config.text("uploadPreset", {
            label: "Upload Preset",
            description: "Unsigned preset with folder configured"
        }),
        input.config.select("mode", {
            label: "Mode",
            options: [
                { label: "Single Record", value: "single" },
                { label: "All with Feedback", value: "all" }
            ]
        })
    ]
});

let {apiKey, model, res, tbl, view, imgF, feedbackF, styleF, b64F, cloudName, uploadPreset, mode} = cfg;

// Defaults
model = model || 'gemini-3-pro-image-preview';
res = res || '1K';

// Validate
if (!apiKey?.startsWith('AIza')) throw new Error('Invalid API key');

const hasCloudinary = cloudName && uploadPreset;
if (hasCloudinary) {
    output.text(`☁️ Cloudinary: ${cloudName} / ${uploadPreset}`);
} else {
    output.text('⚠️ Cloudinary not configured - needed for attachments');
}

// Helper: Get file size in MB
function getBase64SizeMB(base64) {
    return (base64.length * 0.75) / 1048576;
}

// Helper: Resize base64 if needed
async function resizeIfNeeded(base64, maxMB = 1.5) {
    const sizeMB = getBase64SizeMB(base64);
    if (sizeMB > maxMB) {
        output.text(`📉 Resize ${sizeMB.toFixed(1)}MB → ${maxMB}MB`);
        return base64.substring(0, Math.floor(base64.length * (maxMB / sizeMB)));
    }
    return base64;
}

// Manual base64 encoding
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

// Convert URL to base64
async function urlToB64(url) {
    try {
        const resp = await remoteFetchAsync(url);
        if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
        const arrayBuffer = await resp.arrayBuffer();
        return arrayBufferToBase64(arrayBuffer);
    } catch (e) {
        output.text(`❌ ${e.message}`);
        throw e;
    }
}

// Cloudinary Upload
async function uploadToCloudinary(base64Image, recordId) {
    if (!hasCloudinary) return null;
    
    try {
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
        output.text(`☁️ Uploaded: ${result.public_id}`);
        return result.secure_url || result.url;
        
    } catch (e) {
        output.text(`❌ Cloudinary: ${e.message}`);
        return null;
    }
}

// Call Gemini for revision
async function reviseImage(imgB64, feedback, styleB64) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    output.text(`🤖 ${model.includes('pro') ? 'Pro' : 'Flash'}`);
    output.text(`📝 Feedback: ${feedback.substring(0, 80)}...`);
    
    imgB64 = await resizeIfNeeded(imgB64);
    if (styleB64) styleB64 = await resizeIfNeeded(styleB64);
    
    const parts = [];
    
    // Add style reference first if provided
    if (styleB64) {
        parts.push({
            inline_data: { mime_type: "image/jpeg", data: styleB64 }
        });
    }
    
    // Add current image to revise
    parts.push({
        inline_data: { mime_type: "image/jpeg", data: imgB64 }
    });
    
    // Add revision prompt
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
    
    try {
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
                    output.text('✅ Revised');
                    output.text(`📊 Size: ${getBase64SizeMB(p.inlineData.data).toFixed(2)}MB`);
                    return p.inlineData.data;
                }
            }
        }
        
        throw new Error('No image in response');
        
    } catch (e) {
        output.text(`❌ ${e.message}`);
        throw e;
    }
}

// Save base64
async function saveB64(recId, b64) {
    if (!b64F) return false;
    
    try {
        const maxLen = 95000;
        const data = b64.length > maxLen 
            ? b64.substring(0, maxLen) + '...[truncated]'
            : b64;
        
        await tbl.updateRecordAsync(recId, {
            [b64F.name]: `data:image/png;base64,${data}`
        });
        
        output.text(`💾 Base64 saved`);
        return true;
    } catch (e) {
        output.text(`❌ Base64: ${e.message}`);
        return false;
    }
}

// Append attachment to existing field
async function appendAttachment(recId, imageUrl, iterationNum) {
    if (!imgF || !imageUrl) return false;
    
    try {
        const record = await tbl.selectRecordAsync(recId);
        const existing = record?.getCellValue(imgF) || [];
        
        const newAttachment = {
            url: imageUrl,
            filename: `revision_${iterationNum}_${Date.now()}.png`
        };
        
        await tbl.updateRecordAsync(recId, {
            [imgF.name]: [...existing, newAttachment]
        });
        
        output.text(`📎 Appended as revision #${iterationNum}`);
        return true;
    } catch (e) {
        output.text(`❌ Attachment: ${e.message}`);
        return false;
    }
}

// Delay helper
function delay(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) {}
}

// Process record
async function processRec(rec) {
    output.text(`\n📋 ${rec.name || rec.id}`);
    
    try {
        const images = rec.getCellValue(imgF);
        const feedback = rec.getCellValueAsString(feedbackF);
        const style = styleF ? rec.getCellValue(styleF) : null;
        
        if (!images?.length) {
            output.text(`⚠️ No images in field - need at least one to revise`);
            return false;
        }
        
        if (!feedback?.trim()) {
            output.text(`⚠️ No feedback provided`);
            return false;
        }
        
        // Get the LAST image (most recent)
        const lastImg = images[images.length - 1];
        const iterationNum = images.length + 1;
        
        output.text(`🔄 Revising image ${images.length} → ${iterationNum}`);
        output.text(`📷 Source: ${lastImg.filename || 'attachment'}`);
        
        const imgB64 = await urlToB64(lastImg.url);
        const styleB64 = style?.length ? await urlToB64(style[0].url) : null;
        
        const revisedB64 = await reviseImage(imgB64, feedback, styleB64);
        
        let success = false;
        
        if (b64F) {
            success = await saveB64(rec.id, revisedB64) || success;
        }
        
        if (hasCloudinary) {
            const cloudUrl = await uploadToCloudinary(revisedB64, rec.id);
            if (cloudUrl) {
                success = await appendAttachment(rec.id, cloudUrl, iterationNum) || success;
            }
        }
        
        return success;
        
    } catch (e) {
        output.text(`❌ ${e.message}`);
        return false;
    }
}

// Main
async function main() {
    output.markdown(`# 🔄 Image Revision
**Model:** ${model.includes('pro') ? 'Pro' : 'Flash'}  
**Resolution:** ${model.includes('pro') ? res : '1K'}  
**Mode:** ${mode}  
**Style Lock:** ${styleF ? '✅' : '❌'}
    `);
    
    let recs = [];
    let ok = 0, fail = 0;
    
    if (mode === 'single') {
        const r = await input.recordAsync('Select record to revise:', tbl);
        if (!r) {
            output.text('Cancelled');
            return;
        }
        recs = [r];
    } else {
        const fields = [imgF, feedbackF];
        if (styleF) fields.push(styleF);
        
        const q = await view.selectRecordsAsync({ fields });
        
        // Filter to records with both images AND feedback
        recs = Array.from(q.records).filter(r => {
            const hasImg = r.getCellValue(imgF)?.length > 0;
            const hasFeedback = r.getCellValueAsString(feedbackF)?.trim();
            return hasImg && hasFeedback;
        });
        
        output.text(`Found ${recs.length} records with images + feedback`);
    }
    
    for (let i = 0; i < recs.length; i++) {
        output.text(`\n--- ${i+1}/${recs.length} ---`);
        
        if (await processRec(recs[i])) ok++;
        else fail++;
        
        if (i < recs.length - 1) {
            const delayMs = model.includes('pro') ? 3000 : 2000;
            output.text(`⏳ ${delayMs/1000}s...`);
            delay(delayMs);
        }
    }
    
    output.markdown(`
## Done
✅ **Revised:** ${ok}  
❌ **Failed:** ${fail}

### 💡 Workflow Tip
1. Review the new image appended to the attachment field
2. Update the feedback field with new instructions
3. Run this script again to iterate
4. Each revision builds on the previous one
    `);
}

await main();
