/**
 * UNIVERSAL DIVIDEND IMPORTER (v9.0)
 * Updated: Renamed Log Sheet & Centralized Progress Bar.
 */

const LOG_SHEET_NAME = "Import_WS_TFSA_Log_DoNotDelete";

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('💰 Dividend Tools')
      .addItem('Import Wealthsimple CSV', 'importMonthlyDividends')
      .addToUi();
}

function importMonthlyDividends() {
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family: Arial; padding: 15px;">' +
    '<p style="color: #2c3e50;"><b>Select Wealthsimple CSV File:</b></p>' +
    '<input type="file" id="file" onchange="upload(this)" style="margin-bottom: 20px;">' +
    '<script>' +
    'function upload(f) {' +
    '  const reader = new FileReader();' +
    '  reader.onload = function(e) {' +
    '    google.script.run.withSuccessHandler(() => { google.script.host.close(); }).processCSV(e.target.result);' +
    '  };' +
    '  reader.readAsText(f.files[0]);' +
    '}' +
    '</script></div>'
  ).setWidth(400).setHeight(160);
  SpreadsheetApp.getUi().showModalDialog(html, 'Wealthsimple Dividend Importer');
}

function processCSV(csvContent) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("DivWealthTFSA");
  const logSheet = getOrCreateLogSheet(ss);
  const data = Utilities.parseCsv(csvContent);
  const csvHeaders = data[0].map(h => h.trim().toLowerCase());

  // Show a central progress bar dialog
  const progressDialog = HtmlService.createHtmlOutput(
    '<div style="font-family: Arial; text-align: center; padding: 20px;">' +
    '<h3 id="status">Starting Import...</h3>' +
    '<div style="width: 100%; background: #eee; border-radius: 10px; margin: 10px 0;">' +
    '<div id="bar" style="width: 0%; height: 20px; background: #4caf50; border-radius: 10px; transition: width 0.3s;"></div>' +
    '</div><p id="count">0 of ' + (data.length - 1) + ' lines</p></div>'
  ).setWidth(350).setHeight(150);
  
  // We use a side bar or a persistent toast for progress updates in this logic
  // Since real-time UI updates require a different architecture, we'll use a sophisticated Toast
  
  let tickerIdx, amountIdx, dateIdx, typeIdx, descIdx;
  let isStatementFormat = csvHeaders.includes("transaction") && csvHeaders.includes("description");

  if (isStatementFormat) {
    amountIdx = csvHeaders.indexOf("amount");
    dateIdx = csvHeaders.indexOf("date");
    typeIdx = csvHeaders.indexOf("transaction");
    descIdx = csvHeaders.indexOf("description");
  } else {
    tickerIdx = csvHeaders.indexOf("symbol");
    amountIdx = csvHeaders.indexOf("net_cash_amount");
    dateIdx = csvHeaders.indexOf("transaction_date");
    typeIdx = csvHeaders.indexOf("activity_type");
  }

  let sheetData = sheet.getDataRange().getValues();
  let sheetHeaders = sheetData[2].map(h => normalizeMonthYear(h)); 
  let sumColIdx = sheetData[2].indexOf("Sum"); 
  
  let updatedTickers = new Set();
  let processedCount = 0;
  const totalLines = data.length - 1;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const type = row[typeIdx] ? row[typeIdx].toString().trim().toUpperCase() : "";

    if (["DIV", "DIVIDEND", "REWARD", "STKDIV"].includes(type)) {
      let csvTicker = "";
      if (isStatementFormat) {
        const desc = row[descIdx].toString().trim();
        const match = desc.match(/^([A-Z0-9\.]+)/); 
        csvTicker = match ? match[1].toUpperCase() : "";
      } else {
        csvTicker = row[tickerIdx] ? row[tickerIdx].trim().toUpperCase() : "";
      }

      if (!csvTicker || csvTicker === "DIV") continue;

      const amount = Math.abs(parseFloat(row[amountIdx]));
      const dateStr = row[dateIdx];
      const transId = csvTicker + "_" + dateStr + "_" + amount;

      if (isDuplicate(logSheet, transId)) continue;

      const dateObj = new Date(dateStr);
      const monthYearNorm = normalizeMonthYear(dateObj);

      let rowIdx = -1;
      let maxSerial = 0;
      for (let r = 3; r < sheetData.length; r++) {
        const serial = parseInt(sheetData[r][0]);
        if (!isNaN(serial)) maxSerial = Math.max(maxSerial, serial);
        let sheetTicker = sheetData[r][1] ? sheetData[r][1].toString().trim().toUpperCase() : "";
        if (sheetTicker === csvTicker || sheetTicker.startsWith(csvTicker + ".") || csvTicker.startsWith(sheetTicker + ".")) {
          rowIdx = r;
          break;
        }
      }

      if (rowIdx === -1) {
        const totalRowIdx = findTotalRow(sheet);
        sheet.insertRowBefore(totalRowIdx);
        sheet.getRange(totalRowIdx, 1).setValue(maxSerial + 1);
        sheet.getRange(totalRowIdx, 2).setValue(csvTicker);
        if (sumColIdx !== -1) {
          const sumRange = sheet.getRange(totalRowIdx, 3, 1, sumColIdx - 2).getA1Notation();
          sheet.getRange(totalRowIdx, sumColIdx + 1).setFormula(`=SUM(${sumRange})`);
        }
        rowIdx = totalRowIdx - 1;
        sheetData = sheet.getDataRange().getValues(); 
      }

      let colIdx = sheetHeaders.indexOf(monthYearNorm);
      if (colIdx === -1) {
        const insertColAt = sumColIdx !== -1 ? sumColIdx + 1 : sheet.getLastColumn() + 1;
        sheet.insertColumnBefore(insertColAt);
        sheet.getRange(3, insertColAt).setValue(monthYearNorm);
        colIdx = insertColAt - 1;
        sheetData = sheet.getDataRange().getValues();
        sheetHeaders = sheetData[2].map(h => normalizeMonthYear(h));
        if (sumColIdx >= colIdx) sumColIdx++; 
      }

      const cell = sheet.getRange(rowIdx + 1, colIdx + 1);
      const currentVal = parseFloat(cell.getValue()) || 0;
      cell.setValue(currentVal + amount);

      logSheet.appendRow([new Date(), transId, csvTicker, amount]);
      updatedTickers.add(csvTicker);
      processedCount++;
    }
    
    // Update Progress Toast every 5 lines
    if (i % 5 === 0) {
      let progress = Math.round((i / totalLines) * 100);
      ss.toast(`📊 Progress: ${progress}% (${i}/${totalLines} rows checked)`, "Wealthsimple Importer");
    }
  }

  const timestamp = Utilities.formatDate(new Date(), "GMT-4", "yyyy-MM-dd HH:mm:ss");
  sheet.getRange("A1").setValue(`Update: ${timestamp} | Processed: ${processedCount} | Symbols: ${Array.from(updatedTickers).join(", ")}`);
  
  ss.toast("Import Complete!", "Dividend Tools", 5);
  SpreadsheetApp.getUi().alert(`✅ Success!\n\nImported ${processedCount} dividends.\nUpdated: ${Array.from(updatedTickers).sort().join(", ")}`);
}

