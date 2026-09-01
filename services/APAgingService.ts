import type { IDataService } from './IDataService';
import type { Payable } from '../types';

export const getPayableOutstanding = (payable: Payable): number => {
  const vatInclusiveAmount = Math.round(
    (Number(payable.amount || 0) + Number(payable.inputVatAmount || 0)) * 100
  ) / 100;
  const outstanding = vatInclusiveAmount -
    Number(payable.withholdingAmount || 0) +
    Number(payable.memoAdjustmentTotal || 0) -
    Number(payable.paidAmount || 0);

  return payable.invoiceType === 'credit_memo'
    ? -Math.abs(outstanding)
    : Math.max(0, outstanding);
};

export const fetchAllOpenPayables = async (
  service: IDataService,
  orgId: string,
  columns: string,
): Promise<Payable[]> => {
  const rows: Payable[] = [];
  const pageSize = 500;
  let page = 1;
  let totalPages = 1;

  do {
    const result = await service.fetchPage<Payable>('payables', {
      page,
      pageSize,
      columns,
      filters: [
        { column: 'org_id', operator: 'eq', value: orgId },
        { column: 'is_deleted', operator: 'eq', value: false },
        { column: 'status', operator: 'in', value: ['approved', 'partially_paid'] },
      ],
      orderBy: [{ column: 'due_date', ascending: true }, { column: 'created_at', ascending: true }],
    });
    rows.push(...result.rows);
    totalPages = result.totalPages;
    page += 1;
  } while (page <= totalPages);

  return rows;
};
