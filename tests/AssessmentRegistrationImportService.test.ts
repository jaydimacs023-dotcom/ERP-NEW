import { describe, expect, it } from 'vitest';
import {
  ASSESSMENT_TEMPLATE_HEADERS,
  mapAssessmentTemplateRows,
} from '../services/AssessmentRegistrationImportService';

describe('AssessmentRegistrationImportService', () => {
  it('provides the exact TESDA registry headers for the downloadable template', () => {
    expect(ASSESSMENT_TEMPLATE_HEADERS).toHaveLength(32);
    expect(ASSESSMENT_TEMPLATE_HEADERS).toContain('Reference Number');
    expect(ASSESSMENT_TEMPLATE_HEADERS).toContain('Learner ID');
    expect(ASSESSMENT_TEMPLATE_HEADERS).toContain('NC Title');
    expect(ASSESSMENT_TEMPLATE_HEADERS).toContain('Assessment Result');
  });

  it('maps the TESDA registry template into assessment registration fields', () => {
    const [row] = mapAssessmentTemplateRows([{
      'Reference Number': 'HEO261124280000091',
      'Learner ID': 'BAP-78-136-11024-001',
      'Last Name': 'BANGGA AN',
      'First Name': 'ALEXANDER',
      'Date Of Assessment': '07/02/2026',
      'Assessment Center': 'ENDONELA INSTITUTE',
      "Assessor's Name'": 'Rex Bryant L. Gran',
      'NC Title': 'Heavy Equipment Operation (Hydraulic Excavator) NC II',
      'Assessment Result': 'Competent',
      'Certificate No': 'CERT-001',
      'Valid Until': '07/01/2031',
    }]);

    expect(row).toMatchObject({
      rowNumber: 2,
      referenceNumber: 'HEO261124280000091',
      learnerId: 'BAP-78-136-11024-001',
      firstName: 'ALEXANDER',
      lastName: 'BANGGA AN',
      qualificationTitle: 'Heavy Equipment Operation (Hydraulic Excavator) NC II',
      assessmentDate: '2026-07-02',
      status: 'COMPETENT',
    });
    expect(row.notes).toContain('Certificate: CERT-001');
    expect(row.notes).toContain('Assessor: Rex Bryant L. Gran');
  });

  it('maps not-yet-competent results and falls back to the COC title', () => {
    const [row] = mapAssessmentTemplateRows([{
      'Reference Number': 'COC-001',
      'Learner ID': 'ULI-001',
      'COC Title': 'Perform pre-operation procedures',
      'Assessment Result': 'Not Yet Competent',
      'Date Of Assessment': '7/3/2026',
    }]);

    expect(row.qualificationTitle).toBe('Perform pre-operation procedures');
    expect(row.status).toBe('NOT_YET_COMPETENT');
    expect(row.assessmentDate).toBe('2026-07-03');
  });
});
