'use strict';

const ExcelJS = require('exceljs');
const { readRowsFromExcel } = require('../src/excelReader');

async function buildWorkbookBuffer(header, dataRows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.addRow(header);
  dataRows.forEach((row) => sheet.addRow(row));
  return workbook.xlsx.writeBuffer();
}

describe('readRowsFromExcel', () => {
  test('reads rows using auto-detected Hebrew headers', async () => {
    const buffer = await buildWorkbookBuffer(
      ['שם לקוח', 'מספר תעודה'],
      [
        ['יוסי כהן', 1001],
        ['דנה לוי', 1002],
      ]
    );

    const rows = await readRowsFromExcel(buffer);
    expect(rows).toEqual([
      { name: 'יוסי כהן', docNumber: '1001' },
      { name: 'דנה לוי', docNumber: '1002' },
    ]);
  });

  test('falls back to first two columns when headers are unrecognized', async () => {
    const buffer = await buildWorkbookBuffer(
      ['ColA', 'ColB'],
      [['Alice', 'A-1']]
    );

    const rows = await readRowsFromExcel(buffer);
    expect(rows).toEqual([{ name: 'Alice', docNumber: 'A-1' }]);
  });

  test('returns an empty array when there is no worksheet data', async () => {
    const buffer = await buildWorkbookBuffer(['שם', 'מספר תעודה'], []);
    const rows = await readRowsFromExcel(buffer);
    expect(rows).toEqual([]);
  });
});
