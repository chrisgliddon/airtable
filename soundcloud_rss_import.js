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
        input.config.field("durationField", {
            parentTable: "table",
            label: "⏳ Duration Field",
            description: "Select the field to store the track duration",
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
    durationField,
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

// Function to fetch existing records from Airtable
async function fetchExistingRecords(table, linkField) {
    let query = await table.selectRecordsAsync();
    let records = {};
    for (let record of query.records) {
        let link = record.getCellValue(linkField);
        if (link) {
            records[link] = record;
        }
    }
    return records;
}

// Function to update the output table in real-time
function updateProgress(progressData) {
    output.clear();
    output.table(progressData);
}

// Main script logic
async function main() {
    try {
        // Fetch existing records from Airtable
        let existingRecords = await fetchExistingRecords(table, linkField);

        // Fetch and parse the RSS feed
        let rssText = await fetchRSSFeed(rssUrl);
        let items = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];

        let progressData = [];

        for (let item of items) {
            let link = extractValue(item, "link");
            let title = extractValue(item, "title");
            let description = extractValue(item, "description");
            let pubDate = extractValue(item, "pubDate");
            let guid = extractValue(item, "guid");
            let duration = extractValue(item, "itunes:duration") || 0; // Adjust if duration is present elsewhere
            let plays = extractValue(item, "soundcloud:playcount") || 0; // Attempt to parse custom play count
            let comments = extractValue(item, "soundcloud:commentcount") || 0; // Attempt to parse custom comment count
            let contentSnippet = description.substring(0, 100); // Example snippet logic

            let fields = {
                [titleField.name]: title,
                [linkField.name]: link,
                [guidField.name]: guid,
                [durationField.name]: duration,
                [contentField.name]: description,
                [contentSnippetField.name]: contentSnippet,
                [pubDateField.name]: new Date(pubDate),
                [playsField.name]: parseInt(plays) || 0,
                [commentsField.name]: parseInt(comments) || 0,
            };

            if (existingRecords[link]) {
                // Update existing record
                await table.updateRecordAsync(existingRecords[link].id, fields);
                progressData.push({ Status: "Updated", Link: link, Title: title });
            } else {
                // Create a new record
                await table.createRecordAsync({ fields });
                progressData.push({ Status: "New Record", Link: link, Title: title });
            }

            // Update progress after each record
            updateProgress(progressData);
        }

        output.text(`Script completed. Processed ${progressData.length} records.`);
    } catch (error) {
        output.text(`Error: ${error.message}`);
    }
}

await main();
