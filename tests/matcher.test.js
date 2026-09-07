'use strict';

const {
  normalizeName,
  findColumnIndex,
  detectColumns,
  findMatchingRow,
} = require('../src/matcher');

describe('normalizeName', () => {
  test('trims, collapses whitespace and lower-cases', () => {
    expect(normalizeName('  Yossi   Cohen  ')).toBe('yossi cohen');
  });

  test('strips a trailing .pdf extension', () => {
    expect(normalizeName('Yossi Cohen.pdf')).toBe('yossi cohen');
  });

  test('handles null/undefined gracefully', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});

describe('findColumnIndex', () => {
  test('finds column index matching a Hebrew keyword', () => {
    const header = ['שם לקוח', 'מספר תעודה', 'תאריך'];
    expect(findColumnIndex(header, ['שם'])).toBe(0);
    expect(findColumnIndex(header, ['תעודה'])).toBe(1);
  });

  test('returns -1 when no keyword matches', () => {
    expect(findColumnIndex(['a', 'b'], ['nope'])).toBe(-1);
  });
});

describe('detectColumns', () => {
  test('detects name and number columns by header keywords', () => {
    const header = ['מספר תעודה', 'שם לקוח'];
    expect(detectColumns(header)).toEqual({
      nameColIndex: 1,
      numberColIndex: 0,
    });
  });

  test('falls back to first two columns when headers are unrecognized', () => {
    const header = ['Col1', 'Col2'];
    expect(detectColumns(header)).toEqual({
      nameColIndex: 0,
      numberColIndex: 1,
    });
  });

  test('falls back correctly when the name column is not index 0 or 1', () => {
    const header = ['Col1', 'Col2', 'שם לקוח'];
    expect(detectColumns(header)).toEqual({
      nameColIndex: 2,
      numberColIndex: 0,
    });
  });

  test('returns -1 for the number column when only one column exists', () => {
    const header = ['שם לקוח'];
    expect(detectColumns(header)).toEqual({
      nameColIndex: 0,
      numberColIndex: -1,
    });
  });

  test('does not misassign the name column when it collides with the detected number column', () => {
    const header = ['מספר תעודה', 'תאריך'];
    expect(detectColumns(header)).toEqual({
      nameColIndex: 1,
      numberColIndex: 0,
    });
  });

  test('returns -1 for the name column when only the number column is recognized and no other column exists', () => {
    const header = ['מספר תעודה'];
    expect(detectColumns(header)).toEqual({
      nameColIndex: -1,
      numberColIndex: 0,
    });
  });
});

describe('findMatchingRow', () => {
  const rows = [
    { name: 'יוסי כהן', docNumber: '1001' },
    { name: 'דנה לוי', docNumber: '1002' },
  ];

  test('finds an exact match ignoring case/whitespace', () => {
    expect(findMatchingRow(rows, '  יוסי כהן ')).toEqual(rows[0]);
  });

  test('finds a match when the filename contains the row name', () => {
    expect(findMatchingRow(rows, 'invoice-דנה לוי-2024')).toEqual(rows[1]);
  });

  test('returns null when nothing matches', () => {
    expect(findMatchingRow(rows, 'לא קיים')).toBeNull();
  });

  test('returns null for empty inputs', () => {
    expect(findMatchingRow([], 'anything')).toBeNull();
    expect(findMatchingRow(rows, '')).toBeNull();
  });
});
