'use strict';

const path = require('path');
const express = require('express');
const multer = require('multer');
const archiver = require('archiver');

const { readRowsFromExcel } = require('./excelReader');
const { findMatchingRow } = require('./matcher');
const { stampPdf } = require('./stamp');

const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB per file
});

// Busboy/multer decode multipart filenames as latin1 by default, which
// mangles UTF-8 (e.g. Hebrew) filenames. Re-decode them correctly.
function fixFilenameEncoding(originalname) {
  return Buffer.from(originalname, 'latin1').toString('utf8');
}

app.use(express.static(path.join(__dirname, '..', 'public')));

app.post(
  '/api/process',
  upload.fields([
    { name: 'excel', maxCount: 1 },
    { name: 'pdfs', maxCount: 100 },
  ]),
  async (req, res) => {
    try {
      const excelFile = req.files && req.files.excel && req.files.excel[0];
      const pdfFiles = (req.files && req.files.pdfs) || [];

      if (!excelFile) {
        return res.status(400).json({ error: 'לא הועלה קובץ אקסל' });
      }
      if (pdfFiles.length === 0) {
        return res.status(400).json({ error: 'לא הועלו קבצי PDF' });
      }

      const rows = await readRowsFromExcel(excelFile.buffer);

      const results = [];
      const unmatched = [];

      for (const pdfFile of pdfFiles) {
        const originalname = fixFilenameEncoding(pdfFile.originalname);
        const baseName = path.basename(originalname, path.extname(originalname));
        const match = findMatchingRow(rows, baseName);

        if (!match || !match.docNumber) {
          unmatched.push(originalname);
          continue;
        }

        const stampedBytes = await stampPdf(pdfFile.buffer, match.docNumber);
        results.push({ name: originalname, bytes: stampedBytes });
      }

      if (results.length === 0) {
        return res.status(400).json({
          error: 'לא נמצאה התאמה לאף אחד מקבצי ה-PDF שהועלו',
          unmatched,
        });
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="stamped-pdfs.zip"'
      );
      if (unmatched.length > 0) {
        res.setHeader('X-Unmatched-Files', encodeURIComponent(JSON.stringify(unmatched)));
      }

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err) => {
        throw err;
      });
      archive.pipe(res);

      for (const result of results) {
        archive.append(Buffer.from(result.bytes), { name: result.name });
      }

      await archive.finalize();
    } catch (err) {
      console.error(err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'אירעה שגיאה בעיבוד הקבצים' });
      }
    }
  }
);

module.exports = app;
