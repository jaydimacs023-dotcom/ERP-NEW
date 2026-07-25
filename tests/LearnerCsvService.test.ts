import { describe, expect, it } from 'vitest';
import {
  calculateLearnerAge,
  createLearnerCsvTemplate,
  LEARNER_CSV_HEADERS,
  LEARNER_CSV_SAMPLE_ROW,
  parseCsv,
  readLearnerCsv,
} from '../services/LearnerCsvService';

const header = LEARNER_CSV_HEADERS.join(',');
const validRow = 'Dela Cruz,Juan,,,"",09171234567,juan@example.com,"12 Rizal St., Central",Barangay 1,Manila,,Metro Manila,Male,1990-02-28,,Single,College Graduate,Filipino';

describe('LearnerCsvService', () => {
  const referenceDate = new Date('2026-07-26T04:00:00.000Z');

  it('calculates completed years from calendar components', () => {
    expect(calculateLearnerAge('2000-07-25', referenceDate)).toBe(26);
    expect(calculateLearnerAge('2000-07-27', referenceDate)).toBe(25);
    expect(calculateLearnerAge('2000-07-26', referenceDate)).toBe(26);
    expect(calculateLearnerAge('2000-02-29', new Date('2025-02-28T04:00:00.000Z'))).toBe(24);
    expect(calculateLearnerAge('2000-02-29', new Date('2025-03-01T04:00:00.000Z'))).toBe(25);
  });

  it('rejects future birth dates and supplied ages that differ from computed age', () => {
    const future = readLearnerCsv(`${header}\n${validRow.replace('1990-02-28', '2026-07-27')}`, [], referenceDate);
    expect(future.errors).toContainEqual(expect.objectContaining({
      row: 2, field: 'Date of Birth', message: 'Date of Birth cannot be in the future.',
    }));

    const mismatch = readLearnerCsv(
      `${header}\n${validRow.replace('1990-02-28,,Single', '2000-07-26,25,Single')}`,
      [],
      referenceDate
    );
    expect(mismatch.errors).toContainEqual(expect.objectContaining({
      row: 2, field: 'Age', message: 'Age must match the computed age of 26 from Date of Birth.',
    }));
    expect(mismatch.students).toHaveLength(0);
  });
  it('parses BOM, CRLF, quoted commas, escaped quotes, and trailing empty values', () => {
    expect(parseCsv('\uFEFFName,Address,Note,Empty\r\n"Juan ""JD""","12 St., Manila","a\nb",')).toEqual([
      ['Name', 'Address', 'Note', 'Empty'],
      ['Juan "JD"', '12 St., Manila', 'a\nb', ''],
    ]);
  });

  it('rejects malformed quote placement with the affected CSV row', () => {
    expect(() => parseCsv('Name\nJo"hn')).toThrow('Unexpected quote in an unquoted value on CSV row 2.');
    expect(() => parseCsv('Name\n"John"x')).toThrow('Invalid character after a closing quote on CSV row 2.');
    const result = readLearnerCsv('Last Name,First Name,E-mail Address,Date of Birth\n"Dela Cruz"x,Juan,juan@example.com,1990-01-01', []);
    expect(result.errors[0]).toMatchObject({ row: 2, field: 'CSV' });
    expect(result.errors[0].message).toContain('CSV row 2');
  });

  it('maps reordered and normalized header aliases', () => {
    const result = readLearnerCsv(
      'EMAIL,DOB,FIRSTNAME,SURNAME\njuan@example.com,1990-02-28,Juan,Dela Cruz',
      []
    );
    expect(result.errors).toEqual([]);
    expect(result.students[0]).toMatchObject({
      firstName: 'Juan', lastName: 'Dela Cruz', email: 'juan@example.com', dateOfBirth: '1990-02-28',
    });
  });

  it('reports missing headers and required values by row and field', () => {
    const missingHeader = readLearnerCsv('Last Name,First Name\nDela Cruz,Juan', []);
    expect(missingHeader.errors.map(error => error.field)).toEqual(expect.arrayContaining(['E-mail Address', 'Date of Birth']));

    const missingValue = readLearnerCsv(`${header}\nDela Cruz,,,,,,bad-email,,,,,,,,,,,`, []);
    expect(missingValue.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, field: 'First Name' }),
      expect.objectContaining({ row: 2, field: 'Date of Birth' }),
      expect.objectContaining({ row: 2, field: 'E-mail Address', message: 'Enter a valid email address.' }),
    ]));
  });

  it('normalizes supported dates and rejects impossible calendar dates', () => {
    const legacy = readLearnerCsv(`${header}\n${validRow.replace('1990-02-28', '02/28/1990')}`, []);
    expect(legacy.students[0].dateOfBirth).toBe('1990-02-28');

    const invalid = readLearnerCsv(`${header}\n${validRow.replace('1990-02-28', '2023-02-29')}`, []);
    expect(invalid.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, field: 'Date of Birth' }),
    ]));
  });

  it('allows blank ULI and validates only non-empty ULI duplicates', () => {
    const twoBlank = readLearnerCsv(`${header}\n${validRow}\n${validRow.replace('Juan', 'Pedro').replace('juan@', 'pedro@')}`, []);
    expect(twoBlank.errors).toEqual([]);
    expect(twoBlank.students[0].uli).toBeUndefined();

    const withUli = validRow.replace(',"",0917', ',ULI-001,0917');
    const duplicate = readLearnerCsv(`${header}\n${withUli}\n${withUli.replace('Juan', 'Pedro').replace('juan@', 'pedro@')}`, []);
    expect(duplicate.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 3, field: 'ULI', message: 'ULI duplicates row 2.' }),
    ]));
    const existing = readLearnerCsv(`${header}\n${withUli}`, [{ uli: 'uli-001' }]);
    expect(existing.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, field: 'ULI', message: 'ULI already belongs to an existing learner.' }),
    ]));
  });

  it('includes a recognizable example with an ISO date and quoted comma address', () => {
    const templateRows = parseCsv(createLearnerCsvTemplate());
    expect(templateRows[0]).toEqual([...LEARNER_CSV_HEADERS]);
    expect(templateRows[1]).toEqual([...LEARNER_CSV_SAMPLE_ROW]);
    expect(createLearnerCsvTemplate()).toContain('"12 Rizal St., Central"');
    expect(templateRows[1][13]).toBe('1990-02-28');
  });

  it('ignores the marked example and does not import an untouched template', () => {
    const result = readLearnerCsv(createLearnerCsvTemplate(), []);
    expect(result.students).toEqual([]);
    expect(result.totalRows).toBe(0);
    expect(result.errors).toEqual([
      expect.objectContaining({ field: 'CSV', message: 'The CSV contains no learner records.' }),
    ]);
  });

  it('round-trips a real learner appended after the marked example', () => {
    const result = readLearnerCsv(`${createLearnerCsvTemplate()}${validRow}\r\n`, []);
    expect(result.errors).toEqual([]);
    expect(result.students).toHaveLength(1);
    expect(result.totalRows).toBe(1);
  });
});
