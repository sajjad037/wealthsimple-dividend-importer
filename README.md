# Dividend Tracker Tools Suite

A collection of Google Apps Script automations designed to streamline dividend tracking across multiple Canadian brokerages. These tools are built to handle high-yield ETFs, multi-currency accounts, and automated ticker resolution.

## 📁 Repository Structure

* **/wealthsimple**: Universal Dividend Importer for Wealthsimple CSV exports (Monthly Statements and Activity).
* **/td-web-broker**: Tax-Aware Dividend Importer for TD Web Broker Activity exports.

---

## 🏦 TD Web Broker Importer

### 📊 Supported Export
**Activity CSV** only. 
1. Log in to TD Web Broker.
2. Select your account and navigate to the "Activity" tab.
3. Filter your desired date range and click the "Download CSV" icon.

### ⚙️ Setup & Validation
* **Account Verification:** The script scans **Row 1** of your active tab for the Account ID (e.g., `46J3Y8J`, `46J3Y8U`, or `46J3Y8K`). If the ID in the CSV doesn't match a value in Row 1, the script will stop to prevent data corruption.
* **Tax Handling:** Automatically detects `WHTX02` (Withholding Tax) and subtracts it from the gross dividend amount. Only the **Net Dividend** is recorded.
* **Weekly Stacking:** For stocks that pay weekly, the script adds new values to the existing cell for that month rather than overwriting it.

### 🧠 The `Config_TD` Sheet
This tool uses a "Self-Learning" cache system:
1. The script first checks the `Config_TD` tab for a ticker mapping.
2. If unknown, it uses an API to guess the ticker and appends it to the `Config_TD` sheet.
3. **Manual Correction:** If a guess is incorrect, simply edit the "Mapped Ticker" in the `Config_TD` sheet once. The script will remember your correction for all future imports.

---

## 💰 Wealthsimple Importer
* **Flexibility:** Supports both the Monthly Statement format and the Activity tab export.
* **Smart Extraction:** Uses Regex to pull tickers directly from descriptions.
* **Duplicate Prevention:** Utilizes an internal log to ensure every dividend is only counted once.
