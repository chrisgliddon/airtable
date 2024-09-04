let settings = input.config({
    title: "Summarize Text Attachment with OpenAI",
    description: "This script reads a .txt file from an attachment field, sends the text to OpenAI for summarization, and stores the summary.",
    items: [
        input.config.field("attachmentField", {
            label: "📎 Attachment Field",
            description: "Select the field where the .txt attachment is stored",
            parentTable: "table"
        }),
        input.config.field("summaryField", {
            label: "📝 Summary Field",
            description: "Select the field where the summary will be stored",
            parentTable: "table"
        }),
        input.config.text("openAiApiKey", {
            label: "🔑 OpenAI API Key",
            description: "Enter your OpenAI API key"
        }),
        input.config.text("prompt", {
            label: "💬 Custom Prompt",
            description: "Enter the custom prompt for summarization (e.g., 'Summarize the following text:')",
            default: "Summarize the following text:"
        }),
        input.config.select("model", {
            label: "🤖 OpenAI Model",
            description: "Choose the OpenAI model",
            options: [
                { label: "GPT-3.5", value: "gpt-3.5-turbo" },
                { label: "GPT-4", value: "gpt-4" }
            ]
        }),
        input.config.table("table", {
            label: "📄 Table",
            description: "Select the table that contains the records"
        })
    ]
});

let { attachmentField, summaryField, openAiApiKey, prompt, model, table } = settings;

async function main() {
    // Fetch records from the table
    let records = await table.selectRecordsAsync();
    
    for (let record of records.records) {
        let attachment = record.getCellValue(attachmentField);

        if (attachment && attachment.length > 0) {
            // Get the first attachment URL
            let fileUrl = attachment[0].url;
            
            // Fetch the .txt file contents
            let response = await fetch(fileUrl);
            let textContent = await response.text();

            // Create the full prompt to send to OpenAI
            let fullPrompt = `${prompt}\n\n${textContent}`;

            // Send request to OpenAI API
            let openAiResponse = await remoteFetchAsync("https://api.openai.com/v1/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${openAiApiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    prompt: fullPrompt,
                    max_tokens: 150
                })
            });

            if (!openAiResponse.ok) {
                throw new Error('Failed to fetch data from OpenAI API.');
            }

            let result = await openAiResponse.json();
            let summary = result.choices[0].text.trim();

            // Update the record with the summary
            await table.updateRecordAsync(record.id, {
                [summaryField.name]: summary
            });

            output.markdown(`**Summary for Record [${record.id}]:**\n${summary}`);
        } else {
            output.text(`No .txt attachment found for Record ID ${record.id}.`);
        }
    }
}

await main();
