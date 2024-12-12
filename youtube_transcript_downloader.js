// Set the maximum number of records to update in one batch
let maxAirtableWrites = 50;

// Config settings
let settings = input.config({
    title: "YouTube Subtitles to Airtable",
    description: `This script downloads the subtitles of YouTube videos and stores them in Airtable as attachments.
    You will need a [YouTube Data API v3 key](https://developers.google.com/youtube/v3/getting-started).`,
    items: [
        input.config.text("youtubeKey", {
            label: "Your YouTube Data API v3 key",
            description: "Warning: the API key will be visible to everyone who can view this base.",
        }),
        input.config.table("table", { label: "Which table are your videos in?" }),
        input.config.view("view", {
            parentTable: "table",
            label: "Which view contains the records to process?",
        }),
        input.config.field("videoField", {
            parentTable: "table",
            label: "Which field has your YouTube video URLs?",
        }),
        input.config.field("attachmentField", {
            parentTable: "table",
            label: "Attachment field to store subtitle file",
        }),
    ],
});

// Helper function to parse YouTube video ID from URL
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

// Fetch list of available captions
async function fetchCaptions(videoId, apiKey) {
    let captionsUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
    let captionsResponse = await fetch(captionsUrl);
    if (!captionsResponse.ok) {
        let errorText = await captionsResponse.text();
        output.text(`Error fetching captions: ${errorText}`);
        throw new Error(errorText);
    }
    let captions = await captionsResponse.json();
    return captions.items;
}

// Fetch the .srt file for a specific caption
async function fetchSubtitle(captionId, apiKey) {
    let subtitleUrl = `https://www.googleapis.com/youtube/v3/captions/${captionId}?tfmt=srt&key=${apiKey}`;
    let subtitleResponse = await fetch(subtitleUrl);
    if (!subtitleResponse.ok) {
        let errorText = await subtitleResponse.text();
        output.text(`Error fetching subtitle: ${errorText}`);
        throw new Error(errorText);
    }
    let subtitleText = await subtitleResponse.text();
    return subtitleText;
}

// Main script execution
let { youtubeKey, table, view, videoField, attachmentField } = settings;

// Prompt to skip records with existing attachments
let skipExisting = await input.buttonsAsync("Skip records with existing subtitles?", [
    { label: "Yes", value: true },
    { label: "No", value: false },
]);

let query;
try {
    query = await view.selectRecordsAsync({ fields: [videoField.id, attachmentField.id] });
    output.text(`Processing ${query.records.length} records from the ${view.name} view...`);
} catch (e) {
    output.text(`Error executing query: ${e}`);
}

let recordsToUpdate = [];

for (let record of query.records) {
    if (skipExisting && record.getCellValue(attachmentField.id)) {
        output.text(`Skipping record ${record.id} because it already has an attachment.`);
        continue;
    }

    let url = record.getCellValueAsString(videoField.id);
    let videoId = parseId(url);
    if (videoId) {
        try {
            let captions = await fetchCaptions(videoId, youtubeKey);
            if (captions.length === 0) {
                output.text(`No captions available for video ID ${videoId}.`);
                continue;
            }

            let captionId = captions[0].id; // Use the first available caption
            let subtitleText = await fetchSubtitle(captionId, youtubeKey);
            let subtitleFile = {
                url: `data:text/plain;base64,${btoa(unescape(encodeURIComponent(subtitleText)))}`,
                filename: `${videoId}.srt`
            };
            output.text(`Fetched subtitle for video ID ${videoId}: ${subtitleText.slice(0, 100)}...`);

            recordsToUpdate.push({
                id: record.id,
                fields: {
                    [attachmentField.id]: [{ url: subtitleFile.url, filename: subtitleFile.filename }],
                },
            });
        } catch (e) {
            output.text(`Error fetching or storing subtitle for video ID ${videoId}: ${e}`);
        }
    } else {
        output.text(`Invalid URL: ${url}`);
    }
}

while (recordsToUpdate.length) {
    let batch = recordsToUpdate.splice(0, maxAirtableWrites);
    try {
        output.text(`Updating batch of ${batch.length} records...`);
        await table.updateRecordsAsync(batch);
        output.text(`Successfully updated batch: ${JSON.stringify(batch, null, 2)}`);
    } catch (e) {
        output.text(`Error updating records: ${e}`);
    }
}

output.text("Operation complete.");
