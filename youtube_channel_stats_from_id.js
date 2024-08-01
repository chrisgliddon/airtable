let maxYoutubeResults = 50; // Maximum number of channels to fetch in one API call
let maxAirtableWrites = 50; // Maximum number of records to update in one batch

let settings = input.config({
    title: "YouTube Channel Data to Airtable",
    description: `This magic script takes YouTube channel IDs and queries the YouTube Data API for channel metadata (e.g., number of subscribers & views), then stores that data in the specified fields.

You will need a [YouTube Data API v3 key](https://developers.google.com/youtube/v3/getting-started). If needed, see [YouTube's documentation](https://developers.google.com/youtube/v3/docs/channels#resource-representation).

- 📡 = data you'll send to the YouTube API.
- 💾 = what you'll get back in return.

---
`,
    items: [
        // Sending field
        input.config.text("youtubeKey", {
            label: "📡 Your YouTube Data API v3 key",
            description: "Warning: the API key will be visible to everyone who can view this base.",
        }),
        input.config.table("table", { label: "📡 Which table are your channels in?" }),
        input.config.field("channelIdField", {
            parentTable: "table",
            label: "📡 Which field has your YouTube channel IDs?",
        }),

        // Receiving fields
        input.config.field("titleField", {
            parentTable: "table",
            label: "💾 Channel title",
        }),
        input.config.field("descriptionField", {
            parentTable: "table",
            label: "💾 Channel description",
        }),
        input.config.field("subscriberCountField", {
            parentTable: "table",
            label: "💾 Subscriber count",
        }),
        input.config.field("viewCountField", {
            parentTable: "table",
            label: "💾 View count",
        }),
        input.config.field("videoCountField", {
            parentTable: "table",
            label: "💾 Video count",
        }),
        input.config.field("thumbnailField", {
            parentTable: "table",
            label: "💾 Channel thumbnail (as attachment)",
        }),
        input.config.field("snippetField", {
            parentTable: "table",
            label: "💾 JSON Snippet",
        }),
    ],
});

let description = `
# Capture YouTube Channel Analytics

For each record in a given table which contains a YouTube channel ID, fetch some metadata describing the channel and store the information in specified fields.

- [YouTube Data API Overview](https://developers.google.com/youtube/v3/getting-started) - for details on configuring a YouTube account and retrieving an API key
- [YouTube Channel Resource Representation](https://developers.google.com/youtube/v3/docs/channels#resource-representation) - for details on the available data, including the valid options for metadata fields
`;

async function fetchChannelData(key, items) {
    let ids = items.map((item) => item.channelId);
    let urlString =
        "https://www.googleapis.com/youtube/v3/channels" +
        `?key=${key}&id=${ids.join(",")}&part=snippet,statistics`;
    output.text(`Fetching from URL: ${urlString}`);
    let response = await fetch(urlString);

    if (!response.ok) {
        let errorText = await response.text();
        output.text(`Error fetching data: ${errorText}`);
        throw new Error(errorText);
    }

    let responseData = await response.json();
    return responseData.items.map((item) => ({
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        subscriberCount: Number(item.statistics.subscriberCount),
        viewCount: Number(item.statistics.viewCount),
        videoCount: Number(item.statistics.videoCount),
        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        snippet: JSON.stringify(item.snippet), // Store the snippet JSON blob
    }));
}

output.markdown(description);

let { youtubeKey, table, channelIdField, titleField, descriptionField, subscriberCountField, viewCountField, videoCountField, thumbnailField, snippetField } = settings;

output.text("Configuration loaded successfully.");

let skipAlreadySet = await input.buttonsAsync(
    "Skip attachment entries that already have files?",
    [
        { label: "Yes", value: true },
        { label: "No", value: false },
    ]
);

let query;
try {
    query = await table.selectRecordsAsync({ fields: [channelIdField.id, thumbnailField.id] });
    output.text("Query executed successfully.");
} catch (e) {
    output.text(`Error executing query: ${e}`);
}

let bareItems;
try {
    bareItems = query.records
        .map((record) => {
            let channelId = record.getCellValueAsString(channelIdField.id);
            let existingAttachments = record.getCellValue(thumbnailField) || [];
            if (skipAlreadySet && existingAttachments.length > 0) {
                return null;
            }
            return {
                recordId: record.id,
                channelId: channelId
            };
        })
        .filter((item) => item && item.channelId);
    output.text(`Total number of records: ${query.records.length}`);
    output.text(`Number of records with valid Channel IDs: ${bareItems.length}`);
} catch (e) {
    output.text(`Error processing records: ${e}`);
}

let annotatedItems = [];

while (bareItems.length) {
    let workingSet = bareItems.splice(0, maxYoutubeResults);

    output.text(`Fetching metadata for ${workingSet.length} channels...`);

    try {
        let fetchedData = await fetchChannelData(youtubeKey, workingSet);
        fetchedData.forEach((data) => {
            let matchingRecord = workingSet.find((item) => item.channelId === data.id);
            if (matchingRecord) {
                annotatedItems.push({
                    recordId: matchingRecord.recordId,
                    ...data
                });
            }
        });
    } catch (e) {
        output.text(`Error fetching channel data: ${e}`);
    }
}

while (annotatedItems.length) {
    let workingSet = annotatedItems.splice(0, maxAirtableWrites);

    output.text(`Updating ${workingSet.length} records...`);

    // Update number fields
    let numberRecords = workingSet.map((item) => ({
        id: item.recordId,
        fields: {
            [subscriberCountField.id]: item.subscriberCount,
            [viewCountField.id]: item.viewCount,
            [videoCountField.id]: item.videoCount,
        },
    }));

    try {
        output.text(`Updating number fields: ${JSON.stringify(numberRecords, null, 2)}`);
        await table.updateRecordsAsync(numberRecords);
        output.text(`Successfully updated number fields.`);
    } catch (e) {
        output.text(`Error updating number fields: ${e}`);
    }

    // Update text fields
    let textRecords = workingSet.map((item) => ({
        id: item.recordId,
        fields: {
            [titleField.id]: item.title,
            [descriptionField.id]: item.description,
            [snippetField.id]: item.snippet, // Add snippet JSON blob
        },
    }));

    try {
        output.text(`Updating text fields: ${JSON.stringify(textRecords, null, 2)}`);
        await table.updateRecordsAsync(textRecords);
        output.text(`Successfully updated text fields.`);
    } catch (e) {
        output.text(`Error updating text fields: ${e}`);
    }

    // Update attachment fields
    let attachmentRecords = workingSet.map((item) => ({
        id: item.recordId,
        fields: {
            [thumbnailField.id]: [{ url: item.thumbnail, filename: `${item.title}_thumbnail.jpg` }],
        },
    }));

    try {
        output.text(`Updating attachment fields: ${JSON.stringify(attachmentRecords, null, 2)}`);
        await table.updateRecordsAsync(attachmentRecords);
        output.text(`Successfully updated attachment fields.`);
    } catch (e) {
        output.text(`Error updating attachment fields: ${e}`);
    }
}

output.text("Operation complete.");
