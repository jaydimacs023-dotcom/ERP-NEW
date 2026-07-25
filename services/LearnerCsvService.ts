import { Student } from '../types';

export const LEARNER_CSV_HEADERS = [
  'Last Name', 'First Name', 'Middle Name', 'Extension Name', 'ULI', 'Contact Number',
  'E-mail Address', 'Street Address', 'Barangay', 'Municipality/City', 'District',
  'Province', 'Sex', 'Date of Birth', 'Age', 'Civil Status',
  'Highest Educational Attainment', 'Nationality'
] as const;

export const LEARNER_CSV_SAMPLE_ROW = [
  'SAMPLE - REMOVE THIS ROW', 'Juan', 'Santos', '', '__SAMPLE_ROW_DO_NOT_IMPORT__',
  '09171234567', 'juan.santos@example.com', '12 Rizal St., Central', 'Barangay 1',
  'Manila', '', 'Metro Manila', 'Male', '1990-02-28', '', 'Single',
  'College Graduate', 'Filipino'
] as const;

export interface LearnerCsvError {
  row: number;
  field: string;
  message: string;
}

export interface LearnerCsvResult {
  students: Student[];
  errors: LearnerCsvError[];
  totalRows: number;
}

type Field = 'lastName' | 'firstName' | 'middleName' | 'extension' | 'uli' |
  'contactNumber' | 'email' | 'street' | 'barangay' | 'city' | 'district' |
  'province' | 'sex' | 'dateOfBirth' | 'age' | 'civilStatus' |
  'educationalAttainment' | 'nationality';

export class CsvParseError extends Error {
  constructor(message: string, public readonly row: number) {
    super(message);
    this.name = 'CsvParseError';
  }
}

const HEADER_ALIASES: Record<Field, string[]> = {
  lastName: ['last name', 'lastname', 'surname'],
  firstName: ['first name', 'firstname', 'given name'],
  middleName: ['middle name', 'middlename'],
  extension: ['extension name', 'extension', 'suffix'],
  uli: ['uli', 'unique learner identifier', 'uli number'],
  contactNumber: ['contact number', 'contact no', 'phone', 'mobile number'],
  email: ['e mail address', 'email address', 'email', 'e-mail address'],
  street: ['street address', 'street', 'address'],
  barangay: ['barangay', 'brgy'],
  city: ['municipality city', 'municipality/city', 'city', 'municipality'],
  district: ['district'],
  province: ['province'],
  sex: ['sex', 'gender'],
  dateOfBirth: ['date of birth', 'date of birth mm dd yy', 'birth date', 'dob'],
  age: ['age'],
  civilStatus: ['civil status', 'marital status'],
  educationalAttainment: ['highest educational attainment', 'educational attainment', 'education'],
  nationality: ['nationality', 'citizenship'],
};

