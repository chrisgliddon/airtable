# Airtable Tools
Airtable scripts and tools for analyzing YouTube videos and more. My goal is to make it easier to mangle small datasets within Airtable.

## License
MIT permissive license, have fun. If you do something cool, show me! If you appreciate the work, feel free to link back to this repo so others can benefit.

## Requirements
- Airtable: paid account with access to the Extensions feature
- YouTube v3 API: from Google Cloud Platform
- OpenAI API: an account with access to OpenAI Playground

## How to set up in Airtable Extensions
1. Open the Extensions right side bar (top right under "share")
2. Add an extension
3. Choose "Scripting"
4. Click Add Extension
5. Click Get Started
6. Click "Start from scratch"
7. Erase the 4 lines of example code from the top-left Code Editor
8. Copy/paste a single Script's code into this Airtable Code Editor
9. Click Finish Editing
10. In the top-left, Airtable will name a new this block "Scripting", but you can rename this. There's a little drop-down to the right of the word Scripting where you can choose "Rename extension". I like to give these scripts meaningful names, like what you're using it for.
11. I usually create a Dashboard for each task I'm doing. For example, I'll usually create a CSV Import dashboard and a Dedupe dashboard.
12. Now you can 'reload' the extension without the extension to see what the Script looks like.
13. For these scripts, I prefer to let you fill out fields so you can change the configuration as needed.
14. If there are any bugs, just throw an Issue into this GitHub repo.
15. Good luck! Hope these help. 

## List of scripts
1. Search YouTube for topic and return video URLs to Airtable
2. Import YouTube stats and thumbnails for videos
3. Import YouTube channel stats including subscriber count and thumbnail
4. Shorten video titles and un-clickbait them via OpenAI. This helps make galleries look prettier in Airtable if you want the video title to be the primary field of a table.
