import { describe, expect, it } from 'vitest';
import { getAvailableFeeCode } from '../views/CourseFeesView';

describe('course fee code generation', () => {
  it('uses the first available code instead of relying on the fee count', () => {
    expect(getAvailableFeeCode('HEOHE-NCII', ['HEO-FEE-001', 'HEO-FEE-003']))
      .toBe('HEO-FEE-002');
  });

  it('does not collide with a custom or previously generated code', () => {
    expect(getAvailableFeeCode('HEOHE-NCII', [
      'heo-fee-001',
      'HEO-FEE-002',
      'HEO-FEE-004',
    ])).toBe('HEO-FEE-003');
  });
});
