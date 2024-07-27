let settings = input.config({
    title: "Fetch Archive.org Records",
    description: `This script fetches metadata from Archive.org based on a user-defined Metadata URL and updates an Airtable table with the fetched data.`,
    items: [
        input.config.table("dataTable", {
            label: "📋 Data Table",
            description: "Select the table where the records will be stored",
        }),
        input.config.view("view", {
            parentTable: "dataTable",
            label: "👁️ View",
            description: "Select the view to limit the records processed",
        }),
        input.config.text("maxRecords", {
            label: "🔢 Max Records",
            description: "Enter the maximum number of records to fetch (1-1000)",
        }),
        input.config.field("metadataUrlField", {
            parentTable: "dataTable",
            label: "🔗 Metadata URL Field",
            description: "Select the field for the Metadata URL",
        }),
        input.config.field("downloadsField", {
            parentTable: "dataTable",
            label: "📄 Downloads Field",
            description: "Select the field for the downloads",
        }),
        input.config.field("fileSizeField", {
            parentTable: "dataTable",
            label: "📄 File Size Field",
            description: "Select the field for the file size",
        }),
        input.config.field("sponsorField", {
            parentTable: "dataTable",
            label: "📄 Sponsor Field",
            description: "Select the field for the sponsor",
        }),
        input.config.field("volumeField", {
            parentTable: "dataTable",
            label: "📄 Volume Field",
            description: "Select the field for the volume",
        }),
        input.config.field("issueField", {
            parentTable: "dataTable",
            label: "📄 Issue Field",
            description: "Select the field for the issue",
        }),
        input.config.field("ocrField", {
            parentTable: "dataTable",
            label: "📄 OCR Field",
            description: "Select the field for the OCR",
        }),
        input.config.field("rightsField", {
            parentTable: "dataTable",
            label: "📄 Rights Field",
            description: "Select the field for the rights",
        }),
        input.config.field("pdfField", {
            parentTable: "dataTable",
            label: "📄 PDF Field",
            description: "Select the field for the PDF URL",
        }),
        input.config.field("longTextField", {
            parentTable: "dataTable",
            label: "📄 Long Text Field",
            description: "Select the field for the Long Text response",
        }),
    ],
});

let {
    dataTable,
    view,
    maxRecords,
    metadataUrlField,
    downloadsField,
    fileSizeField,
    sponsorField,
    volumeField,
    issueField,
    ocrField,
    rightsField,
    pdfField,
    longTextField,
} = settings;

// Validate max records input
let maxRecordsNum = parseInt(maxRecords, 10);
if (isNaN(maxRecordsNum) || maxRecordsNum <= 0 || maxRecordsNum > 1000) {
    throw new Error('Invalid number of records. Please enter a number between 1 and 1000.');
}

// Function to fetch metadata from Archive.org
async function fetchMetadata(metadataURL) {
    let response = await fetch(metadataURL);
    if (!response.ok) throw new Error(`Failed to fetch metadata from ${metadataURL}`);
    let data = await response.json();
    console.log(`Fetched data from ${metadataURL}:`, data); // Log the fetched data
    return data;
}

// Function to check if a field exists in the table
async function checkFieldExists(table, fieldId) {
    let field = table.getField(fieldId);
    if (!field) {
        console.error(`Field '${fieldId}' does not exist in table '${table.name}'.`);
        return false;
    }
    return true;
}

// Main script logic
async function main() {
    let records = await view.selectRecordsAsync({ fields: [metadataUrlField] });

    output.text(`Found ${records.records.length} records in the view`);

    let processedCount = 0;
    let skippedCount = 0;

    // Check if all required fields exist
    let requiredFields = [metadataUrlField, downloadsField, fileSizeField, sponsorField, volumeField, issueField, ocrField, rightsField, pdfField, longTextField];
    let fieldCheckPromises = requiredFields.map(field => checkFieldExists(dataTable, field.id));
    let fieldsExist = await Promise.all(fieldCheckPromises);

    if (fieldsExist.includes(false)) {
        throw new Error('One or more required fields are missing in the table.');
    }

    for (let record of records.records) {
        let metadataURL = record.getCellValue(metadataUrlField);
        if (!metadataURL) continue;

        // Remove the dollar sign if it's mistakenly included
        metadataURL = metadataURL.replace('$', '');

        try {
            let itemData = await fetchMetadata(metadataURL);
            if (itemData && itemData.metadata) {
                let recordData = {}; // Initialize recordData as an object with an index signature
                if (itemData.metadata.downloads) recordData[downloadsField.id] = itemData.metadata.downloads;
                if (itemData.metadata.item_size) recordData[fileSizeField.id] = itemData.metadata.item_size;
                if (itemData.metadata.sponsor) recordData[sponsorField.id] = itemData.metadata.sponsor;
                if (itemData.metadata.volume) recordData[volumeField.id] = itemData.metadata.volume;
                if (itemData.metadata.issue) recordData[issueField.id] = itemData.metadata.issue;
                if (itemData.metadata.ocr) recordData[ocrField.id] = itemData.metadata.ocr;
                if (itemData.metadata.rights) recordData[rightsField.id] = itemData.metadata.rights;
                
                let pdfFile = itemData.files ? itemData.files.find(file => file.format === 'PDF' || file.name.endsWith('.pdf')) : null;
                if (pdfFile) recordData[pdfField.id] = `https://archive.org/download/${itemData.metadata.identifier}/${pdfFile.name}`;

                // Store the full response in the Long Text field
                recordData[longTextField.id] = JSON.stringify(itemData, null, 2);

                // Log the record data being processed for debugging
                console.log(`Updating record ${record.id} with data:`, recordData);

                await dataTable.updateRecordAsync(record.id, recordData);
                processedCount++;
                output.text(`Running total: Processed ${processedCount} records`);
            } else {
                skippedCount++;
                console.warn(`No metadata found for ${metadataURL}`);
            }
        } catch (error) {
            console.error(`Error processing metadata URL ${metadataURL}: ${error.message}`);
        }
    }

    output.text(`Operation complete. Processed ${processedCount} items, skipped ${skippedCount} items without files.`);
}

await main();