function normalizeMonthYear(input) {
  if (!input) return "";
  const monthMap = { "january": "Jan", "february": "Feb", "march": "Mar", "april": "Apr", "may": "May", "june": "Jun", "july": "Jul", "august": "Aug", "september": "Sep", "october": "Oct", "november": "Nov", "december": "Dec", "jan": "Jan", "feb": "Feb", "mar": "Mar", "apr": "Apr", "jun": "Jun", "jul": "Jul", "aug": "Aug", "sep": "Sep", "oct": "Oct", "nov": "Nov", "dec": "Dec" };
  if (input instanceof Date) return isNaN(input.getTime()) ? "" : Utilities.formatDate(input, "GMT", "MMM-yyyy");
  let str = input.toString().trim().toLowerCase();
  let parts = str.split(/[\-\s/]/);
  if (parts.length >= 2) {
    let m = parts[0], y = parts[1];
    if (!isNaN(m) && m.length === 4) { m = parts[1]; y = parts[0]; }
    if (monthMap[m]) return monthMap[m] + "-" + y;
  }
  return str;
}

function findTotalRow(sheet) {
  const values = sheet.getRange("B:B").getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i][0] && values[i][0].toString().toLowerCase().includes("total")) return i + 1;
  }
  return sheet.getLastRow();
}

function getOrCreateLogSheet(ss) {
  // Check for old name and rename if exists
  let oldLog = ss.getSheetByName("Import_Log_DoNotDelete");
  if (oldLog) oldLog.setName(LOG_SHEET_NAME);
  
  let log = ss.getSheetByName(LOG_SHEET_NAME);
  if (!log) {
    log = ss.insertSheet(LOG_SHEET_NAME);
    log.appendRow(["Timestamp", "UniqueID", "Ticker", "Amount"]);
    log.hideSheet();
  }
  return log;
}

function isDuplicate(logSheet, id) {
  const ids = logSheet.getRange("B:B").getValues().flat();
  return ids.includes(id);
}
