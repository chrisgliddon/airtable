let settings = input.config({
    title: "Shorten Video Titles with AI",
    description: `This script uses the OpenAI API to shorten YouTube video titles based on the video's title and description. The shortened title should include the key subject of the video within the first 30 characters.`,
    items: [
        input.config.text("openAiKey", {
            label: "🗝️ OpenAI API Key",
            description: "Enter your OpenAI API key",
        }),
        input.config.table("videoTable", {
            label: "🎥 Video Table",
            description: "Select the table containing your video records",
        }),
        input.config.view("view", {
            parentTable: "videoTable",
            label: "👁️ View",
            description: "Select the view to limit the records processed",
        }),
        input.config.field("titleField", {
            parentTable: "videoTable",
            label: "📝 Title Field",
            description: "Select the field containing the video titles",
        }),
        input.config.field("descriptionField", {
            parentTable: "videoTable",
            label: "📝 Description Field",
            description: "Select the field containing the video descriptions",
        }),
        input.config.field("shortTitleField", {
            parentTable: "videoTable",
            label: "✂️ Short Title Field",
            description: "Select the field where the shortened titles will be stored",
        }),
        input.config.field("checklistField", {
            parentTable: "videoTable",
            label: "✅ Checklist Field",
            description: "Select the checklist field to set to TRUE after updating the title",
        }),
        input.config.select("model", {
            label: "🤖 OpenAI Model",
            description: "Select the OpenAI model to use",
            options: [
                { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
                { label: "GPT-4o Mini", value: "gpt-4o-mini" }
            ],
            defaultValue: "gpt-3.5-turbo"
        }),
    ],
});

let {
    openAiKey,
    videoTable,
    titleField,
    descriptionField,
    shortTitleField,
    checklistField,
    view,
    model
} = settings;

// Function to fetch the shortened title using the OpenAI API
async function fetchShortTitle(title, description) {
    let messages = [
        {
            role: "system",
            content: "You are a helpful assistant that shortens YouTube video titles."
        },
        {
            role: "user",
            content: `Based on the following YouTube video title and description, create a shorter title that includes the key subject of the video within the first 30 characters. Ensure the shortened title is clear, concise, in Title Case formatting, factual, and not hyperbolic (no ALL CAPS). The title does not need to include the name of the YouTube channel, just the subject of the video itself.\n\nTitle: ${title}\nDescription: ${description}\n\nShortened Title:`
        }
    ];
    let response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: 50,
        }),
    });

    if (!response.ok) {
        let errorText = await response.text();
        console.error(`Failed to fetch from OpenAI API: ${response.statusText}`);
        console.error(`Error response: ${errorText}`);
        throw new Error(`Failed to fetch from OpenAI API: ${response.statusText}`);
    }

    let data = await response.json();
    if (!data.choices) {
        console.log("Unexpected response format:", data);
        throw new Error("Unexpected response format from OpenAI API");
    }

    // Extract the shortened title from the API response
    let shortTitle = data.choices[0].message.content.trim();
    return shortTitle;
}

// Fetch records from the specified view
let query = await view.selectRecordsAsync({
    fields: [titleField.id, descriptionField.id, shortTitleField.id, checklistField.id]
});

output.text(`Processing ${query.records.length} records from the ${view.name} view...`);

for (let record of query.records) {
    let title = record.getCellValueAsString(titleField.id);
    let description = record.getCellValueAsString(descriptionField.id);

    if (!title && !description) continue;

    let shortTitle;
    try {
        shortTitle = await fetchShortTitle(title, description);
    } catch (error) {
        output.text(`Error fetching short title for record ${record.id}: ${error.message}`);
        continue;
    }

    if (!shortTitle) continue;

    // Update the video record with the shortened title and set the checklist field to TRUE
    await videoTable.updateRecordAsync(record.id, {
        [shortTitleField.id]: shortTitle,
        [checklistField.id]: true
    });
}

output.text("Operation complete.");
