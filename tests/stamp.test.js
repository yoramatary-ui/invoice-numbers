'use strict';

const { PDFDocument } = require('pdf-lib');
const { stampPdf } = require('../src/stamp');

async function createSamplePdf() {
  const doc = await PDFDocument.create();
  doc.addPage([600, 800]);
  doc.addPage([600, 800]);
  return doc.save();
}

describe('stampPdf', () => {
  test('returns a valid PDF with the same number of pages', async () => {
    const original = await createSamplePdf();
    const stamped = await stampPdf(original, '12345');

    const stampedDoc = await PDFDocument.load(stamped);
    expect(stampedDoc.getPageCount()).toBe(2);

    const header = Buffer.from(stamped.slice(0, 5)).toString('utf8');
    expect(header).toBe('%PDF-');
  });

  test('produces different bytes than the original (text was added)', async () => {
    const original = await createSamplePdf();
    const stamped = await stampPdf(original, '12345');
    expect(Buffer.from(stamped).equals(Buffer.from(original))).toBe(false);
  });
});
