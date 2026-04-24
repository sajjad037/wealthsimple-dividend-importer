# Wealthsimple Universal Dividend Importer

A robust Google Apps Script tool designed for software developers and data engineers to automate dividend tracking. This script handles the nuances of Wealthsimple's CSV exports and maps them directly into a customized Google Sheets dividend tracker.

## 🚀 Key Features

* **Format Auto-Detection:** Seamlessly handles both **Monthly Statement CSVs** and **Activity Export CSVs**.
* **Smart Ticker Matching:** Uses fuzzy logic to match tickers like `CNR` (from statements) to `CNR.TO` (in your sheet).
* **Duplicate Prevention:** Maintains an internal log (`Import_WS_TFSA_Log_DoNotDelete`) to ensure dividends are never counted twice, even if the same file is uploaded multiple times.
* **Dynamic Column Management:** Automatically detects or creates month-specific columns (e.g., `Mar-2026`) and maintains `SUM` formulas.
* **Developer UX:** Real-time progress updates via Google Sheets "Toast" notifications, including percentage and row counts.

---

## 📊 CSV Format Comparison

| Feature | Monthly Statement CSV | Activity Export CSV |
| :--- | :--- | :--- |
| **Source** | Documents > Monthly Statements | Activity Tab > Download |
| **Symbol Column** | Missing (Embedded in description) | Present (but often blank for dividends) |
| **Script Logic** | **Regex Extraction:** `match(/^([A-Z0-9\.]+)/)` | **Direct Mapping:** Uses `symbol` column |
| **Recommended?** | **Yes** (More consistent data) | No (Requires manual cleanup) |

---

## 🛠 Installation & Setup

1.  **Open Google Sheets:** Navigate to your dividend tracking spreadsheet.
2.  **Open Apps Script:** Go to `Extensions` > `Apps Script`.
3.  **Paste Code:** Copy the content of `Code.gs` from this repository into the editor.
4.  **Save & Refresh:** Save the project and refresh your Google Sheet.
5.  **Permissions:** Click the new **💰 Dividend Tools** menu and authorize the script on its first run.

## 📝 Troubleshooting & Maintenance

### Resetting the "Memory"
If you need to re-import a specific month's data:
1.  Unhide the sheet named `Import_WS_TFSA_Log_DoNotDelete`.
2.  Delete the rows corresponding to that month.
3.  Clear the values in your main tracking column and re-run the import.

### The $15.00 NAV Floor
This script is optimized for Split Share Corporations (e.g., **DFN.TO**, **ENS.TO**, **RS.TO**). Users should manually monitor the Net Asset Value (NAV) as dividends are typically suspended if the Unit NAV falls below $15.00.

---

## 👨‍💻 Developer Notes
The script is written in Google Apps Script (JavaScript) and utilizes the `Utilities.parseCsv` service for high-performance data processing. The extraction logic for tickers specifically targets the prefix before the first hyphen or space in the description field to maintain compatibility with Wealthsimple's statement nomenclature.
