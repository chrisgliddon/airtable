let settings = input.config({
    title: "Fetch Archive.org Records",
    description: `This script searches Archive.org for items based on a user-defined search string and updates an Airtable table with the fetched data.`,
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
        input.config.text("searchString", {
            label: "🔍 Search String",
            description: "Enter the search string to use for Archive.org",
        }),
        input.config.text("maxRecords", {
            label: "🔢 Max Records",
            description: "Enter the maximum number of records to fetch (1-1000)",
        }),
        input.config.select("searchLanguage", {
            label: "🌐 Search Language",
            description: "Select the language for the search",
            options: [
                { label: "English", value: "en" },
                { label: "Japanese", value: "jpn" }
            ],
        }),
        input.config.field("identifierField", {
            parentTable: "dataTable",
            label: "📄 Identifier Field",
            description: "Select the field for the identifier",
        }),
        input.config.field("titleField", {
            parentTable: "dataTable",
            label: "📄 Title Field",
            description: "Select the field for the title",
        }),
        input.config.field("creatorField", {
            parentTable: "dataTable",
            label: "📄 Creator Field",
            description: "Select the field for the creator",
        }),
        input.config.field("languageField", {
            parentTable: "dataTable",
            label: "📄 Language Field",
            description: "Select the field for the language",
        }),
        input.config.field("publicDateField", {
            parentTable: "dataTable",
            label: "📄 Public Date Field",
            description: "Select the field for the public date",
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
        input.config.field("ppiField", {
            parentTable: "dataTable",
            label: "📄 PPI Field",
            description: "Select the field for the PPI",
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
        input.config.field("lccnField", {
            parentTable: "dataTable",
            label: "📄 LCCN Field",
            description: "Select the field for the LCCN",
        }),
        input.config.field("uploaderField", {
            parentTable: "dataTable",
            label: "📄 Uploader Field",
            description: "Select the field for the uploader",
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
        input.config.field("collectionField", {
            parentTable: "dataTable",
            label: "📄 Collection Field",
            description: "Select the field for the collection",
        }),
        input.config.field("pdfField", {
            parentTable: "dataTable",
            label: "📄 PDF Field",
            description: "Select the field for the PDF URL",
        }),
        input.config.field("ocrTextField", {
            parentTable: "dataTable",
            label: "📄 OCR Text Field",
            description: "Select the field for the OCR text",
        }),
    ],
});

let {
    dataTable,
    searchString,
    maxRecords,
    searchLanguage,
    identifierField,
    titleField,
    creatorField,
    languageField,
    publicDateField,
    downloadsField,
    fileSizeField,
    ppiField,
    sponsorField,
    volumeField,
    issueField,
    lccnField,
    uploaderField,
    ocrField,
    rightsField,
    collectionField,
    pdfField,
    ocrTextField
} = settings;

// Validate max records input
let maxRecordsNum = parseInt(maxRecords, 10);
if (isNaN(maxRecordsNum) || maxRecordsNum <= 0 || maxRecordsNum > 1000) {
    throw new Error('Invalid number of records. Please enter a number between 1 and 1000.');
}

// Function to fetch search results from Archive.org
async function fetchArchiveResults(searchString, maxRecordsNum, searchLanguage) {
    let searchURL = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(searchString)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=language&fl[]=publicdate&fl[]=downloads&fl[]=filesize&fl[]=ppi&fl[]=sponsor&fl[]=volume&fl[]=issue&fl[]=lccn&fl[]=uploader&fl[]=ocr&fl[]=rights&fl[]=collection&output=json&rows=${maxRecordsNum}&lang=${searchLanguage}`;
    let response = await fetch(searchURL);
    if (!response.ok) throw new Error('Failed to fetch search results from Archive.org.');
    let data = await response.json();
    return data.response.docs;
}

// Function to fetch item metadata and OCR text
async function fetchItemData(identifier) {
    let itemURL = `https://archive.org/details/${identifier}`;
    let filesURL = `https://archive.org/metadata/${identifier}`;

    let itemResponse = await fetch(filesURL);
    if (!itemResponse.ok) throw new Error(`Failed to fetch metadata for ${identifier}`);
    let itemData = await itemResponse.json();
    let files = itemData.files;

    let pdfFile = files.find(file => file.format === 'PDF');
    let ocrFile = files.find(file => file.format === 'Text');

    // Fetch OCR text if available
    let ocrText = '';
    if (ocrFile && ocrFile.url) {
        let ocrResponse = await fetch(ocrFile.url);
        if (ocrResponse.ok) {
            ocrText = await ocrResponse.text();
        }
    }

    return {
        identifier: identifier,
        title: itemData.metadata.title || identifier,
        creator: itemData.metadata.creator || '',
        language: itemData.metadata.language || '',
        publicdate: itemData.metadata.publicdate || '',
        downloads: itemData.metadata.downloads || '',
        filesize: itemData.metadata.filesize || '',
        ppi: itemData.metadata.ppi || '',
        sponsor: itemData.metadata.sponsor || '',
        volume: itemData.metadata.volume || '',
        issue: itemData.metadata.issue || '',
        lccn: itemData.metadata.lccn || '',
        uploader: itemData.metadata.uploader || '',
        ocr: itemData.metadata.ocr || '',
        rights: itemData.metadata.rights || '',
        collection: Array.isArray(itemData.metadata.collection) ? itemData.metadata.collection : [],
        itemURL: itemURL,
        pdfURL: pdfFile ? pdfFile.url : '',
        ocrText: ocrText
    };
}

// Function to get or create collection records
async function getOrCreateCollections(collectionNames, collectionTable) {
    let collectionRecords = {};
    let existingRecords = await collectionTable.selectRecordsAsync();

    // Check existing records
    for (let record of existingRecords.records) {
        let collectionName = record.getCellValueAsString('Name');
        if (collectionNames.includes(collectionName)) {
            collectionRecords[collectionName] = record.id;
        }
    }

    // Create new records for missing collections
    for (let collectionName of collectionNames) {
        if (!collectionRecords[collectionName]) {
            let newRecord = await collectionTable.createRecordAsync({
                'Name': collectionName
            });
            collectionRecords[collectionName] = newRecord.id;
        }
    }

    return collectionRecords;
}

// Main script logic
async function main() {
    let results = await fetchArchiveResults(searchString, maxRecordsNum, searchLanguage);
    output.text(`Fetched ${results.length} results from Archive.org`);

    let processedCount = 0;

    // Assume the collection table is named "Collections"
    let collectionTable = base.getTable('Collections');

    for (let result of results) {
        try {
            let itemData = await fetchItemData(result.identifier);
            if (itemData.itemURL) {
                let collectionNames = itemData.collection;
                let collectionRecords = await getOrCreateCollections(collectionNames, collectionTable);

                let collectionRecordIds = collectionNames.map(name => ({ id: collectionRecords[name] }));

                let recordData = {
                    [identifierField.id]: itemData.identifier,
                    [titleField.id]: itemData.title,
                    [creatorField.id]: itemData.creator,
                    [languageField.id]: itemData.language,
                    [publicDateField.id]: itemData.publicdate,
                    [downloadsField.id]: itemData.downloads,
                    [fileSizeField.id]: itemData.filesize,
                    [ppiField.id]: itemData.ppi,
                    [sponsorField.id]: itemData.sponsor,
                    [volumeField.id]: itemData.volume,
                    [issueField.id]: itemData.issue,
                    [lccnField.id]: itemData.lccn,
                    [uploaderField.id]: itemData.uploader,
                    [ocrField.id]: itemData.ocr,
                    [rightsField.id]: itemData.rights,
                    [collectionField.id]: collectionRecordIds,
                    [pdfField.id]: itemData.pdfURL,
                    [ocrTextField.id]: itemData.ocrText
                };

                await dataTable.createRecordAsync(recordData);
                processedCount++;
                output.text(`Running total: Processed ${processedCount} records`);
            }
        } catch (error) {
            console.error(`Error processing item ${result.identifier}: ${error.message}`);
        }
    }

    output.text(`Operation complete. Processed ${processedCount} items.`);
}

await main();
