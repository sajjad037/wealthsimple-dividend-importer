/**
 * TD WEB BROKER DIVIDEND IMPORTER (v6.5)
 * - Fixed: Progress Bar logic.
 * - Fixed: Forced Date Object headers to prevent "Jun-2026" jump.
 */

const TD_CONFIG_NAME = "Config_TD";
const TD_LOG_NAME = "Import_TD_Log_DoNotDelete";

/**
 * MASTER MENU LOADER
 * This function creates BOTH menus at once.
 * IMPORTANT: Delete any 'onOpen' functions in your other .gs files.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  // 1. Create the Wealthsimple Menu
  // Replace 'showUploadDialog' with the exact name of the function in your WS script
  ui.createMenu('💰 WS Tools')
      .addItem('Import Wealthsimple CSV', 'importMonthlyDividends') 
      .addToUi();

  // 2. Create the TD Menu
  ui.createMenu('🏦 TD Tools')
      .addItem('Import TD Activity CSV', 'showTdUploadDialog')
      .addToUi();
}

function showTdUploadDialog() {
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family: Arial; padding: 15px;"><p><b>Select TD Activity CSV:</b></p>' +
    '<input type="file" id="file" onchange="upload(this)">' +
    '<script>function upload(f) { const reader = new FileReader(); reader.onload = function(e) { ' +
    'google.script.run.withSuccessHandler(() => { google.script.host.close(); }).startProcessing(e.target.result); }; ' +
    'reader.readAsText(f.files[0]); }</script></div>'
  ).setWidth(350).setHeight(150);
  SpreadsheetApp.getUi().showModalDialog(html, 'TD Dividend Importer');
}

function startProcessing(csvContent) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  const rawLines = csvContent.split(/\r?\n/);
  
  // 1. Account ID Check
  const accountLine = rawLines[1] || "";
  const csvAccountId = (accountLine.match(/(\w+)$/) || [])[1];
  const row1Values = activeSheet.getRange("1:1").getValues()[0].map(v => v.toString().trim());

  if (!row1Values.includes(csvAccountId)) {
    SpreadsheetApp.getUi().alert("❌ ID Mismatch: CSV shows " + csvAccountId + " but not found in Row 1.");
    return;
  }

  // 2. Parse CSV
  const csvData = Utilities.parseCsv(rawLines.slice(3).join("\n"));
  if (csvData.length < 2) return;

  const headers = csvData[0].map(h => h.trim().toLowerCase());
  const descIdx = headers.indexOf("description");
  const actionIdx = headers.indexOf("action");
  const amountIdx = headers.indexOf("net amount");
  const dateIdx = 0; // Trade Date

  const logSheet = getOrCreateLogSheet(ss);
  const configSheet = getOrCreateConfigSheet(ss);
  let dailyNetMap = {};

  // 3. Process Rows
  for (let i = 1; i < csvData.length; i++) {
    const row = csvData[i];
    if (!row[dateIdx] || row[dateIdx].trim() === "") continue;

    if (i % 10 === 0) ss.toast("Step 1: Reading CSV (" + Math.round((i/csvData.length)*100) + "%)");

    const action = (row[actionIdx] || "").toString().toUpperCase();
    let desc = (row[descIdx] || "").trim().replace(/\s+CONVERT TO\s+\w+\s+@\s+[\d\.]+/gi, "");
    
    // Parse Date Parts: "31 Mar 2026"
    const dParts = row[dateIdx].split(" ");
    if (dParts.length < 3) continue;
    
    const day = parseInt(dParts[0]);
    const monthStr = dParts[1].substring(0,3).toLowerCase();
    const year = parseInt(dParts[2]);
    const monthMap = {'jan':0,'feb':1,'mar':2,'apr':3,'may':4,'jun':5,'jul':6,'aug':7,'sep':8,'oct':9,'nov':10,'dec':11};
    const monthIdx = monthMap[monthStr];

    if (monthIdx === undefined) continue;

    // Create a normalized key for grouping
    const dateKey = `${day}-${monthIdx}-${year}`;
    const key = `${desc}|${dateKey}|${monthIdx}|${year}`;

    if (["TXPDDV", "DIV", "FGN", "INT", "DRIP", "WHTX02"].includes(action)) {
      const amt = parseFloat(row[amountIdx]) || 0;
      dailyNetMap[key] = (dailyNetMap[key] || 0) + amt;
    }
  }

  // 4. Update Sheet
  let count = 0;
  const keys = Object.keys(dailyNetMap);
  for (let j = 0; j < keys.length; j++) {
    const key = keys[j];
    if (dailyNetMap[key] === 0) continue;

    ss.toast("Step 2: Updating Sheet (" + Math.round((j/keys.length)*100) + "%)");

    const [desc, dateKey, mIdx, yr] = key.split("|");
    const ticker = getTickerWithCache(desc, configSheet);
    const amount = dailyNetMap[key];
    
    const transId = `TD_${csvAccountId}_${ticker}_${dateKey}_${amount.toFixed(2)}`;
    if (isDuplicate(logSheet, transId)) continue;

    updateTargetSheet(activeSheet, ticker, amount, parseInt(mIdx), parseInt(yr));
    logSheet.appendRow([new Date(), transId, ticker, amount, activeSheet.getName()]);
    count++;
  }
  ss.toast("✅ Done! Imported " + count + " entries.");
}

function updateTargetSheet(sheet, ticker, amount, mIdx, yr) {
  const data = sheet.getDataRange().getValues();
  const headerRow = data[2]; // Row 3
  
  // Identify the target month as a Date Object (1st of the month)
  const targetDate = new Date(yr, mIdx, 1);
  const targetLabel = Utilities.formatDate(targetDate, "GMT", "MMM-yyyy");

  let sumColIdx = -1;
  let targetColIdx = -1;

  // Scan Header Row
  for (let c = 0; c < headerRow.length; c++) {
    const val = headerRow[c];
    let label = "";
    if (val instanceof Date) label = Utilities.formatDate(val, "GMT", "MMM-yyyy");
    else label = val ? val.toString().trim() : "";

    if (label === "Sum") sumColIdx = c;
    if (label === targetLabel) targetColIdx = c;
  }

  // Handle Missing Column
  if (targetColIdx === -1) {
    const insertAt = sumColIdx !== -1 ? sumColIdx + 1 : sheet.getLastColumn() + 1;
    sheet.insertColumnBefore(insertAt);
    const newCell = sheet.getRange(3, insertAt);
    newCell.setValue(targetDate);
    newCell.setNumberFormat("MMM-yyyy");
    targetColIdx = insertAt - 1;
  }

  // Find or Create Ticker Row
  let rowIdx = -1;
  let maxSerial = 0;
  let totalRowIdx = -1;

  for (let r = 0; r < data.length; r++) {
    const serial = parseInt(data[r][0]);
    if (!isNaN(serial)) maxSerial = Math.max(maxSerial, serial);
    if (data[r][1] && data[r][1].toString().toLowerCase().includes("total")) totalRowIdx = r + 1;
    if (r >= 3 && data[r][1] === ticker) rowIdx = r;
  }

  if (rowIdx === -1) {
    if (totalRowIdx === -1) totalRowIdx = sheet.getLastRow() + 1;
    sheet.insertRowBefore(totalRowIdx);
    sheet.getRange(totalRowIdx, 1).setValue(maxSerial + 1);
    sheet.getRange(totalRowIdx, 2).setValue(ticker);
    rowIdx = totalRowIdx - 1;
  }

  const cell = sheet.getRange(rowIdx + 1, targetColIdx + 1);
  cell.setValue((parseFloat(cell.getValue()) || 0) + amount);
}

function getTickerWithCache(description, configSheet) {
  const data = configSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === description) return data[i][1];
  }
  let guess = description;
  try {
    const res = JSON.parse(UrlFetchApp.fetch("https://query1.finance.yahoo.com/v1/finance/search?q=" + encodeURIComponent(description)).getContentText());
    guess = (res.quotes && res.quotes.length > 0) ? res.quotes[0].symbol.replace(".TO", "") : description;
  } catch (e) {}
  configSheet.appendRow([description, guess]); 
  return guess;
}

function getOrCreateConfigSheet(ss) {
  return ss.getSheetByName(TD_CONFIG_NAME) || ss.insertSheet(TD_CONFIG_NAME);
}

function getOrCreateLogSheet(ss) {
  let log = ss.getSheetByName(TD_LOG_NAME) || ss.insertSheet(TD_LOG_NAME);
  if (log.getLastRow() === 0) log.appendRow(["Timestamp", "ID", "Ticker", "Amt", "Tab"]).hideSheet();
  return log;
}

function isDuplicate(logSheet, id) {
  if (logSheet.getLastRow() < 2) return false;
  const ids = logSheet.getRange(2, 2, logSheet.getLastRow() - 1, 1).getValues().flat();
  return ids.includes(id);
}