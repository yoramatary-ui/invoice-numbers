'use strict';

const path = require('path');
const express = require('express');
const multer = require('multer');
const archiver = require('archiver');

const { readRowsFromExcel } = require('./excelReader');
const { findMatchingRow } = require('./matcher');
const { stampPdf } = require('./stamp');

const app = express();

const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];
const EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB per file
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'excel') {
      if (EXCEL_MIME_TYPES.includes(file.mimetype) || EXCEL_EXTENSIONS.includes(ext)) {
        return cb(null, true);
      }
      return cb(new Error('קובץ האקסל חייב להיות בפורמט xlsx, xls או csv'));
    }
    if (file.fieldname === 'pdfs') {
      if (file.mimetype === 'application/pdf' || ext === '.pdf') {
        return cb(null, true);
      }
      return cb(new Error('כל קבצי המסמכים חייבים להיות בפורמט PDF'));
    }
    return cb(new Error('שדה קובץ לא צפוי'));
  },
});

// Busboy/multer decode multipart filenames as latin1 by default, which
// mangles UTF-8 (e.g. Hebrew) filenames. Only re-decode when the original
// string looks like mis-decoded latin1 (i.e. every character fits in the
// latin1 range) and the round-trip produces valid, replacement-free UTF-8;
// otherwise keep the original string untouched.
function fixFilenameEncoding(originalname) {
  if (!originalname || !/^[\u0000-\u00ff]*$/.test(originalname)) {
    return originalname;
  }
  const reencoded = Buffer.from(originalname, 'latin1').toString('utf8');
  return reencoded.includes('\uFFFD') ? originalname : reencoded;
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

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);

      for (const result of results) {
        archive.append(Buffer.from(result.bytes), { name: result.name });
      }

      if (unmatched.length > 0) {
        const manifest =
          'הקבצים הבאים לא נמצאה עבורם התאמה באקסל ולכן לא עודכנו:\n' +
          unmatched.join('\n') +
          '\n';
        archive.append(manifest, { name: 'קבצים-ללא-התאמה.txt' });
      }

      await new Promise((resolve, reject) => {
        archive.on('error', reject);
        res.on('finish', resolve);
        res.on('close', () => {
          if (!res.writableEnded) {
            reject(new Error('החיבור נסגר לפני שההורדה הסתיימה'));
          }
        });
        res.on('error', reject);
        archive.finalize().catch(reject);
      }).catch((err) => {
        console.error(err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'אירעה שגיאה ביצירת קובץ ה-ZIP' });
        } else if (!res.writableEnded) {
          res.destroy(err);
        }
      });
    } catch (err) {
      console.error(err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'אירעה שגיאה בעיבוד הקבצים' });
      }
    }
  }
);

// Handles multer errors (e.g. file size/type validation) and any other
// errors passed to next().
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return res.destroy(err);
  }
  res.status(400).json({ error: err.message || 'אירעה שגיאה בהעלאת הקבצים' });
});

module.exports = app;
