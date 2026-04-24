/**
 * TD WEB BROKER DIVIDEND IMPORTER (v6.1)
 * Optimized for: 
 * - Tax Subtraction: Automatically deducts WHTX02 from DIV/TXPDDV.
 * - Weekly Stacking: Sums multiple payments into the same monthly cell.
 * - Flex-Context: Scans Row 1 of your tab for Account ID (e.g., 46J3Y8K).
 */

const CONFIG_SHEET_NAME = "Config_TD";
const LOG_SHEET_NAME = "Import_TD_Log_DoNotDelete";

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🏦 TD Tools')
      .addItem('Import TD Activity CSV', 'showTdUploadDialog')
      .addToUi();
}

function showTdUploadDialog() {
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family: Arial; padding: 15px;">' +
    '<p><b>Select TD Activity CSV:</b></p>' +
    '<input type="file" id="file" onchange="upload(this)">' +
    '<script>' +
    'function upload(f) {' +
    '  const reader = new FileReader();' +
    '  reader.onload = function(e) {' +
    '    google.script.run.withSuccessHandler(() => { google.script.host.close(); }).startProcessing(e.target.result);' +
    '  };' +
    '  reader.readAsText(f.files[0]);' +
    '}' +
    '</script></div>'
  ).setWidth(350).setHeight(150);
  SpreadsheetApp.getUi().showModalDialog(html, 'TD Dividend Importer');
}

function startProcessing(csvContent) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  const rawLines = csvContent.split(/\r?\n/);
  
  // 1. DYNAMIC ID SEARCH (Scan Row 1)
  const firstRowValues = activeSheet.getRange("1:1").getValues()[0].map(v => v.toString().trim());
  const accountLine = rawLines[1] || "";
  const csvAccountId = (accountLine.match(/(\w+)$/) || [])[1];

  if (!firstRowValues.includes(csvAccountId)) {
    SpreadsheetApp.getUi().alert(`❌ CONTEXT ERROR\n\nCSV ID (${csvAccountId}) not found in Row 1 of this tab.\n\nPlease check that you are on the correct tab.`);
    return;
  }

  // 2. PARSE AND AGGREGATE (Net Calculation)
  const csvData = Utilities.parseCsv(rawLines.slice(3).join("\n"));
  const headers = csvData[0].map(h => h.trim().toLowerCase());
  const descIdx = headers.indexOf("description"), actionIdx = headers.indexOf("action");
  const amountIdx = headers.indexOf("net amount"), dateIdx = headers.indexOf("trade date");

  const logSheet = getOrCreateLogSheet(ss);
  const configSheet = getOrCreateConfigSheet(ss);
  
  // Group by Ticker + Date to subtract taxes from gross
  let dailyNetMap = {};

  for (let i = 1; i < csvData.length; i++) {
    const row = csvData[i];
    const action = (row[actionIdx] || "").toString().toUpperCase();
    const desc = row[descIdx].trim();
    const date = row[dateIdx];
    const amount = parseFloat(row[amountIdx]) || 0;
    const key = `${desc}|${date}`;

    if (["TXPDDV", "DIV", "FGN", "INT", "DRIP", "WHTX02"].includes(action)) {
      dailyNetMap[key] = (dailyNetMap[key] || 0) + amount;
    }
  }

  // 3. APPLY NETS TO SHEET
  let count = 0;
  for (let key in dailyNetMap) {
    if (dailyNetMap[key] <= 0) continue; // Skip if tax exceeds dividend or zero

    const [fullDesc, dateStr] = key.split("|");
    const ticker = getTickerWithCache(fullDesc, configSheet);
    const netAmount = dailyNetMap[key];
    
    // Idempotency check
    const transId = `TD_${csvAccountId}_${ticker}_${dateStr}_${netAmount.toFixed(2)}`;
    if (isDuplicate(logSheet, transId)) continue;

    updateTargetSheet(activeSheet, ticker, netAmount, normalizeMonthYear(new Date(dateStr)));
    logSheet.appendRow([new Date(), transId, ticker, netAmount, activeSheet.getName()]);
    count++;
  }
  
  ss.toast("Import Complete!", "TD Tools");
  SpreadsheetApp.getUi().alert(`✅ Success: Imported ${count} NET dividend entries into ${activeSheet.getName()}.`);
}

