If you prefer to just import a full JSON blob from YouTube, you can use that and `REGEX_EXTRACT` formulas in Airtable. That way you can parse the text and pull out the important stuff you wnat to analyze.

# Step 1: Import JSON

The default Airtable "YouTube Analytics" script will let you grab stuff from YouTube's API. My blunt object approach is to just use this to plop the JSON blob into a Long Text field. 

1. Create fields for each YouTube response. I usually just start with `snippet` and `statistics`.
2. In Airtable Extensions, search for `youtube` and add the `Import YouTube Analytics` script.
3. Add your YouTube API key to the script, and map all the fields. For example, `snippet`.
4. Duplicate that YouTube script extension, and this time map the fields for `statistics`.
5. Run the scripts

# Step 2: Parse with REGEX

## snippet

### Title
Quick and dirty from the `snippet` blob as a Formula field in Airtable:

`REGEX_EXTRACT({snippet}, '"title":"([^"]*)"')`

### Description

Quick and dirty from the `snippet` blob as a Formula field in Airtable:

`REGEX_EXTRACT({snippet}, '"description":"([^"]*)"')`

### Thumbnail URLs

Annoyingly, there are multiple types of thumbnails. I start with `maxres`, which is the highest-fidelity one:

`REGEX_EXTRACT({snippet}, '"maxres":{"url":"([^"]*)"')`

Then I run the Airtable "URL to attachments" script to convert the URL to an attachment. Mainly so I can have prettier galleries. I'm painfully visual, so I like having pretty pictures. Easier to visually scan a large pile of videos this way.

### Published Date

Quick and dirty from the `snippet` blob as a Formula field in Airtable:

`REGEX_EXTRACT({snippet}, '"publishedAt":"([^"]*)"')`

## statistics

### Views

Extract from the `statistics` blob as a Formula field in Airtable:

`IF(
    VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) < 1000, 
    VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')),
    IF(
        AND(VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) >= 1000, VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) < 1000000),
        CONCATENATE(LEFT(VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) & "", LEN(VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) & "") - 3), ",", RIGHT(VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) & "", 3)),
        IF(
            AND(VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) >= 1000000, VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) < 1000000000),
            CONCATENATE(
                LEFT(VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) & "", LEN(VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) & "") - 6), ",",
                MID(VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) & "", LEN(VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) & "") - 5, 3), ",",
                RIGHT(VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) & "", 3)
            ),
            CONCATENATE(
                LEFT(VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) & "", LEN(VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) & "") - 9), ",",
                MID(VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) & "", LEN(VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) & "") - 8, 3), ",",
                MID(VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) & "", LEN(VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) & "") - 5, 3), ",",
                RIGHT(VALUE(REGEX_EXTRACT({statistics}, '"viewCount":"([^"]*)"')) & "", 3)
            )
        )
    )
)
`

### Comment Count

Extract from the `statistics` blob as a Formula field in Airtable:

`IF(
    VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) < 1000, 
    VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')),
    IF(
        AND(VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) >= 1000, VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) < 1000000),
        CONCATENATE(LEFT(VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) & "", LEN(VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) & "") - 3), ",", RIGHT(VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) & "", 3)),
        IF(
            AND(VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) >= 1000000, VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) < 1000000000),
            CONCATENATE(
                LEFT(VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) & "", LEN(VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) & "") - 6), ",",
                MID(VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) & "", LEN(VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) & "") - 5, 3), ",",
                RIGHT(VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) & "", 3)
            ),
            CONCATENATE(
                LEFT(VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) & "", LEN(VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) & "") - 9), ",",
                MID(VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) & "", LEN(VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) & "") - 8, 3), ",",
                MID(VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) & "", LEN(VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) & "") - 5, 3), ",",
                RIGHT(VALUE(REGEX_EXTRACT({statistics}, '"commentCount":"([^"]*)"')) & "", 3)
            )
        )
    )
)
`

### Like Count

Extract from the `statistics` blob as a Formula field in Airtable:

`IF(
    VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) < 1000, 
    VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')),
    IF(
        AND(VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) >= 1000, VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) < 1000000),
        CONCATENATE(LEFT(VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) & "", LEN(VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) & "") - 3), ",", RIGHT(VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) & "", 3)),
        IF(
            AND(VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) >= 1000000, VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) < 1000000000),
            CONCATENATE(
                LEFT(VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) & "", LEN(VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) & "") - 6), ",",
                MID(VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) & "", LEN(VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) & "") - 5, 3), ",",
                RIGHT(VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) & "", 3)
            ),
            CONCATENATE(
                LEFT(VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) & "", LEN(VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) & "") - 9), ",",
                MID(VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) & "", LEN(VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) & "") - 8, 3), ",",
                MID(VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) & "", LEN(VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) & "") - 5, 3), ",",
                RIGHT(VALUE(REGEX_EXTRACT({statistics}, '"likeCount":"([^"]*)"')) & "", 3)
            )
        )
    )
)
`
