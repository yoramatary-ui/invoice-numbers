'use strict';

// Keywords used to auto-detect the relevant columns in the Excel sheet.
// Hebrew and English variants are both supported.
const NAME_KEYWORDS = ['שם', 'name', 'לקוח', 'customer', 'client'];
const NUMBER_KEYWORDS = ['מספר תעודה', 'תעודה', 'invoice', 'doc', 'מספר'];

/**
 * Normalizes a string for comparison purposes: trims whitespace, collapses
 * repeated whitespace, strips a trailing file extension and lower-cases it.
 * @param {string} value
 * @returns {string}
 */
function normalizeName(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\.pdf$/i, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Given a header row (array of cell values), finds the index of the column
 * whose header matches one of the provided keywords. Returns -1 if none found.
 * @param {Array<string>} headerRow
 * @param {Array<string>} keywords
 * @returns {number}
 */
function findColumnIndex(headerRow, keywords) {
  if (!Array.isArray(headerRow)) return -1;
  for (let i = 0; i < headerRow.length; i++) {
    const header = normalizeName(headerRow[i]);
    if (!header) continue;
    if (keywords.some((keyword) => header.includes(keyword.toLowerCase()))) {
      return i;
    }
  }
  return -1;
}

/**
 * Returns the first column index in [0, columnCount) that isn't `exclude`,
 * or -1 if no such column exists.
 * @param {number} exclude
 * @param {number} columnCount
 * @returns {number}
 */
function firstIndexExcluding(exclude, columnCount) {
  let candidate = 0;
  while (candidate === exclude) {
    candidate += 1;
  }
  return candidate < columnCount ? candidate : -1;
}

/**
 * Detects the "name" and "document number" columns from a header row.
 * Falls back to the first and second columns when no keyword match is found.
 * @param {Array<string>} headerRow
 * @returns {{ nameColIndex: number, numberColIndex: number }}
 */
function detectColumns(headerRow) {
  const columnCount = Array.isArray(headerRow) ? headerRow.length : 0;
  let nameColIndex = findColumnIndex(headerRow, NAME_KEYWORDS);
  let numberColIndex = findColumnIndex(headerRow, NUMBER_KEYWORDS);

  if (nameColIndex === -1 && numberColIndex === -1) {
    nameColIndex = 0;
    numberColIndex = firstIndexExcluding(nameColIndex, columnCount);
  } else if (nameColIndex === -1) {
    nameColIndex = firstIndexExcluding(numberColIndex, columnCount);
  } else if (numberColIndex === -1 || numberColIndex === nameColIndex) {
    numberColIndex = firstIndexExcluding(nameColIndex, columnCount);
  }

  return { nameColIndex, numberColIndex };
}
/**
 * Finds the row whose name matches (exactly, or as a substring in either
 * direction) the given PDF filename, and returns its document number.
 * @param {Array<{ name: string, docNumber: string }>} rows
 * @param {string} pdfFilename
 * @returns {{ name: string, docNumber: string } | null}
 */
function findMatchingRow(rows, pdfFilename) {
  const target = normalizeName(pdfFilename);
  if (!target || !Array.isArray(rows)) return null;

  // First pass: exact match takes priority.
  for (const row of rows) {
    const rowName = normalizeName(row.name);
    if (rowName && rowName === target) {
      return row;
    }
  }

  // Second pass: substring match in either direction.
  for (const row of rows) {
    const rowName = normalizeName(row.name);
    if (rowName && (target.includes(rowName) || rowName.includes(target))) {
      return row;
    }
  }

  return null;
}

module.exports = {
  normalizeName,
  findColumnIndex,
  detectColumns,
  findMatchingRow,
  NAME_KEYWORDS,
  NUMBER_KEYWORDS,
};