/** TICKER RESOLUTION **/
function getTickerWithCache(description, configSheet) {
  const data = configSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === description) return data[i][1];
  }

  let tickerGuess = description;
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(description)}`;
    const result = JSON.parse(UrlFetchApp.fetch(url).getContentText());
    tickerGuess = (result.quotes && result.quotes.length > 0) ? result.quotes[0].symbol.replace(".TO", "") : description;
  } catch (e) {}

  configSheet.appendRow([description, tickerGuess]); 
  return tickerGuess;
}

/** UPDATE SHEET (Additive logic for weekly payments) **/
function updateTargetSheet(sheet, ticker, amount, monthYear) {
  const data = sheet.getDataRange().getValues();
  const headers = data[2].map(h => normalizeMonthYear(h)); 
  let sumColIdx = data[2].indexOf("Sum");
  let rowIdx = -1, maxSerial = 0, totalRowIdx = -1;

  for (let r = 0; r < data.length; r++) {
    const colB = (data[r][1] || "").toString().trim();
    const serial = parseInt(data[r][0]);
    if (!isNaN(serial)) maxSerial = Math.max(maxSerial, serial);
    if (colB.toLowerCase().includes("total")) totalRowIdx = r + 1;
    if (r >= 3 && colB === ticker) rowIdx = r;
  }

  if (rowIdx === -1) {
    if (totalRowIdx === -1) totalRowIdx = sheet.getLastRow() + 1;
    sheet.insertRowBefore(totalRowIdx);
    sheet.getRange(totalRowIdx, 1).setValue(maxSerial + 1);
    sheet.getRange(totalRowIdx, 2).setValue(ticker);
    if (sumColIdx !== -1) {
      const sumRange = sheet.getRange(totalRowIdx, 3, 1, sumColIdx - 2).getA1Notation();
      sheet.getRange(totalRowIdx, sumColIdx + 1).setFormula(`=SUM(${sumRange})`);
    }
    rowIdx = totalRowIdx - 1;
  }

  let colIdx = headers.indexOf(monthYear);
  if (colIdx === -1) {
    const insertColAt = sumColIdx !== -1 ? sumColIdx + 1 : sheet.getLastColumn() + 1;
    sheet.insertColumnBefore(insertColAt);
    sheet.getRange(3, insertColAt).setValue(monthYear);
    colIdx = insertColAt - 1;
  }

  const cell = sheet.getRange(rowIdx + 1, colIdx + 1);
  const existing = parseFloat(cell.getValue()) || 0;
  cell.setValue(existing + amount);
}

function normalizeMonthYear(input) {
  if (input instanceof Date) return Utilities.formatDate(input, "GMT", "MMM-yyyy");
  return input ? input.toString().trim() : "";
}

function getOrCreateConfigSheet(ss) {
  let sheet = ss.getSheetByName(CONFIG_SHEET_NAME) || ss.insertSheet(CONFIG_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(["Full TD Description", "Mapped Ticker"]);
  return sheet;
}

function getOrCreateLogSheet(ss) {
  let log = ss.getSheetByName(LOG_SHEET_NAME) || ss.insertSheet(LOG_SHEET_NAME);
  if (log.getLastRow() === 0) log.appendRow(["Timestamp", "UniqueID", "Ticker", "Amount", "Tab"]).hideSheet();
  return log;
}

function isDuplicate(logSheet, id) {
  const ids = logSheet.getRange("B:B").getValues().flat();
  return ids.includes(id);
}
