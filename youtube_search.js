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
            description: "Enter the maximum number of results to fetch from YouTube",
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
    let urlString = `https://www.googleapis.com/youtube/v3/search?key=${key}&q=${encodeURIComponent(searchString)}&part=snippet&type=video&maxResults=${maxResults}`;
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

try {
    let results = await fetchYoutubeData(youtubeKey, searchString, maxResults);

    let urlRecords = results.map((result) => ({
        fields: {
            [urlField.id]: result.url,
        },
    }));

    await table.createRecordsAsync(urlRecords);

    output.text(`Successfully saved ${urlRecords.length} YouTube URLs to the table.`);
} catch (e) {
    output.text(`Error: ${e.message}`);
}
