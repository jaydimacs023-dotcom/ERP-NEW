const TERM_DAYS: Record<string, number> = {
  COD: 0,
  'Net 7': 7,
  'Net 15': 15,
  'Net 30': 30,
  'Net 60': 60,
};

export const todayISO = () => new Date().toISOString().split('T')[0];

export const calculateInvoiceDueDate = (invoiceDate: string, terms?: string): string => {
  const daysToAdd = TERM_DAYS[String(terms || '').trim()];
  if (daysToAdd === undefined || !invoiceDate) return invoiceDate || '';

  const [year, month, day] = invoiceDate.split('-').map(Number);
  if (!year || !month || !day) return invoiceDate;

  const dueDate = new Date(Date.UTC(year, month - 1, day + daysToAdd));
  return dueDate.toISOString().split('T')[0];
};
