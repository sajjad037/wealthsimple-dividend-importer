# TD Web Broker Dividend Importer

Automates dividend extraction from TD "Activity" exports with advanced handling for taxes and exchange rate noise.

## 📊 Export Instructions
1. Log in to **TD Web Broker**.
2. Go to the **Activity** tab for your specific account.
3. Filter the **Date Range** and download the **CSV**.

## ⚙️ Logic & Features
* **Tax Matching:** Subtracts `WHTX02` (Withholding Tax) from gross dividends for net reporting.
* **Scrubbing:** Strips "CONVERT TO CAD @..." strings from descriptions for clean stock grouping.
* **Date Integrity:** Injects real Date Objects into headers to prevent month-jumping errors.

## 📂 System Sheets (Internal)
* **`Config_TD`**: This is the script's memory. If a ticker is guessed incorrectly, change it here. The script will always check this sheet before using the API.
* **`Import_TD_Log_DoNotDelete`**: A hidden registry of every imported transaction. 
    * **Purpose:** Prevents duplicate entries. If you upload the same CSV twice, the script checks this log and skips transactions it has already seen.
    * **Maintenance:** Do not delete rows unless you want to "reset" the history and re-import data.