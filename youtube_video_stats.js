let maxYoutubeResults = 50; // Maximum number of videos to fetch in one API call
let maxAirtableWrites = 50; // Maximum number of records to update in one batch

let settings = input.config({
    title: "YouTube URLs to Airtable Data",
    description: `This magic script takes YouTube video URLs and queries the YouTube Data API for video metadata (e.g. number of likes & views), then stores that data in the specified fields.

You will need a [YouTube Data API v3 key](https://developers.google.com/youtube/v3/getting-started). If needed, see [YouTube's documentation](https://developers.google.com/youtube/v3/docs/videos#resource-representation).

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
        input.config.table("table", { label: "📡 Which table are your videos in?" }),
        input.config.field("videoField", {
            parentTable: "table",
            label: "📡 Which field has your YouTube video URLs?",
        }),

        // Receiving fields
        input.config.field("viewCountField", {
            parentTable: "table",
            label: "💾 View count",
        }),
        input.config.field("likeCountField", {
            parentTable: "table",
            label: "💾 Like count",
        }),
        input.config.field("commentCountField", {
            parentTable: "table",
            label: "💾 Comment count",
        }),
        input.config.field("publishedAtField", {
            parentTable: "table",
            label: "💾 Publish date",
        }),
        input.config.field("channelIdField", {
            parentTable: "table",
            label: "💾 Channel ID (link to Channel table)",
        }),
        input.config.field("titleField", {
            parentTable: "table",
            label: "💾 Video title",
        }),
        input.config.field("descriptionField", {
            parentTable: "table",
            label: "💾 Video description",
        }),
        input.config.field("thumbnailField", {
            parentTable: "table",
            label: "💾 Video thumbnail URL",
        }),
        input.config.field("defaultAudioLanguageField", {
            parentTable: "table",
            label: "💾 Video's default language",
        }),
        input.config.table("channelTable", { label: "Channel table for relational linking" }),
        input.config.field("channelField", {
            parentTable: "channelTable",
            label: "💾 Channel ID field in Channel table",
        }),
    ],
});

let description = `
# Capture YouTube Analytics

For each record in a given table which contains a link to a video on YouTube.com, fetch some metadata describing the video and store the information in specified fields.

- [YouTube Data API Overview](https://developers.google.com/youtube/v3/getting-started) - for details on configuring a YouTube account and retrieving an API key
- [YouTube Video Resource Representation](https://developers.google.com/youtube/v3/docs/videos#resource-representation) - for details on the available data, including the valid options for metadata fields
`;

function parseId(url) {
    let host, searchParams;

    if (!url) {
        return null;
    }

    try {
        ({ host, searchParams } = new URL(url));
    } catch (e) {
        output.text(`Error parsing URL "${url}": ${e}`);
        return null;
    }

    if (!/(^|.)youtube.com$/i.test(host)) {
        return null;
    }

    return searchParams.get("v") || null;
}

async function fetchVideoData(key, items) {
    let ids = items.map((item) => item.videoId);
    let urlString =
        "https://www.googleapis.com/youtube/v3/videos" +
        `?key=${key}&id=${ids.join(",")}&part=status,statistics,contentDetails,snippet`;
    output.text(`Fetching from URL: ${urlString}`);
    let response = await fetch(urlString);

    if (!response.ok) {
        let errorText = await response.text();
        output.text(`Error fetching data: ${errorText}`);
        throw new Error(errorText);
    }

    return (await response.json()).items.map((item, index) => ({
        ...items[index],
        privacyStatus: item.status.privacyStatus,
        viewCount: Number(item.statistics.viewCount),
        likeCount: Number(item.statistics.likeCount),
        commentCount: Number(item.statistics.commentCount),
        publishedAt: item.snippet.publishedAt,
        channelId: item.snippet.channelId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.maxres?.url || item.snippet.thumbnails.standard?.url || item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        defaultAudioLanguage: item.snippet.defaultAudioLanguage,
    }));
}

async function findOrCreateChannelRecord(channelTable, channelField, channelId) {
    let existingRecords = await channelTable.selectRecordsAsync({ fields: [channelField.id] });
    let existingRecord = existingRecords.records.find(record => record.getCellValueAsString(channelField.id) === channelId);

    if (existingRecord) {
        return existingRecord.id;
    } else {
        let createRecord = await channelTable.createRecordAsync({
            [channelField.id]: channelId
        });
        return createRecord;
    }
}

output.markdown(description);

let { youtubeKey, table, videoField, viewCountField, likeCountField, commentCountField, publishedAtField, channelIdField, titleField, descriptionField, thumbnailField, defaultAudioLanguageField, channelTable, channelField } = settings;

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
    query = await table.selectRecordsAsync({ fields: [videoField.id, thumbnailField.id] });
    output.text("Query executed successfully.");
} catch (e) {
    output.text(`Error executing query: ${e}`);
}

let bareItems;
try {
    bareItems = query.records
        .map((record) => {
            let url = record.getCellValueAsString(videoField.id);
            let videoId = parseId(url);
            if (!videoId) {
                output.text(`Invalid URL: ${url}`);
            }
            let existingAttachments = record.getCellValue(thumbnailField) || [];
            if (skipAlreadySet && existingAttachments.length > 0) {
                return null;
            }
            return {
                record: record,
                videoId: videoId
            };
        })
        .filter((item) => item && item.videoId);
    output.text(`Total number of records: ${query.records.length}`);
    output.text(`Number of records with valid URLs: ${bareItems.length}`);
} catch (e) {
    output.text(`Error processing records: ${e}`);
}

let annotatedItems = [];

while (bareItems.length) {
    let workingSet = bareItems.splice(0, maxYoutubeResults);

    output.text(`Fetching metadata for ${workingSet.length} videos...`);

    try {
        annotatedItems.push(
            ...(await fetchVideoData(youtubeKey, workingSet))
        );
    } catch (e) {
        output.text(`Error fetching video data: ${e}`);
    }
}

while (annotatedItems.length) {
    let workingSet = annotatedItems.splice(0, maxAirtableWrites);

    output.text(`Updating ${workingSet.length} records...`);

    // Update number fields
    let numberRecords = workingSet.map((item) => ({
        id: item.record.id,
        fields: {
            [viewCountField.id]: item.viewCount,
            [likeCountField.id]: item.likeCount,
            [commentCountField.id]: item.commentCount,
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
        id: item.record.id,
        fields: {
            [titleField.id]: item.title,
            [descriptionField.id]: item.description,
            [defaultAudioLanguageField.id]: item.defaultAudioLanguage,
        },
    }));

    try {
        output.text(`Updating text fields: ${JSON.stringify(textRecords, null, 2)}`);
        await table.updateRecordsAsync(textRecords);
        output.text(`Successfully updated text fields.`);
    } catch (e) {
        output.text(`Error updating text fields: ${e}`);
    }

    // Update date field
    let dateRecords = workingSet.map((item) => ({
        id: item.record.id,
        fields: {
            [publishedAtField.id]: new Date(item.publishedAt).toISOString(),
        },
    }));

    try {
        output.text(`Updating date field: ${JSON.stringify(dateRecords, null, 2)}`);
        await table.updateRecordsAsync(dateRecords);
        output.text(`Successfully updated date field.`);
    } catch (e) {
        output.text(`Error updating date field: ${e}`);
    }

    // Update attachment fields
    let attachmentRecords = workingSet.map((item) => ({
        id: item.record.id,
        fields: {
            [thumbnailField.id]: [{ url: item.thumbnail }],
        },
    }));

    try {
        output.text(`Updating attachment fields: ${JSON.stringify(attachmentRecords, null, 2)}`);
        await table.updateRecordsAsync(attachmentRecords);
        output.text(`Successfully updated attachment fields.`);
    } catch (e) {
        output.text(`Error updating attachment fields: ${e}`);
    }

    // Update channel ID field
    for (let item of workingSet) {
        let channelId = item.channelId;
        let channelRecordId = await findOrCreateChannelRecord(channelTable, channelField, channelId);

        let channelRecords = [{
            id: item.record.id,
            fields: {
                [channelIdField.id]: [{ id: channelRecordId }]
            },
        }];

        try {
            output.text(`Updating channel ID field: ${JSON.stringify(channelRecords, null, 2)}`);
            await table.updateRecordsAsync(channelRecords);
            output.text(`Successfully updated channel ID field.`);
        } catch (e) {
            output.text(`Error updating channel ID field: ${e}`);
        }
    }
}

output.text("Operation complete.");
