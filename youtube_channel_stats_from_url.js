let maxYoutubeResults = 50; // Maximum number of channels to fetch in one API call
let maxAirtableWrites = 50; // Maximum number of records to update in one batch

let settings = input.config({
    title: "YouTube Vanity URL to Airtable",
    description: `This magic script takes YouTube channel vanity URLs and queries the YouTube Data API for channel metadata (e.g., number of subscribers & views), then stores that data in the specified fields.

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
        input.config.table("table", { label: "📡 Which table are your channel URLs in?" }),
        input.config.field("vanityUrlField", {
            parentTable: "table",
            label: "📡 Which field has your YouTube channel vanity URLs?",
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

For each record in a given table which contains a YouTube channel vanity URL, fetch some metadata describing the channel and store the information in specified fields.

- [YouTube Data API Overview](https://developers.google.com/youtube/v3/getting-started) - for details on configuring a YouTube account and retrieving an API key
- [YouTube Channel Resource Representation](https://developers.google.com/youtube/v3/docs/channels#resource-representation) - for details on the available data, including the valid options for metadata fields
`;

async function fetchChannelDataByCustomUrl(key, items) {
    let promises = items.map(async (item) => {
        let customUrl = item.vanityUrl.replace(/.*\/@/, "");
        let urlString =
            "https://www.googleapis.com/youtube/v3/search" +
            `?key=${key}&q=${encodeURIComponent(customUrl)}&type=channel&part=snippet`;
        output.text(`Fetching from URL: ${urlString}`);
        let response = await fetch(urlString);

        if (!response.ok) {
            let errorText = await response.text();
            output.text(`Error fetching data: ${errorText}`);
            throw new Error(errorText);
        }

        let responseData = await response.json();
        if (responseData.items.length === 0) {
            throw new Error(`No channel found for custom URL: ${customUrl}`);
        }

        let channelId = responseData.items[0].id.channelId;

        urlString =
            "https://www.googleapis.com/youtube/v3/channels" +
            `?key=${key}&id=${channelId}&part=snippet,statistics`;
        response = await fetch(urlString);

        if (!response.ok) {
            let errorText = await response.text();
            output.text(`Error fetching channel data: ${errorText}`);
            throw new Error(errorText);
        }

        let channelData = await response.json();
        let itemData = channelData.items[0];
        return {
            id: itemData.id,
            title: itemData.snippet.title,
            description: itemData.snippet.description,
            subscriberCount: Number(itemData.statistics.subscriberCount),
            viewCount: Number(itemData.statistics.viewCount),
            videoCount: Number(itemData.statistics.videoCount),
            thumbnail: itemData.snippet.thumbnails.high?.url || itemData.snippet.thumbnails.medium?.url || itemData.snippet.thumbnails.default?.url,
            snippet: JSON.stringify(itemData.snippet), // Store the snippet JSON blob
            recordId: item.recordId,
        };
    });

    return Promise.all(promises);
}

output.markdown(description);

let { youtubeKey, table, vanityUrlField, titleField, descriptionField, subscriberCountField, viewCountField, videoCountField, thumbnailField, snippetField } = settings;

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
    query = await table.selectRecordsAsync({ fields: [vanityUrlField.id, thumbnailField.id] });
    output.text("Query executed successfully.");
} catch (e) {
    output.text(`Error executing query: ${e}`);
}

let bareItems;
try {
    bareItems = query.records
        .map((record) => {
            let vanityUrl = record.getCellValueAsString(vanityUrlField.id);
            let existingAttachments = record.getCellValue(thumbnailField) || [];
            if (skipAlreadySet && existingAttachments.length > 0) {
                return null;
            }
            return {
                recordId: record.id,
                vanityUrl: vanityUrl
            };
        })
        .filter((item) => item && item.vanityUrl);
    output.text(`Total number of records: ${query.records.length}`);
    output.text(`Number of records with valid Vanity URLs: ${bareItems.length}`);
} catch (e) {
    output.text(`Error processing records: ${e}`);
}

let annotatedItems = [];

while (bareItems.length) {
    let workingSet = bareItems.splice(0, maxYoutubeResults);

    output.text(`Fetching metadata for ${workingSet.length} channels...`);

    try {
        let fetchedData = await fetchChannelDataByCustomUrl(youtubeKey, workingSet);
        annotatedItems.push(...fetchedData);
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
