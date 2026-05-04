import { describe, expect, it } from 'vitest';
import { calculateInvoiceDueDate } from '../utils/invoiceTerms';

describe('calculateInvoiceDueDate', () => {
  it('calculates due dates from the invoice date and terms', () => {
    expect(calculateInvoiceDueDate('2026-05-03', 'COD')).toBe('2026-05-03');
    expect(calculateInvoiceDueDate('2026-05-03', 'Net 7')).toBe('2026-05-10');
    expect(calculateInvoiceDueDate('2026-05-03', 'Net 15')).toBe('2026-05-18');
    expect(calculateInvoiceDueDate('2026-05-03', 'Net 30')).toBe('2026-06-02');
    expect(calculateInvoiceDueDate('2026-05-03', 'Net 60')).toBe('2026-07-02');
  });
});
