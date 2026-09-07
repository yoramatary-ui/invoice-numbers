'use strict';

const http = require('http');
const ExcelJS = require('exceljs');
const { PDFDocument } = require('pdf-lib');
const AdmZip = require('adm-zip');
const app = require('../src/server');

async function buildExcelBuffer() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.addRow(['שם לקוח', 'מספר תעודה']);
  sheet.addRow(['יוסי כהן', 5555]);
  return workbook.xlsx.writeBuffer();
}

async function buildPdfBuffer() {
  const doc = await PDFDocument.create();
  doc.addPage([600, 800]);
  return doc.save();
}

describe('POST /api/process', () => {
  let server;
  let baseUrl;

  beforeAll((done) => {
    server = http.createServer(app);
    server.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  test('returns a ZIP containing the stamped PDF for a matching filename', async () => {
    const excelBuffer = await buildExcelBuffer();
    const pdfBuffer = await buildPdfBuffer();

    const form = new FormData();
    form.append(
      'excel',
      new Blob([excelBuffer]),
      'clients.xlsx'
    );
    form.append('pdfs', new Blob([pdfBuffer]), 'יוסי כהן.pdf');

    const response = await fetch(`${baseUrl}/api/process`, {
      method: 'POST',
      body: form,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');

    const arrayBuffer = await response.arrayBuffer();
    expect(Buffer.from(arrayBuffer).length).toBeGreaterThan(0);
  });

  test('returns 400 when the excel file is missing', async () => {
    const pdfBuffer = await buildPdfBuffer();
    const form = new FormData();
    form.append('pdfs', new Blob([pdfBuffer]), 'anything.pdf');

    const response = await fetch(`${baseUrl}/api/process`, {
      method: 'POST',
      body: form,
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  test('returns 400 when no pdf matches any row', async () => {
    const excelBuffer = await buildExcelBuffer();
    const pdfBuffer = await buildPdfBuffer();

    const form = new FormData();
    form.append('excel', new Blob([excelBuffer]), 'clients.xlsx');
    form.append('pdfs', new Blob([pdfBuffer]), 'לא קיים.pdf');

    const response = await fetch(`${baseUrl}/api/process`, {
      method: 'POST',
      body: form,
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.unmatched).toContain('לא קיים.pdf');
  });

  test('returns a 200 ZIP with a manifest listing unmatched files when some PDFs match and others do not', async () => {
    const excelBuffer = await buildExcelBuffer();
    const matchedPdf = await buildPdfBuffer();
    const unmatchedPdf = await buildPdfBuffer();

    const form = new FormData();
    form.append('excel', new Blob([excelBuffer]), 'clients.xlsx');
    form.append('pdfs', new Blob([matchedPdf]), 'יוסי כהן.pdf');
    form.append('pdfs', new Blob([unmatchedPdf]), 'לא קיים.pdf');

    const response = await fetch(`${baseUrl}/api/process`, {
      method: 'POST',
      body: form,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');

    const arrayBuffer = await response.arrayBuffer();
    const zip = new AdmZip(Buffer.from(arrayBuffer));
    const entryNames = zip.getEntries().map((entry) => entry.entryName);

    expect(entryNames).toContain('יוסי כהן.pdf');
    expect(entryNames).toContain('קבצים-ללא-התאמה.txt');

    const manifestEntry = zip.getEntry('קבצים-ללא-התאמה.txt');
    const manifestText = manifestEntry.getData().toString('utf8');
    expect(manifestText).toContain('לא קיים.pdf');
  });

  test('rejects non-PDF files uploaded under the pdfs field', async () => {
    const excelBuffer = await buildExcelBuffer();

    const form = new FormData();
    form.append('excel', new Blob([excelBuffer]), 'clients.xlsx');
    form.append(
      'pdfs',
      new Blob(['not a pdf'], { type: 'text/plain' }),
      'notes.txt'
    );

    const response = await fetch(`${baseUrl}/api/process`, {
      method: 'POST',
      body: form,
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });
});
