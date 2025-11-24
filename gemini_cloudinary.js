// Gemini Image Gen with Cloudinary

let cfg = input.config({
    title: "🎨 Gemini + Cloudinary Image Gen",
    description: "Generate images via Gemini AI and save to Cloudinary",
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
        input.config.select("ratio", {
            label: "Aspect",
            options: [
                { label: "Auto", value: "auto" },
                { label: "1:1", value: "1:1" },
                { label: "9:16", value: "9:16" },
                { label: "16:9", value: "16:9" },
                { label: "3:4", value: "3:4" },
                { label: "4:3", value: "4:3" }
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
        input.config.field("styleF", {
            parentTable: "tbl",
            label: "Style Image"
        }),
        input.config.field("refF", {
            parentTable: "tbl",
            label: "Ref Images (opt)"
        }),
        input.config.field("promptF", {
            parentTable: "tbl",
            label: "Prompt"
        }),
        input.config.field("outF", {
            parentTable: "tbl",
            label: "Output Attachment"
        }),
        input.config.field("b64F", {
            parentTable: "tbl",
            label: "Base64 Field (opt)"
        }),
        input.config.text("cloudName", {
            label: "Cloudinary Name",
            description: "Your cloud name"
        }),
        input.config.text("uploadPreset", {
            label: "Upload Preset",
            description: "Unsigned preset (must have folder: airtable_generations)"
        }),
        input.config.select("mode", {
            label: "Mode",
            options: [
                { label: "Single", value: "single" },
                { label: "All", value: "all" },
                { label: "Missing", value: "missing" }
            ]
        }),
        input.config.view("view", {
            parentTable: "tbl",
            label: "View"
        })
    ]
});

// Extract config
let {apiKey, model, ratio, res, tbl, styleF, refF, promptF, outF, b64F, cloudName, uploadPreset, mode, view} = cfg;

// Defaults
model = model || 'gemini-3-pro-image-preview';
ratio = ratio || '1:1';
res = res || '1K';

// Validate
if (!apiKey?.startsWith('AIza')) throw new Error('Invalid API key');

// Check Cloudinary config
const hasCloudinary = cloudName && uploadPreset;
if (hasCloudinary) {
    output.text(`☁️ Cloudinary: ${cloudName} / ${uploadPreset}`);
    output.text(`📁 Uploads will go to: airtable_generations/`);
} else {
    output.text('⚠️ Cloudinary not configured');
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

// Manual base64 encoding (btoa replacement)
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
        const base64 = arrayBufferToBase64(arrayBuffer);
        
        return base64;
        
    } catch (e) {
        output.text(`❌ ${e.message}`);
        throw e;
    }
}

// SIMPLIFIED Cloudinary Upload - ONLY IMAGE & PRESET
async function uploadToCloudinary(base64Image, recordId) {
    if (!hasCloudinary) return null;
    
    try {
        const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
        
        // ABSOLUTE MINIMUM - Only file and preset
        const formParams = new URLSearchParams();
        formParams.append('file', `data:image/png;base64,${base64Image}`);
        formParams.append('upload_preset', uploadPreset);
        // NO TAGS, NO FOLDER, NO PUBLIC_ID - Let preset handle everything
        
        const resp = await remoteFetchAsync(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
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
        
        // Detailed setup instructions
        output.markdown(`
### 🔧 Cloudinary Setup Required

**Your preset "${uploadPreset}" must be configured correctly:**

1. Go to Cloudinary Dashboard → **Settings** (gear icon)
2. Click **Upload** tab
3. Scroll to **Upload presets**
4. Find your preset: **${uploadPreset}**
5. Click **Edit**

**Critical Settings:**
- ✅ **Signing Mode**: Must be "Unsigned"
- ✅ **Folder**: Enter \`airtable_generations\`
- ✅ **Unique filename**: Check this box
- ✅ **Use filename or externally defined Public ID**: OFF

6. Click **Save**
        `);
        
        return null;
    }
}

// Call Gemini API - PROMPT FROM AIRTABLE FIELD
async function genImage(styleB64, refB64, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    output.text(`🤖 ${model.includes('pro') ? 'Pro' : 'Flash'} @ ${ratio}${model.includes('pro') ? ' ' + res : ''}`);
    output.text(`📝 Prompt: ${prompt.substring(0, 50)}...`);
    
    // Resize images before sending
    styleB64 = await resizeIfNeeded(styleB64);
    if (refB64) refB64 = await resizeIfNeeded(refB64);
    
    const body = {
        contents: [{
            parts: [
                {
                    inline_data: {
                        mime_type: "image/jpeg",
                        data: styleB64
                    }
                },
                ...(refB64 ? [{
                    inline_data: {
                        mime_type: "image/jpeg",
                        data: refB64
                    }
                }] : []),
                {
                    text: `Expert 2D illustrator task:
                    Input 1: Base style to maintain
                    ${refB64 ? 'Input 2: Reference for details' : ''}
                    
                    ${prompt}
                    
                    ${ratio !== 'auto' ? `Use ${ratio} aspect ratio.` : ''}
                    Maintain base style exactly. Clean vector art.`
                }
            ]
        }],
        generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 1,
            candidateCount: 1,
            responseModalities: ["TEXT", "IMAGE"]
        }
    };
    
    // Add Pro config
    if (model.includes('pro')) {
        const imgCfg = { imageSize: res };
        if (ratio !== 'auto') imgCfg.aspectRatio = ratio;
        body.generationConfig.imageConfig = imgCfg;
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
            const parts = data.candidates[0].content.parts;
            for (const p of parts) {
                if (p.inlineData?.data) {
                    output.text('✅ Generated');
                    
                    const sizeMB = getBase64SizeMB(p.inlineData.data);
                    output.text(`📊 Size: ${sizeMB.toFixed(2)}MB`);
                    
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
        
        output.text(`💾 Base64 saved (${(data.length/1000).toFixed(0)}KB)`);
        return true;
    } catch (e) {
        output.text(`❌ Base64: ${e.message}`);
        return false;
    }
}

// Update attachment field with URL
async function updateAttachment(recId, imageUrl) {
    if (!outF || !imageUrl) return false;
    
    try {
        const record = await tbl.selectRecordAsync(recId);
        const existing = record?.getCellValue(outF) || [];
        
        // Simple filename with timestamp only
        const newAttachment = {
            url: imageUrl,
            filename: `gemini_${Date.now()}.png`
        };
        
        const attachments = [...existing, newAttachment];
        
        await tbl.updateRecordAsync(recId, {
            [outF.name]: attachments
        });
        
        output.text('📎 Attached to record');
        return true;
    } catch (e) {
        output.text(`❌ Attachment: ${e.message}`);
        return false;
    }
}

// Helper for delay
function delay(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) {
        // Busy wait
    }
}

// Process record - GETS PROMPT FROM AIRTABLE
async function processRec(rec) {
    output.text(`\n📋 ${rec.name || rec.id}`);
    
    try {
        const style = rec.getCellValue(styleF);
        const ref = refF ? rec.getCellValue(refF) : null;
        const prompt = rec.getCellValue(promptF); // FROM AIRTABLE FIELD
        
        if (!style?.length) {
            output.text(`⚠️ No style image`);
            return false;
        }
        
        if (!prompt) {
            output.text(`⚠️ No prompt in field`);
            return false;
        }
        
        output.text('🔄 Converting images...');
        const styleB64 = await urlToB64(style[0].url);
        const refB64 = ref?.length ? await urlToB64(ref[0].url) : null;
        
        const genB64 = await genImage(styleB64, refB64, prompt);
        
        let success = false;
        
        if (b64F) {
            success = await saveB64(rec.id, genB64) || success;
        }
        
        if (hasCloudinary && outF) {
            const cloudUrl = await uploadToCloudinary(genB64, rec.id);
            if (cloudUrl) {
                success = await updateAttachment(rec.id, cloudUrl) || success;
            } else {
                output.text('⚠️ No Cloudinary URL - attachment skipped');
            }
        } else if (outF && !hasCloudinary) {
            output.text('⚠️ Need Cloudinary for attachments');
        }
        
        return success;
        
    } catch (e) {
        output.text(`❌ ${e.message}`);
        return false;
    }
}

// Main
async function main() {
    output.markdown(`# Image Gen
**Model:** ${model.includes('pro') ? 'Pro' : 'Flash'}  
**Aspect:** ${ratio}  
**Res:** ${model.includes('pro') ? res : '1K'}  
**Mode:** ${mode}  
**Storage:** ${hasCloudinary ? '☁️ Cloudinary' : ''} ${b64F ? '💾 Base64' : ''} ${outF ? '📎 Attachments' : ''}
    `);
    
    let recs = [];
    let ok = 0, fail = 0;
    
    if (mode === 'single') {
        const r = await input.recordAsync('Select record:', tbl);
        if (!r) {
            output.text('Cancelled');
            return;
        }
        recs = [r];
    } else {
        const q = await view.selectRecordsAsync({
            fields: [styleF, promptF, outF].concat(refF ? [refF] : [])
        });
        
        if (mode === 'missing') {
            const allRecs = Array.from(q.records);
            recs = allRecs.filter(r => {
                const out = r.getCellValue(outF);
                return !out?.length;
            });
        } else {
            recs = Array.from(q.records);
        }
        
        output.text(`Found ${recs.length} records`);
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
✅ **Success:** ${ok}  
❌ **Failed:** ${fail}  
📊 **Total:** ${recs.length}

### Storage Config
${hasCloudinary ? `☁️ **Cloudinary:** ${cloudName}` : '⚠️ No Cloudinary'}  
${b64F ? `💾 **Base64:** ${b64F.name}` : ''}  
${outF ? `📎 **Attachments:** ${outF.name}` : ''}
    `);
}

await main();
