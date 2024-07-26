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

let totalResults = [];
try {
    while (maxResults > 0) {
        let resultsToFetch = Math.min(maxResults, 50); // Fetch in batches of 50
        let results = await fetchYoutubeData(youtubeKey, searchString, resultsToFetch);

        totalResults.push(...results);
        maxResults -= results.length;

        if (results.length < 50) {
            break; // Stop if fewer results were returned than requested
        }
    }

    let urlRecords = totalResults.map((result) => ({
        fields: {
            [urlField.id]: result.url,
        },
    }));

    while (urlRecords.length > 0) {
        let batch = urlRecords.splice(0, 50); // Airtable API limit is 50 records per batch
        await table.createRecordsAsync(batch);
    }

    output.text(`Successfully saved ${totalResults.length} YouTube URLs to the table.`);
} catch (e) {
    output.text(`Error: ${e.message}`);
}
