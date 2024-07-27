let settings = input.config({
    title: "Search Archive.org",
    description: "This script searches Archive.org for Japanese texts based on a user-defined search string and number of records, and displays the results in an output table.",
    items: [
        input.config.text("searchString", {
            label: "🔍 Search String",
            description: "Enter the search string to use for Archive.org",
        }),
        input.config.text("maxRecords", {
            label: "🔢 Max Records",
            description: "Enter the maximum number of records to fetch (1-1000)",
        }),
        input.config.table("table", {
            label: "📄 Table",
            description: "Select the table that contains the identifier field",
        }),
        input.config.field("identifierField", {
            parentTable: "table",
            label: "📄 Identifier Field",
            description: "Select the field that stores the identifier in your Airtable table",
        }),
        input.config.field("titleField", {
            parentTable: "table",
            label: "📄 Title Field",
            description: "Select the field to store the title",
        }),
        input.config.field("creatorField", {
            parentTable: "table",
            label: "📄 Creator Field",
            description: "Select the field to store the creator",
        }),
        input.config.field("languageField", {
            parentTable: "table",
            label: "📄 Language Field",
            description: "Select the field to store the language",
        }),
        input.config.field("publicDateField", {
            parentTable: "table",
            label: "📄 Public Date Field",
            description: "Select the field to store the public date",
        }),
        input.config.field("uploaderField", {
            parentTable: "table",
            label: "📄 Uploader Field",
            description: "Select the field to store the uploader",
        }),
        input.config.field("descriptionField", {
            parentTable: "table",
            label: "📄 Description Field",
            description: "Select the field to store the description",
        }),
        input.config.field("itemUrlField", {
            parentTable: "table",
            label: "📄 Item URL Field",
            description: "Select the field to store the item URL",
        }),
    ],
});

let { searchString, maxRecords, table, identifierField, titleField, creatorField, languageField, publicDateField, uploaderField, descriptionField, itemUrlField } = settings;
let searchLanguage = "jpn"; // Hardcoded search language
let mediaType = "texts"; // Hardcoded media type

// Validate max records input
let maxRecordsNum = parseInt(maxRecords, 10);
if (isNaN(maxRecordsNum) || maxRecordsNum < 1 || maxRecordsNum > 1000) {
    throw new Error('Invalid number of records. Please enter a number between 1 and 1000.');
}

// Function to fetch search results from Archive.org
async function fetchArchiveResults(searchString, maxRecordsNum, searchLanguage, mediaType) {
    let searchURL = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(searchString)} AND language:${searchLanguage} AND mediatype:${mediaType}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=language&fl[]=publicdate&fl[]=uploader&fl[]=description&fl[]=identifier&output=json&rows=${maxRecordsNum}`;
    let response = await fetch(searchURL);
    if (!response.ok) throw new Error('Failed to fetch search results from Archive.org.');
    let data = await response.json();
    return data.response.docs;
}

// Function to fetch existing identifiers from Airtable
async function fetchExistingIdentifiers(table, identifierField) {
    let query = await table.selectRecordsAsync();
    let identifiers = new Set();
    for (let record of query.records) {
        let identifier = record.getCellValue(identifierField);
        if (identifier) {
            identifiers.add(identifier);
        }
    }
    return identifiers;
}

// Function to add new records to Airtable
async function addNewRecords(table, newRecords) {
    let createRecords = newRecords.map(record => ({
        fields: {
            [identifierField.name]: record.Identifier,
            [titleField.name]: record.Title,
            [creatorField.name]: record.Creator,
            [languageField.name]: record.Language,
            [publicDateField.name]: record.PublicDate,
            [uploaderField.name]: record.Uploader,
            [descriptionField.name]: record.Description,
            [itemUrlField.name]: `https://archive.org/details/${record.Identifier}`
        }
    }));
    await table.createRecordsAsync(createRecords);
}

// Main script logic
async function main() {
    try {
        // Fetch existing identifiers from Airtable
        let existingIdentifiers = await fetchExistingIdentifiers(table, identifierField);

        // Fetch search results from Archive.org
        let results = await fetchArchiveResults(searchString, maxRecordsNum, searchLanguage, mediaType);
        output.text(`Fetched ${results.length} results from Archive.org`);

        // Prepare data for output table, checking for existing identifiers and collecting new records
        let newRecords = [];
        let outputData = results.map(result => {
            let existsInAirtable = existingIdentifiers.has(result.identifier);
            if (!existsInAirtable) {
                newRecords.push({
                    Identifier: result.identifier,
                    Title: result.title,
                    Creator: result.creator,
                    Language: result.language,
                    PublicDate: result.publicdate,
                    Uploader: result.uploader,
                    Description: result.description,
                });
            }
            return {
                Identifier: result.identifier,
                Title: result.title,
                Creator: result.creator,
                Language: result.language,
                PublicDate: result.publicdate,
                Uploader: result.uploader,
                Description: result.description,
                ItemURL: `https://archive.org/details/${result.identifier}`,
                ExistsInAirtable: existsInAirtable ? "Yes" : "No"
            };
        });

        // Display results in an output table
        output.table(outputData);

        // Add new records to Airtable if any
        if (newRecords.length > 0) {
            await addNewRecords(table, newRecords);
            output.text(`Added ${newRecords.length} new records to Airtable.`);
        } else {
            output.text('No new records to add to Airtable.');
        }
    } catch (error) {
        output.text(`Error: ${error.message}`);
    }
}

await main();
