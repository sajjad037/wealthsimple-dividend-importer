# TD Web Broker Dividend Importer (v6.1)

A specialized Google Apps Script tool designed to automate dividend income tracking from TD Web Broker Activity exports. This script is engineered to handle multi-currency portfolios (CAD/USD), non-resident withholding taxes, and high-frequency (weekly) dividend distributions.

## 📊 Supported Export Type

This script exclusively expects the **Activity CSV** export from TD Web Broker. 

### How to Export from TD:
1.  Log in to **TD Web Broker**.
2.  Navigate to the **Activity** tab of the specific account you want to track.
3.  Set your desired **Date Range** (e.g., the last 1 month).
4.  Click the **Download CSV** icon at the top right of the transaction list.
5.  *Note:* Do **not** use the "Gains" or "Holdings" export for this tool.

---

## 🛠 Features for Data Integrity

* **Tax-Aware Processing:** Automatically identifies `WHTX02` (Withholding Tax) entries and subtracts them from the gross dividend (`DIV` or `TXPDDV`) for the same stock on the same day. It logs only the **Net Dividend**.
* **Weekly Payment Stacking:** Designed for yield-focused ETFs. If a stock pays weekly, the script sums all net payments for that month into a single cell.
* **Idempotency (No Duplicates):** Uses a hidden log sheet (`Import_TD_Log_DoNotDelete`) to track unique transaction IDs. You can upload overlapping CSVs without doubling your numbers.
* **Self-Learning Ticker Mapping:** Uses a search API to resolve TD's long descriptions into clean tickers (e.g., mapping "TIDAL YLDMAX MSTR OPT ETF" to "MSTY").

---

## ⚙️ Configuration & Tab Setup

### 1. Account Identification (Row 1)
The script uses a "Safety First" context check to ensure you don't upload data into the wrong portfolio.
* Every tab (e.g., `SumbalTFSA`, `SumbalRSSP`, `JointTFSA`) **must** have its corresponding TD Account ID typed into **any cell in Row 1**.
* **Current IDs:**
    * SumbalTFSA: `46J3Y8J`
    * SumbalRSSP: `46J3Y8U`
    * JointTFSA: `46J3Y8K`
* **Future Accounts:** To add a new account, simply create the tab, type the new Account ID in Row 1, and the script will automatically recognize it.

### 2. The `Config_TD` Sheet
This sheet acts as the "Memory" for the script. 
* The first time the script sees a new stock, it uses an API to guess the ticker and adds it to this sheet.
* **How to Correct:** If the API guesses wrong, simply go to the `Config_TD` sheet and edit the "Mapped Ticker" cell for that description. The script will use your manual correction for all future imports.

---

## 👨‍💻 Installation

1.  Open your Google Sheet and go to `Extensions` > `Apps Script`.
2.  Create a new file named `TD_Importer.gs` and paste the script code.
3.  Refresh your spreadsheet to see the **🏦 TD Tools** menu.
4.  Ensure your Account IDs are present in Row 1 of your target tabs before running.
