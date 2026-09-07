'use strict';

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const DEFAULT_FONT_SIZE = 14;
const DEFAULT_MARGIN_TOP = 20;

/**
 * Stamps the given text centered at the top of every page of a PDF.
 * @param {Buffer|Uint8Array} pdfBytes - The original PDF file contents.
 * @param {string} text - The text (e.g. document number) to stamp.
 * @param {{ fontSize?: number, marginTop?: number }} [options]
 * @returns {Promise<Uint8Array>} The stamped PDF bytes.
 */
async function stampPdf(pdfBytes, text, options = {}) {
  const fontSize = options.fontSize || DEFAULT_FONT_SIZE;
  const marginTop = options.marginTop || DEFAULT_MARGIN_TOP;

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const x = (width - textWidth) / 2;
    const y = height - marginTop - fontSize;

    page.drawText(text, {
      x: Math.max(x, 0),
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }

  return pdfDoc.save();
}

module.exports = { stampPdf };
