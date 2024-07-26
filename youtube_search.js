let settings = input.config({
    title: "YouTube Search and Save",
    description: `This script searches YouTube based on a search string and saves the URLs to the specified field in your Airtable table.`,
    items: [
        input.config.text("youtubeKey", {
            label: "Your YouTube Data API v3 key",
            description: "Warning: the API key will be visible to everyone who can view this base.",
        }),
        input.config.text("searchString", {
            label: "Search String",
            description: "Enter the search string to search on YouTube",
        }),
        input.config.number("maxResults", {
            label: "Max Number of Results",
            description: "Enter the maximum number of results to fetch from YouTube (up to 25,000)",
            defaultValue: 10,
        }),
        input.config.table("table", { label: "Table to store results" }),
        input.config.field("urlField", {
            parentTable: "table",
            label: "Field to store YouTube URLs",
        }),
    ],
});

async function fetchYoutubeData(key, searchString, maxResults) {
    let urlString = `https://www.googleapis.com/youtube/v3/search?key=${key}&q=${encodeURIComponent(searchString)}&part=snippet&type=video&maxResults=${Math.min(maxResults, 50)}`;
    let response = await fetch(urlString);

    if (!response.ok) {
        let errorText = await response.text();
        throw new Error(errorText);
    }

    let responseData = await response.json();
    return responseData.items.map((item) => ({
        videoId: item.id.videoId,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));
}

let { youtubeKey, searchString, maxResults, table, urlField } = settings;

maxResults = Math.min(maxResults, 25000);

let existingRecords = await table.selectRecordsAsync({ fields: [urlField.id] });
let existingUrls = new Set(existingRecords.records.map(record => record.getCellValue(urlField)));

let totalResults = [];
let liveTotalRecordsAdded = 0;

try {
    while (maxResults > 0) {
        let resultsToFetch = Math.min(maxResults, 50); // Fetch in batches of 50
        let results = await fetchYoutubeData(youtubeKey, searchString, resultsToFetch);

        totalResults.push(...results);
        maxResults -= results.length;

        if (results.length < 50) {
            break; // Stop if fewer results were returned than requested
        }

        output.text(`Found ${totalResults.length} videos based on "${searchString}".`);
    }

    output.text(`Found a total of ${totalResults.length} videos based on "${searchString}". Checking for duplicates and updating records in the "${table.name}" table.`);

    let newRecords = totalResults.filter(result => !existingUrls.has(result.url)).map(result => ({
        fields: {
            [urlField.id]: result.url,
        },
    }));

    while (newRecords.length > 0) {
        let batch = newRecords.splice(0, 50); // Airtable API limit is 50 records per batch
        await table.createRecordsAsync(batch);
        liveTotalRecordsAdded += batch.length;
        output.text(`Updating ${liveTotalRecordsAdded} of ${totalResults.length} records in the "${table.name}" table.`);
    }

    output.text(`Successfully saved ${liveTotalRecordsAdded} new YouTube URLs to the "${table.name}" table.`);
} catch (e) {
    output.text(`Error: ${e.message}`);
}
