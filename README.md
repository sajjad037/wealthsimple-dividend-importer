# Dividend Tracker Tools Suite

A collection of Google Apps Script automations designed to streamline dividend tracking across multiple Canadian brokerages.

## 📁 Repository Structure

* **/wealthsimple**: Contains the Universal Dividend Importer for Wealthsimple CSV exports (Monthly Statements and Activity).
* **/td-web-broker**: Contains the Tax-Aware Dividend Importer for TD Web Broker Activity exports.

---

## 🏦 TD Web Broker Importer (v6.1)

### 📊 Supported Export
**Activity CSV** only. Download this from the "Activity" tab in TD Web Broker.

### ⚙️ Setup
1.  **Account Validation:** Type your TD Account ID (e.g., `46J3Y8J`, `46J3Y8U`, or `46J3Y8K`) into **Row 1** of your target tab.
2.  **Config Sheet:** The script creates a `Config_TD` tab to remember ticker mappings. If a ticker is wrong, fix it there.
3.  **Tax Handling:** Automatically subtracts `WHTX02` from dividends to record net income.

---

## 💰 Wealthsimple Importer
* **Formats:** Supports both Statement and Activity CSVs.
* **Regex:** Extracts tickers from descriptions automatically.
