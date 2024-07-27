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
    ],
});

let { searchString, maxRecords } = settings;
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

// Main script logic
async function main() {
    try {
        let results = await fetchArchiveResults(searchString, maxRecordsNum, searchLanguage, mediaType);
        output.text(`Fetched ${results.length} results from Archive.org`);

        // Prepare data for output table
        let outputData = results.map(result => ({
            Identifier: result.identifier,
            Title: result.title,
            Creator: result.creator,
            Language: result.language,
            PublicDate: result.publicdate
        }));

        // Display results in an output table
        output.table(outputData);
    } catch (error) {
        output.text(`Error: ${error.message}`);
    }
}

await main();
