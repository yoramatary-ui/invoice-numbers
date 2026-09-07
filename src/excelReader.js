'use strict';

const ExcelJS = require('exceljs');
const { detectColumns } = require('./matcher');

/**
 * Reads the first worksheet of an Excel file buffer and returns an array of
 * rows shaped as { name, docNumber }, using auto-detected columns.
 * @param {Buffer} buffer
 * @returns {Promise<Array<{ name: string, docNumber: string }>>}
 */
async function readRowsFromExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headerRow = worksheet.getRow(1).values.slice(1); // exceljs values are 1-indexed
  const { nameColIndex, numberColIndex } = detectColumns(headerRow);

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const values = row.values.slice(1);
    const name = values[nameColIndex];
    const docNumber = values[numberColIndex];
    if (name === undefined && docNumber === undefined) return;
    rows.push({
      name: name !== undefined && name !== null ? String(name).trim() : '',
      docNumber:
        docNumber !== undefined && docNumber !== null
          ? String(docNumber).trim()
          : '',
    });
  });

  return rows;
}

module.exports = { readRowsFromExcel };