const normalizeHeader = (value: string) => value
  .replace(/^\uFEFF/, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let justClosedQuote = false;
  let lineNumber = 1;

  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
        justClosedQuote = true;
      } else {
        field += char;
      }
    } else if (justClosedQuote) {
      if (char === ',') {
        row.push(field);
        field = '';
        justClosedQuote = false;
      } else if (char === '\n' || char === '\r') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        justClosedQuote = false;
        if (char === '\r' && source[i + 1] === '\n') i += 1;
        lineNumber += 1;
      } else {
        throw new CsvParseError(`Invalid character after a closing quote on CSV row ${lineNumber}.`, lineNumber);
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === '"') {
      throw new CsvParseError(`Unexpected quote in an unquoted value on CSV row ${lineNumber}.`, lineNumber);
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      lineNumber += 1;
    } else {
      field += char;
    }
  }
  if (quoted) throw new CsvParseError(`The CSV contains an unclosed quoted value on row ${lineNumber}.`, lineNumber);
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalizeDate(value: string): string | null {
  const raw = value.trim();
  let year: number;
  let month: number;
  let day: number;
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    [, year, month, day] = match.map(Number);
  } else {
    match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
    if (!match) return null;
    month = Number(match[1]);
    day = Number(match[2]);
    year = Number(match[3]);
    if (year < 100) year += year > 50 ? 1900 : 2000;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function philippineCalendarDate(referenceDate: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(referenceDate);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(part => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

export function calculateLearnerAge(dateOfBirth: string, referenceDate: Date = new Date()): number {
  const normalized = normalizeDate(dateOfBirth);
  if (!normalized) throw new Error('A valid date of birth is required.');
  const [year, month, day] = normalized.split('-').map(Number);
  const today = philippineCalendarDate(referenceDate);
  if (year > today.year ||
    (year === today.year && (month > today.month || (month === today.month && day > today.day)))) {
    throw new Error('Date of Birth cannot be in the future.');
  }
  let age = today.year - year;
  if (today.month < month || (today.month === month && today.day < day)) age -= 1;
  return age;
}

function csvEscape(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function createLearnerCsvTemplate(): string {
  return `${LEARNER_CSV_HEADERS.map(csvEscape).join(',')}\r\n${LEARNER_CSV_SAMPLE_ROW.map(csvEscape).join(',')}\r\n`;
}

export function readLearnerCsv(text: string, existingStudents: Pick<Student, 'uli'>[], referenceDate: Date = new Date()): LearnerCsvResult {
  const errors: LearnerCsvError[] = [];
  let rows: string[][];
  try {
    rows = parseCsv(text);
  } catch (error) {
    return {
      students: [],
      errors: [{
        row: error instanceof CsvParseError ? error.row : 1,
        field: 'CSV',
        message: error instanceof Error ? error.message : 'Invalid CSV file.'
      }],
      totalRows: 0
    };
  }
  if (!rows.length) return { students: [], errors: [{ row: 1, field: 'CSV', message: 'The CSV file is empty.' }], totalRows: 0 };

  const normalized = rows[0].map(normalizeHeader);
  const indices = {} as Record<Field, number>;
  (Object.keys(HEADER_ALIASES) as Field[]).forEach(field => {
    indices[field] = normalized.findIndex(header => HEADER_ALIASES[field].map(normalizeHeader).includes(header));
  });
  const required: Array<[Field, string]> = [
    ['lastName', 'Last Name'], ['firstName', 'First Name'], ['email', 'E-mail Address'], ['dateOfBirth', 'Date of Birth']
  ];
  required.forEach(([field, label]) => {
    if (indices[field] < 0) errors.push({ row: 1, field: label, message: `Missing required "${label}" header.` });
  });
  const isMarkedSampleRow = (columns: string[]) =>
    columns.length >= LEARNER_CSV_SAMPLE_ROW.length &&
    LEARNER_CSV_SAMPLE_ROW.every((value, index) => columns[index]?.trim() === value);
  const dataRows = rows.slice(1).filter(columns =>
    columns.some(value => value.trim()) && !isMarkedSampleRow(columns)
  );
  if (errors.length) return { students: [], errors, totalRows: dataRows.length };

  const existingUlis = new Set(existingStudents.map(s => s.uli?.trim().toLowerCase()).filter(Boolean));
  const fileUlis = new Map<string, number>();
  const students: Student[] = [];
  const now = new Date().toISOString();

  rows.slice(1).forEach((columns, offset) => {
    const rowNumber = offset + 2;
    if (columns.every(value => !value.trim()) || isMarkedSampleRow(columns)) return;
    const get = (field: Field) => indices[field] >= 0 ? (columns[indices[field]] || '').trim() : '';
    const rowErrors: LearnerCsvError[] = [];
    const requiredValues: Array<[Field, string]> = [
      ['lastName', 'Last Name'], ['firstName', 'First Name'], ['email', 'E-mail Address'], ['dateOfBirth', 'Date of Birth']
    ];
    requiredValues.forEach(([field, label]) => {
      if (!get(field)) rowErrors.push({ row: rowNumber, field: label, message: `${label} is required.` });
    });
    const email = get('email');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      rowErrors.push({ row: rowNumber, field: 'E-mail Address', message: 'Enter a valid email address.' });
    }
    const dob = normalizeDate(get('dateOfBirth'));
    if (get('dateOfBirth') && !dob) {
      rowErrors.push({ row: rowNumber, field: 'Date of Birth', message: 'Use YYYY-MM-DD (legacy MM-DD-YY or MM/DD/YYYY is also accepted).' });
    }
    let computedAge: number | null = null;
    if (dob) {
      try {
        computedAge = calculateLearnerAge(dob, referenceDate);
      } catch (error) {
        rowErrors.push({ row: rowNumber, field: 'Date of Birth', message: error instanceof Error ? error.message : 'Date of Birth is invalid.' });
      }
    }
    const suppliedAge = get('age');
    if (suppliedAge) {
      if (!/^\d+$/.test(suppliedAge)) {
        rowErrors.push({ row: rowNumber, field: 'Age', message: 'Age must be a non-negative whole number.' });
      } else if (computedAge !== null && Number(suppliedAge) !== computedAge) {
        rowErrors.push({ row: rowNumber, field: 'Age', message: `Age must match the computed age of ${computedAge} from Date of Birth.` });
      }
    }
    const uli = get('uli');
    const uliKey = uli.toLowerCase();
    if (uliKey) {
      if (existingUlis.has(uliKey)) rowErrors.push({ row: rowNumber, field: 'ULI', message: 'ULI already belongs to an existing learner.' });
      const firstRow = fileUlis.get(uliKey);
      if (firstRow) rowErrors.push({ row: rowNumber, field: 'ULI', message: `ULI duplicates row ${firstRow}.` });
      else fileUlis.set(uliKey, rowNumber);
    }
    errors.push(...rowErrors);
    if (rowErrors.length || !dob || computedAge === null) return;
    students.push({
      id: `batch-${Date.now()}-${rowNumber}`, orgId: 'temp', uli: uli || undefined,
      lastName: get('lastName'), firstName: get('firstName'), middleName: get('middleName'),
      extension: get('extension'), sex: (get('sex') as Student['sex']) || 'Male',
      dateOfBirth: dob, age: computedAge, birthRegion: '', birthProvince: '', birthCity: '',
      civilStatus: get('civilStatus') || 'Single', educationalAttainment: get('educationalAttainment'),
      nationality: get('nationality') || 'Filipino', email, contactNumber: get('contactNumber'),
      street: get('street'), barangay: get('barangay'), city: get('city'), district: get('district'),
      province: get('province'), guardian: '', documents: [], createdAt: now
    });
  });
  if (!students.length && !errors.length) errors.push({ row: 2, field: 'CSV', message: 'The CSV contains no learner records.' });
  return { students, errors, totalRows: dataRows.length };
}
