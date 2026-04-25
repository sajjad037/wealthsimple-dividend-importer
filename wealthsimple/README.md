# Wealthsimple Dividend Importer

Processes Wealthsimple exports for streamlined income tracking.

## 📊 Export Instructions
* **Monthly Statements:** Download the PDF Statement -> Convert to CSV.
* **Activity Tab:** Filter for "Dividends" in the Activity tab -> Download CSV.

## ⚙️ Logic & Features
* **Regex Ticker Extraction:** Pulls ticker symbols directly from the description text.
* **Unified Integration:** Shares a menu interface with the TD tools for a centralized workflow.

## 📂 System Sheets (Internal)
* **`Import_Log_DoNotDelete`**: A persistent record of processed Wealthsimple transactions.
    * **Purpose:** Ensures idempotency. It allows you to upload overlapping monthly statements without double-counting dividends.
    * **Structure:** Records unique identifiers found in the Wealthsimple export to track processing state.