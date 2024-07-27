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
    ],
});

let { searchString, maxRecords, table, identifierField } = settings;
let searchLanguage = "jpn"; // Hardcoded search language
let mediaType = "texts"; // Hardcoded media type

// Validate max records input
let maxRecordsNum = parseInt(maxRecords, 10);
if (isNaN(maxRecordsNum) || maxRecordsNum < 1 || maxRecordsNum > 1000) {
    throw new Error('Invalid number of records. Please enter a number between 1 and 1000.');
}

// Function to fetch search results from Archive.org
async function fetchArchiveResults(searchString, maxRecordsNum, searchLanguage, mediaType) {
    let searchURL = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(searchString)} AND language:${searchLanguage} AND mediatype:${mediaType}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=language&fl[]=publicdate&output=json&rows=${maxRecordsNum}`;
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

// Main script logic
async function main() {
    try {
        // Fetch existing identifiers from Airtable
        let existingIdentifiers = await fetchExistingIdentifiers(table, identifierField);

        // Fetch search results from Archive.org
        let results = await fetchArchiveResults(searchString, maxRecordsNum, searchLanguage, mediaType);
        output.text(`Fetched ${results.length} results from Archive.org`);

        // Prepare data for output table, checking for existing identifiers
        let outputData = results.map(result => ({
            Identifier: result.identifier,
            Title: result.title,
            Creator: result.creator,
            Language: result.language,
            PublicDate: result.publicdate,
            ExistsInAirtable: existingIdentifiers.has(result.identifier) ? "Yes" : "No"
        }));

        // Display results in an output table
        output.table(outputData);
    } catch (error) {
        output.text(`Error: ${error.message}`);
    }
}

await main();
