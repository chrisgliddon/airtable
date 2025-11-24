let settings = input.config({
    title: "Trim Trailing Whitespaces",
    description: "Remove trailing whitespaces from text fields",
    items: [
        input.config.table("table", {
            label: "📄 Table",
            description: "Select the table to process"
        }),
        input.config.view("view", {
            parentTable: "table",
            label: "👁️ View",
            description: "Select the view to limit records"
        }),
        input.config.field("field", {
            parentTable: "table",
            label: "✂️ Field to Trim",
            description: "Select the text field to trim whitespaces from"
        })
    ]
});

let { table, view, field } = settings;

// Fetch records
let query = await view.selectRecordsAsync({ fields: [field] });

let updates = [];
let trimmedCount = 0;

for (let record of query.records) {
    let value = record.getCellValueAsString(field);
    let trimmed = value.trimEnd(); // Removes trailing whitespaces
    
    if (value !== trimmed) {
        updates.push({
            id: record.id,
            fields: { [field.id]: trimmed }
        });
        trimmedCount++;
    }
}

// Update in batches of 50
while (updates.length > 0) {
    await table.updateRecordsAsync(updates.slice(0, 50));
    updates = updates.slice(50);
}

output.text(`✅ Trimmed ${trimmedCount} records`);
