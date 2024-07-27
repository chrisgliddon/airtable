let settings = input.config({
    title: "Calculate Attachment File Sizes",
    description: `This script calculates the total size of attachments in a specified field and stores the result in another field.`,
    items: [
        input.config.table("table", { label: "Select the table" }),
        input.config.view("view", {
            parentTable: "table",
            label: "Select the view"
        }),
        input.config.field("attachmentField", {
            parentTable: "table",
            label: "Select the attachment field",
            description: "Field containing the attachments"
        }),
        input.config.field("fileSizeField", {
            parentTable: "table",
            label: "Select the file size field",
            description: "Field to store the total file size"
        }),
    ]
});

async function calculateAttachmentFileSizes() {
    let { table, view, attachmentField, fileSizeField } = settings;

    // Check if the fileSizeField is a number field
    if (fileSizeField.type !== "number") {
        output.text(
            `${fileSizeField.name} is not a number field.\nRun the script again when you have a number field.`
        );
        return;
    }

    let records = await view.selectRecordsAsync({ fields: [attachmentField, fileSizeField] });

    let updates = [];
    for (let record of records.records) {
        let attachments = record.getCellValue(attachmentField) || [];
        let totalSize = attachments.reduce((acc, attachment) => acc + attachment.size, 0);
        
        updates.push({
            id: record.id,
            fields: {
                [fileSizeField.id]: totalSize
            }
        });
    }

    for (let i = 0; i < updates.length; i += 50) {
        await table.updateRecordsAsync(updates.slice(i, i + 50));
    }

    output.text('Filesize calculation completed.');
}

await calculateAttachmentFileSizes();
