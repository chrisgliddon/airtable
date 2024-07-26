// Script to convert the text in a source field to title case in a destination field

// Function to convert string to title case
function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

// Get the table name from the user
let table = await input.tableAsync("Select the table");

// Get the source field from the user
let sourceField = await input.fieldAsync("Select the source field with keywords", table);

// Get the destination field from the user
let destinationField = await input.fieldAsync("Select the destination field for title case names", table);

let query = await table.selectRecordsAsync({
    fields: [sourceField, destinationField]
});

let updates = [];
for (let record of query.records) {
    let sourceValue = record.getCellValueAsString(sourceField);
    let titleCaseValue = toTitleCase(sourceValue);

    updates.push({
        id: record.id,
        fields: {
            [destinationField.id]: titleCaseValue
        }
    });
}

// Perform the updates in batches
while (updates.length > 0) {
    await table.updateRecordsAsync(updates.slice(0, 50));
    updates = updates.slice(50);
}

output.markdown('Conversion to title case complete!');
