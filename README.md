# Dividend Tracker Tools Suite

A professional automation suite for managing Canadian brokerage dividend data in Google Sheets.

## 📁 Structure
* **/wealthsimple**: Supports Statement and Activity CSVs.
* **/td-web-broker**: Supports Activity CSVs with tax and scrubbing logic.

## 🛠 Management & Maintenance
### The Log Sheets
Both tools utilize hidden **Log** sheets (prefixed with `Import_`). These act as a "Database Index."
* **Never delete these sheets** if you want to avoid duplicate entries when re-uploading files.
* Each entry is assigned a unique fingerprint based on the account, ticker, date, and amount.

### Ticker Mapping (`Config_TD`)
The TD tool maintains a mapping sheet to handle long institutional descriptions. Users can manually override any ticker mapping here to "train" the script for future imports.

## 🚀 Setup
1. Copy the `.gs` scripts into your Spreadsheet's Apps Script editor.
2. Ensure each portfolio tab has the **Account ID** in **Row 1**.
3. Use the custom menus to process your CSV exports.