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
    let outputData = [];

    // Loop through each record
    for (let record of query.records) {
        // Parse the JSON fields
        let statistics = record.getCellValue(statisticsField);
        let snippet = record.getCellValue(snippetField);

        let viewCount, likeCount, favoriteCount, commentCount, defaultAudioLanguage;

        if (statistics) {
            try {
                let statisticsJson = JSON.parse(statistics);

                // Extract values from statistics
                viewCount = statisticsJson.viewCount ? parseInt(statisticsJson.viewCount, 10) : null;
                likeCount = statisticsJson.likeCount ? parseInt(statisticsJson.likeCount, 10) : null;
                favoriteCount = statisticsJson.favoriteCount ? parseInt(statisticsJson.favoriteCount, 10) : null;
                commentCount = statisticsJson.commentCount ? parseInt(statisticsJson.commentCount, 10) : null;

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
                defaultAudioLanguage = snippetJson.defaultAudioLanguage ? snippetJson.defaultAudioLanguage : "";

                // Update the record with the extracted value
                await table.updateRecordAsync(record.id, {
                    [defaultAudioLanguageField.id]: defaultAudioLanguage
                });
            } catch (e) {
                console.log(`Error parsing snippet JSON for record ${record.id}: ${e}`);
            }
        }

        // Add data to output table
        outputData.push({
            RecordID: record.id,
            ViewCount: viewCount,
            LikeCount: likeCount,
            FavoriteCount: favoriteCount,
            CommentCount: commentCount,
            DefaultAudioLanguage: defaultAudioLanguage
        });

        // Periodically update the output to show progress
        if (outputData.length % 10 === 0) {
            output.clear();
            output.markdown(`Processed ${outputData.length} records so far...`);
            output.table(outputData);
        }
    }

    // Final output
    output.clear();
    output.markdown(`Processed all records.`);
    output.table(outputData);
    output.text('Update complete.');
}

await extractAndFormatJSON();
