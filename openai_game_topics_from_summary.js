let settings = input.config({
    title: "Extract Video Games from Content and Summary",
    description: `This script uses the OpenAI API to itemize video games mentioned in the content and summary fields of podcast episodes and links them to a related table.`,
    items: [
        input.config.text("openAiKey", {
            label: "🗝️ OpenAI API Key",
            description: "Enter your OpenAI API key",
        }),
        input.config.table("podcastTable", {
            label: "🎙️ Podcast Table",
            description: "Select the table containing your podcast records",
        }),
        input.config.view("view", {
            parentTable: "podcastTable",
            label: "👁️ View",
            description: "Select the view to limit the records processed",
        }),
        input.config.field("contentField", {
            parentTable: "podcastTable",
            label: "📝 Content Field",
            description: "Select the field containing the podcast content",
        }),
        input.config.field("summaryField", {
            parentTable: "podcastTable",
            label: "📝 Summary Field",
            description: "Select the field containing the podcast summary",
        }),
        input.config.field("videoGameField", {
            parentTable: "podcastTable",
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
    podcastTable,
    contentField,
    summaryField,
    videoGameField,
    gameTable,
    gameNameField,
    view,
    model
} = settings;

// Function to fetch the game names mentioned in the content and summary using OpenAI API
async function fetchGameNames(content, summary) {
    let messages = [
        {
            role: "system",
            content: "You are a helpful assistant that extracts video game names from podcast content and summaries."
        },
        {
            role: "user",
            content: `Based on the following podcast content and summary, list all video games mentioned. Only include the proper noun names of the video games, and do not include any numbers, hyphens, or extraneous characters. Each game should be listed on a new line. If no specific game is mentioned, return the result 'None'.\n\nContent: ${content}\nSummary: ${summary}\n\nVideo Games:`
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

// Pre-load all existing games from the gameTable
let gameRecords = await gameTable.selectRecordsAsync({
    fields: [gameNameField.id]
});

let existingGames = {};
for (let record of gameRecords.records) {
    let gameName = record.getCellValueAsString(gameNameField.id);
    if (gameName) {
        existingGames[gameName.toLowerCase()] = record.id;
    }
}

// Fetch records from the specified view
let query = await view.selectRecordsAsync({
    fields: [contentField.id, summaryField.id, videoGameField.id]
});

output.text(`Processing ${query.records.length} records from the ${view.name} view...`);

for (let record of query.records) {
    let content = record.getCellValueAsString(contentField.id);
    let summary = record.getCellValueAsString(summaryField.id);

    if (!content && !summary) continue;

    let games;
    try {
        games = await fetchGameNames(content, summary);
    } catch (error) {
        output.text(`Error fetching game names for record ${record.id}: ${error.message}`);
        continue;
    }

    if (games.length === 0) continue;

    let gameIds = [];
    for (let game of games) {
        let lowerCaseGame = game.toLowerCase();
        if (existingGames[lowerCaseGame]) {
            // Use the existing game record ID
            gameIds.push(existingGames[lowerCaseGame]);
        } else {
            // Create a new game record and store the ID
            let newGameRecordId = await gameTable.createRecordAsync({
                [gameNameField.id]: game
            });
            gameIds.push(newGameRecordId);
            existingGames[lowerCaseGame] = newGameRecordId; // Add to the existing games list
        }
    }

    // Remove duplicates from gameIds
    gameIds = [...new Set(gameIds)];

    // Update the podcast record with the linked game records
    await podcastTable.updateRecordAsync(record.id, {
        [videoGameField.id]: gameIds.map(id => ({ id }))
    });
}

output.text("Operation complete.");
