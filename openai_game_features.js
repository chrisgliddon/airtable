let settings = input.config({
    title: "Link Game Features",
    description: "This script uses the OpenAI API to associate features with each game in the Airtable database.",
    items: [
        input.config.text("openAiKey", {
            label: "🗝️ OpenAI API Key",
            description: "Enter your OpenAI API key",
        }),
        input.config.table("gamesTable", {
            label: "🎮 Games Table",
            description: "Select the table containing your game records",
        }),
        input.config.table("featuresTable", {
            label: "🔧 Features Table",
            description: "Select the table containing your feature records",
        }),
        input.config.field("gameNameField", {
            parentTable: "gamesTable",
            label: "📝 Game Name Field",
            description: "Select the field containing the game names",
        }),
        input.config.field("featureNameField", {
            parentTable: "featuresTable",
            label: "🔤 Feature Name Field",
            description: "Select the field containing the feature names",
        }),
        input.config.field("featureLinkField", {
            parentTable: "gamesTable",
            label: "🔗 Feature Link Field",
            description: "Select the field linking games to features",
        }),
        input.config.field("completionCheckboxField", {
            parentTable: "gamesTable",
            label: "✅ Completion Checkbox Field",
            description: "Select the checkbox field to mark when processing is complete",
        }),
        input.config.view("gameView", {
            parentTable: "gamesTable",
            label: "👁️ Game View",
            description: "Select the view to limit the game records processed",
        }),
        input.config.select("model", {
            label: "🤖 OpenAI Model",
            description: "Select the OpenAI model to use",
            options: [
                { label: "GPT-4o Mini", value: "gpt-4o-mini" },
                { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" }
            ],
            defaultValue: "gpt-3.5-turbo"
        }),
    ],
});

let {
    openAiKey,
    gamesTable,
    featuresTable,
    gameNameField,
    featureNameField,
    featureLinkField,
    completionCheckboxField,
    gameView,
    model
} = settings;

// Fetch existing features from the Features table
let featureRecords = await featuresTable.selectRecordsAsync({
    fields: [featureNameField.id]
});

let existingFeatures = featureRecords.records.map(record =>
    record.getCellValueAsString(featureNameField.id).trim()
);

let featureNameToIdMap = Object.fromEntries(
    featureRecords.records.map(record => [record.getCellValueAsString(featureNameField.id), record.id])
);

// Function to determine features using the OpenAI API
async function fetchGameFeatures(gameName) {
    let messages = [
        {
            role: "system",
            content: "You are a helpful assistant that identifies video game features from a provided list."
        },
        {
            role: "user",
            content: `Consider the game "${gameName}". The following is a list of common game features: ${existingFeatures.join(', ')}. Select only those features that are relevant to this game. Respond with the relevant features separated by commas.`
        }
    ];

    output.text(`Sending API request for "${gameName}" with features: ${existingFeatures.join(', ')}`);

    let response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: 150,
        }),
    });

    if (!response.ok) {
        let errorText = await response.text();
        console.error(`Failed to fetch from OpenAI API: ${response.statusText}`);
        console.error(`Error response: ${errorText}`);
        throw new Error(`Failed to fetch from OpenAI API: ${response.statusText}`);
    }

    let data = await response.json();
    console.log(`API response for "${gameName}":`, data);

    if (!data.choices || !data.choices[0].message.content) {
        console.log("Unexpected response format:", data);
        throw new Error("Unexpected response format from OpenAI API");
    }

    // Extract and filter features from the API response
    let featureList = data.choices[0].message.content
        .split(',')
        .map(f => f.trim())
        .filter(f => f.length > 1 && !f.includes('.') && !f.includes('Explain') && !f.includes('this means')); // Remove invalid entries

    output.text(`Features identified for "${gameName}": ${featureList.join(', ')}`);
    return featureList;
}

// Fetch records from the specified view
let query = await gameView.selectRecordsAsync({
    fields: [gameNameField.id, featureLinkField.id, completionCheckboxField.id]
});

let results = [];

output.text(`Processing ${query.records.length} records from the ${gameView.name} view...`);

for (let record of query.records) {
    let gameName = record.getCellValueAsString(gameNameField.id);

    if (!gameName) {
        output.text(`Skipping record with no game name: ${record.id}`);
        continue;
    }

    output.text(`Processing game: ${gameName}`);

    let features;
    try {
        features = await fetchGameFeatures(gameName);
    } catch (error) {
        output.text(`Error fetching features for record ${record.id}: ${error.message}`);
        continue;
    }

    if (!features.length) {
        output.text(`No valid features found for "${gameName}".`);
        continue;
    }

    // Find feature IDs for existing features or create new ones if they don't exist
    let featureIds = [];
    for (let featureName of features) {
        if (featureNameToIdMap[featureName]) {
            featureIds.push({ id: featureNameToIdMap[featureName] });
        } else {
            // Create a new feature record if it doesn't exist
            try {
                let newFeatureRecordId = await featuresTable.createRecordAsync({ [featureNameField.id]: featureName });
                featureIds.push({ id: newFeatureRecordId });
                // Update the map with the new record ID
                featureNameToIdMap[featureName] = newFeatureRecordId;
                output.text(`Added new feature "${featureName}" for "${gameName}".`);
            } catch (error) {
                output.text(`Failed to create new feature "${featureName}": ${error.message}`);
            }
        }
    }

    // Update the game record with the linked features and check the completion checkbox
    try {
        await gamesTable.updateRecordAsync(record.id, {
            [featureLinkField.id]: featureIds,
            [completionCheckboxField.id]: true
        });
        output.text(`Linked features for "${gameName}": ${features.join(', ')}`);
    } catch (error) {
        output.text(`Failed to update record ${record.id} for "${gameName}": ${error.message}`);
    }

    // Record result for output
    results.push({ "Game Name": gameName, "Features": features.join(', ') });
}

// Output the results in a table
if (results.length > 0) {
    output.table(results);
} else {
    output.text("No features were linked.");
}

output.text("Operation complete.");
