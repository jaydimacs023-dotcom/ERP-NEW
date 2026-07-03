import { AssessmentRegistrationStatus } from '../types';

export interface AssessmentTemplateRow {
  rowNumber: number;
  referenceNumber: string;
  learnerId: string;
  firstName: string;
  lastName: string;
  qualificationTitle: string;
  assessmentDate: string | null;
  status: AssessmentRegistrationStatus;
  notes: string;
}

type TemplateRecord = Record<string, unknown>;

export const ASSESSMENT_TEMPLATE_HEADERS = [
  'Region',
  'Province',
  'Reference Number',
  'Learner ID',
  'Last Name',
  'First Name',
  'Middle Name',
  'MI',
  'Ext name',
  'Date of Birth',
  'Modality',
  'Client Type',
  'Address',
  'Contact No',
  'Sex',
  'Educational Attainment',
  'Training Completed',
  'Institution/School',
  'Company',
  'Date Of Application',
  'Date Of Assessment',
  'Assessment Center',
  "Assessor's Name'",
  "Assessor's Accreditation Numner'",
  'Sector',
  'Type Of Certificate',
  'NC Title',
  'COC Title',
  'Assessment Result',
  'Certificate No',
  'Date Of Certificate',
  'Valid Until',
] as const;

const normalizeHeader = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

const textValue = (value: unknown) => String(value ?? '').trim();

const findValue = (record: TemplateRecord, header: string) => {
  const target = normalizeHeader(header);
  const entry = Object.entries(record).find(([key]) => normalizeHeader(key) === target);
  return entry?.[1];
};

const toIsoDate = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const parsed = new Date(excelEpoch + Math.floor(value) * 86_400_000);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }

  const text = textValue(value);
  if (!text) return null;

  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const mapStatus = (value: unknown): AssessmentRegistrationStatus => {
  const result = textValue(value).toUpperCase().replace(/[^A-Z]+/g, '_');
  if (result === 'COMPETENT') return 'COMPETENT';
  if (result === 'NOT_YET_COMPETENT' || result === 'NYC') return 'NOT_YET_COMPETENT';
  if (result === 'CANCELLED' || result === 'CANCELED') return 'CANCELLED';
  return result ? 'ASSESSED' : 'PENDING';
};

export const mapAssessmentTemplateRows = (records: TemplateRecord[]): AssessmentTemplateRow[] =>
  records
    .map((record, index) => {
      const certificateNumber = textValue(findValue(record, 'Certificate No'));
      const certificateDate = textValue(findValue(record, 'Date Of Certificate'));
      const validUntil = textValue(findValue(record, 'Valid Until'));
      const assessor = textValue(findValue(record, "Assessor's Name'"));
      const assessmentCenter = textValue(findValue(record, 'Assessment Center'));
      const notes = [
        'Imported from TESDA Registry of Workers Assessed and Certified.',
        certificateNumber && `Certificate: ${certificateNumber}`,
        certificateDate && `Certificate date: ${certificateDate}`,
        validUntil && `Valid until: ${validUntil}`,
        assessor && `Assessor: ${assessor}`,
        assessmentCenter && `Assessment center: ${assessmentCenter}`,
      ].filter(Boolean).join(' ');

      return {
        rowNumber: index + 2,
        referenceNumber: textValue(findValue(record, 'Reference Number')),
        learnerId: textValue(findValue(record, 'Learner ID')),
        firstName: textValue(findValue(record, 'First Name')),
        lastName: textValue(findValue(record, 'Last Name')),
        qualificationTitle:
          textValue(findValue(record, 'NC Title')) ||
          textValue(findValue(record, 'COC Title')) ||
          textValue(findValue(record, 'Training Completed')),
        assessmentDate: toIsoDate(findValue(record, 'Date Of Assessment')),
        status: mapStatus(findValue(record, 'Assessment Result')),
        notes,
      };
    })
    .filter(row =>
      row.referenceNumber ||
      row.learnerId ||
      row.firstName ||
      row.lastName ||
      row.qualificationTitle
    );

export const parseAssessmentRegistrationWorkbook = async (file: File): Promise<AssessmentTemplateRow[]> => {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('The workbook does not contain a worksheet.');

  const records = XLSX.utils.sheet_to_json<TemplateRecord>(workbook.Sheets[firstSheetName], {
    defval: '',
    raw: true,
  });
  if (records.length === 0) throw new Error('The worksheet does not contain any assessment records.');

  const rows = mapAssessmentTemplateRows(records);
  if (rows.length === 0) {
    throw new Error('No recognizable assessment rows were found in the worksheet.');
  }
  return rows;
};

export const downloadAssessmentRegistrationTemplate = async () => {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const registrySheet = XLSX.utils.aoa_to_sheet([ASSESSMENT_TEMPLATE_HEADERS]);
  registrySheet['!cols'] = ASSESSMENT_TEMPLATE_HEADERS.map(header => ({
    wch: Math.min(Math.max(header.length + 3, 14), 32),
  }));
  registrySheet['!autofilter'] = { ref: `A1:AF1` };

  const instructionsSheet = XLSX.utils.aoa_to_sheet([
    ['Assessment Registration Import Instructions'],
    ['1. Enter assessment records in the Registry sheet without changing the column headers.'],
    ['2. Reference Number must be unique.'],
    ['3. Learner ID must match an existing learner ULI in AT-ERP.'],
    ['4. NC Title or COC Title must match an existing qualification.'],
    ['5. Use MM/DD/YYYY for date fields.'],
    ['6. Assessment Result supports Competent, Not Yet Competent, Cancelled, or other assessed results.'],
    ['Required columns', 'Reference Number, Learner ID, NC Title or COC Title'],
  ]);
  instructionsSheet['!cols'] = [{ wch: 95 }, { wch: 55 }];

  XLSX.utils.book_append_sheet(workbook, registrySheet, 'Registry');
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
  XLSX.writeFile(workbook, 'Assessment-Registrations-TESDA-Import-Template.xlsx', {
    compression: true,
  });
};
