let settings = input.config({
    title: "Extract and Format JSON Data",
    description: `This script will parse the JSON contents from the specified fields and extract the values into separate fields.`,
    items: [
        input.config.table("table", { label: "Table" }),
        input.config.field("statisticsField", {
            parentTable: "table",
            label: "Statistics JSON field",
        }),
        input.config.field("snippetField", {
            parentTable: "table",
            label: "Snippet JSON field",
        }),
        input.config.field("viewCountField", {
            parentTable: "table",
            label: "Field to store viewCount",
        }),
        input.config.field("likeCountField", {
            parentTable: "table",
            label: "Field to store likeCount",
        }),
        input.config.field("favoriteCountField", {
            parentTable: "table",
            label: "Field to store favoriteCount",
        }),
        input.config.field("commentCountField", {
            parentTable: "table",
            label: "Field to store commentCount",
        }),
        input.config.field("defaultAudioLanguageField", {
            parentTable: "table",
            label: "Field to store defaultAudioLanguage",
        }),
    ],
});

async function extractAndFormatJSON() {
    let { table, statisticsField, snippetField, viewCountField, likeCountField, favoriteCountField, commentCountField, defaultAudioLanguageField } = settings;

    let query = await table.selectRecordsAsync();

    // Loop through each record
    for (let record of query.records) {
        // Parse the JSON fields
        let statistics = record.getCellValue(statisticsField);
        let snippet = record.getCellValue(snippetField);

        if (statistics) {
            try {
                let statisticsJson = JSON.parse(statistics);

                // Extract values from statistics
                let viewCount = statisticsJson.viewCount ? parseInt(statisticsJson.viewCount, 10) : null;
                let likeCount = statisticsJson.likeCount ? parseInt(statisticsJson.likeCount, 10) : null;
                let favoriteCount = statisticsJson.favoriteCount ? parseInt(statisticsJson.favoriteCount, 10) : null;
                let commentCount = statisticsJson.commentCount ? parseInt(statisticsJson.commentCount, 10) : null;

                // Update the record with the extracted and formatted values
                await table.updateRecordAsync(record.id, {
                    [viewCountField.id]: viewCount,
                    [likeCountField.id]: likeCount,
                    [favoriteCountField.id]: favoriteCount,
                    [commentCountField.id]: commentCount
                });
            } catch (e) {
                console.log(`Error parsing statistics JSON for record ${record.id}: ${e}`);
            }
        }

        if (snippet) {
            try {
                let snippetJson = JSON.parse(snippet);

                // Extract default audio language
                let defaultAudioLanguage = snippetJson.defaultAudioLanguage ? snippetJson.defaultAudioLanguage : "";

                // Update the record with the extracted value
                await table.updateRecordAsync(record.id, {
                    [defaultAudioLanguageField.id]: defaultAudioLanguage
                });
            } catch (e) {
                console.log(`Error parsing snippet JSON for record ${record.id}: ${e}`);
            }
        }
    }
}

await extractAndFormatJSON();
