// User-configurable inputs
let settings = input.config({
    title: "Fetch SoundCloud RSS Feed",
    description: "This script fetches the SoundCloud RSS feed and updates your Airtable table with the latest tracks.",
    items: [
        input.config.text("rssUrl", {
            label: "🔗 SoundCloud RSS Feed URL",
            description: "Enter the RSS feed URL for the SoundCloud account",
        }),
        input.config.table("table", {
            label: "📄 Table",
            description: "Select the table where the data will be stored",
        }),
        input.config.field("linkField", {
            parentTable: "table",
            label: "🔗 Link Field",
            description: "Select the field to store the track URL",
        }),
        input.config.field("titleField", {
            parentTable: "table",
            label: "🎵 Title Field",
            description: "Select the field to store the track title",
        }),
        input.config.field("playsField", {
            parentTable: "table",
            label: "▶️ Plays Field",
            description: "Select the field to store the play count",
        }),
        input.config.field("commentsField", {
            parentTable: "table",
            label: "💬 Comments Field",
            description: "Select the field to store the comment count",
        }),
        input.config.field("pubDateField", {
            parentTable: "table",
            label: "📅 Publication Date Field",
            description: "Select the field to store the publication date",
        }),
        input.config.field("contentField", {
            parentTable: "table",
            label: "📝 Content Field",
            description: "Select the field to store the full description",
        }),
        input.config.field("contentSnippetField", {
            parentTable: "table",
            label: "✂️ Content Snippet Field",
            description: "Select the field to store the shortened description",
        }),
        input.config.field("guidField", {
            parentTable: "table",
            label: "🆔 GUID Field",
            description: "Select the field to store the unique identifier",
        }),
    ],
});

let {
    rssUrl,
    table,
    linkField,
    titleField,
    playsField,
    commentsField,
    pubDateField,
    contentField,
    contentSnippetField,
    guidField,
} = settings;

// Function to fetch the RSS feed
async function fetchRSSFeed(url) {
    let response = await remoteFetchAsync(url);
    if (!response.ok) throw new Error('Failed to fetch the RSS feed.');
    let rssText = await response.text();
    return rssText;
}

// Function to extract text content from an XML element manually
function extractValue(xmlString, tagName) {
    const regex = new RegExp(`<${tagName}>(.*?)</${tagName}>`, 'g');
    const match = regex.exec(xmlString);
    return match ? match[1] : '';
}

// Function to fetch existing GUIDs from Airtable
async function fetchExistingGUIDs(table, guidField) {
    let query = await table.selectRecordsAsync();
    let guids = new Set();
    for (let record of query.records) {
        let guid = record.getCellValue(guidField);
        if (guid) guids.add(guid);
    }
    return guids;
}

// Main script logic
async function main() {
    try {
        // Fetch existing GUIDs from Airtable
        let existingGUIDs = await fetchExistingGUIDs(table, guidField);

        // Fetch and parse the RSS feed
        let rssText = await fetchRSSFeed(rssUrl);
        let items = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];

        let newRecords = [];
        for (let item of items) {
            let guid = extractValue(item, "guid");
            if (existingGUIDs.has(guid)) continue;

            let title = extractValue(item, "title");
            let link = extractValue(item, "link");
            let description = extractValue(item, "description");
            let pubDate = extractValue(item, "pubDate");
            let contentSnippet = description.substring(0, 100); // Example snippet logic
            let plays = extractValue(item, "itunes:duration") || 0; // Adjust if play count is present elsewhere
            let comments = extractValue(item, "itunes:explicit") || 0; // Adjust if comment count is present elsewhere

            newRecords.push({
                fields: {
                    [guidField.name]: guid,
                    [titleField.name]: title,
                    [linkField.name]: link,
                    [contentField.name]: description,
                    [contentSnippetField.name]: contentSnippet,
                    [pubDateField.name]: new Date(pubDate),
                    [playsField.name]: parseInt(plays) || 0, // Example logic, adjust as necessary
                    [commentsField.name]: parseInt(comments) || 0, // Example logic, adjust as necessary
                }
            });
        }

        // Add new records to Airtable
        const batchSize = 50;
        for (let i = 0; i < newRecords.length; i += batchSize) {
            await table.createRecordsAsync(newRecords.slice(i, i + batchSize));
        }

        output.text(`Added ${newRecords.length} new records to Airtable.`);
    } catch (error) {
        output.text(`Error: ${error.message}`);
    }
}

await main();
