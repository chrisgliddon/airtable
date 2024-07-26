let settings = input.config({
    title: "Extract Video Games from YouTube Title and Description",
    description: `This script uses the OpenAI API to itemize video games mentioned in the title and description of YouTube videos and links them to a related table.`,
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
        input.config.field("videoGameField", {
            parentTable: "videoTable",
            label: "🎮 Video Game Field",
            description: "Select the 'Link to another record' field for video games",
        }),
        input.config.table("gameTable", {
            label: "🎮 Game Table",
            description: "Select the table containing your game records",
        }),
        input.config.field("gameNameField", {
            parentTable: "gameTable",
            label: "🎮 Game Name Field",
            description: "Select the field containing the game names",
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
    videoGameField,
    gameTable,
    gameNameField,
    view,
    model
} = settings;

// Function to fetch the game names mentioned in the title and description using OpenAI API
async function fetchGameNames(title, description) {
    let messages = [
        {
            role: "system",
            content: "You are a helpful assistant that extracts video game names from YouTube video titles and descriptions."
        },
        {
            role: "user",
            content: `Based on the following YouTube video title and description, list all video games mentioned. Only include the proper noun names of the video games, and do not include any numbers, hyphens, or extraneous characters. Each game should be listed on a new line. If no specific game is mentioned, return the result "None".\n\nTitle: ${title}\nDescription: ${description}\n\nVideo Games:`
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
            max_tokens: 100,
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

    // Clean the game names by removing numbers, hyphens, and extraneous characters
    let games = data.choices[0].message.content
        .trim()
        .split('\n')
        .map(game => game.replace(/^[\d\-\.\s]+/, '').trim())
        .filter(game => game);

    // If the result is "None", return an array with a single element "None"
    if (games.length === 0) {
        games = ["None"];
    }

    return games;
}

// Fetch records from the specified view
let query = await view.selectRecordsAsync({
    fields: [titleField.id, descriptionField.id, videoGameField.id]
});

output.text(`Processing ${query.records.length} records from the ${view.name} view...`);

for (let record of query.records) {
    let title = record.getCellValueAsString(titleField.id);
    let description = record.getCellValueAsString(descriptionField.id);

    if (!title && !description) continue;

    let games;
    try {
        games = await fetchGameNames(title, description);
    } catch (error) {
        output.text(`Error fetching game names for record ${record.id}: ${error.message}`);
        continue;
    }

    if (games.length === 0) continue;

    // Find or create the corresponding game records in the gameTable
    let gameRecords = await gameTable.selectRecordsAsync({
        fields: [gameNameField.id]
    });

    let gameIds = [];
    for (let game of games) {
        let existingGameRecord = gameRecords.records.find(record => record.getCellValueAsString(gameNameField.id) === game);
        if (existingGameRecord) {
            gameIds.push(existingGameRecord.id);
        } else {
            let newGameRecordId = await gameTable.createRecordAsync({
                [gameNameField.id]: game
            });
            gameIds.push(newGameRecordId);
        }
    }

    // Remove duplicates from gameIds
    gameIds = [...new Set(gameIds)];

    // Update the video record with the linked game records
    await videoTable.updateRecordAsync(record.id, {
        [videoGameField.id]: gameIds.map(id => ({ id }))
    });
}

output.text("Operation complete.");
