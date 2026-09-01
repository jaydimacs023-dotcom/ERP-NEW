// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StockAdjustmentsView from '../views/StockAdjustmentsView';

const item = {
  id: 'item-1', orgId: 'org-1', code: 'PAPER-A4', name: 'A4 Paper', type: 'STOCK_ITEM',
  unitOfMeasure: 'REAM', isActive: true, isDeleted: false, standardCost: 250, costPrice: 250,
} as any;
const warehouse = { id: 'warehouse-1', code: 'MAIN', name: 'Main Warehouse', isActive: true, isDeleted: false };
const level = {
  id: 'level-1', orgId: 'org-1', stockItemId: item.id, warehouseLocationId: warehouse.id,
  quantityOnHand: 100, quantityReserved: 10, quantityAvailable: 90, isDeleted: false,
} as any;

afterEach(() => cleanup());

const renderView = (overrides: Record<string, unknown> = {}) => {
  const props = {
    adjustments: [], items: [item], levels: [level], locations: [warehouse], accounts: [],
    onAdd: vi.fn().mockResolvedValue(undefined), onUpdate: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined), onReverse: vi.fn().mockResolvedValue(undefined),
    currency: 'PHP', organization: { id: 'org-1', primaryColor: '#F47721' }, ...overrides,
  } as any;
  render(<StockAdjustmentsView {...props} />);
  return props;
};

describe('StockAdjustmentsView guided posting', () => {
  it('reviews a counted quantity and posts the server-checkable variance', async () => {
    const props = renderView();
    fireEvent.click(screen.getByRole('button', { name: /new count or adjustment/i }));
    const [itemSelect, warehouseSelect] = screen.getAllByRole('combobox');
    fireEvent.change(itemSelect, { target: { value: item.id } });
    fireEvent.change(warehouseSelect, { target: { value: warehouse.id } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '87' } });
    fireEvent.change(screen.getByLabelText(/^reason/i), { target: { value: 'Monthly count variance' } });
    fireEvent.click(screen.getByRole('button', { name: /review impact/i }));

    expect(screen.getByText('-13 REAM')).toBeTruthy();
    expect(screen.getAllByText('87 REAM')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /approve and post/i }));

    await waitFor(() => expect(props.onAdd).toHaveBeenCalledWith(expect.objectContaining({
      adjustmentType: 'PHYSICAL_COUNT', expectedQuantity: 100, countedQuantity: 87,
      quantityChange: -13, postingDate: expect.any(String),
    })));
  });

  it('blocks an outbound event that would create negative stock', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: /new count or adjustment/i }));
    fireEvent.click(screen.getByRole('radio', { name: /item was damaged/i }));
    const [itemSelect, warehouseSelect] = screen.getAllByRole('combobox');
    fireEvent.change(itemSelect, { target: { value: item.id } });
    fireEvent.change(warehouseSelect, { target: { value: warehouse.id } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '101' } });
    fireEvent.change(screen.getByLabelText(/^reason/i), { target: { value: 'Water damage' } });
    fireEvent.click(screen.getByRole('button', { name: /review impact/i }));
    expect(screen.getByText(/only 100 ream are on hand/i)).toBeTruthy();
  });

  it('offers reversal instead of edit or delete for posted adjustments', () => {
    renderView({ adjustments: [{
      id: 'adj-1', orgId: 'org-1', adjustmentNumber: 'ADJ-001', stockItemId: item.id,
      warehouseLocationId: warehouse.id, adjustmentType: 'DAMAGE', quantity: 2,
      quantityChange: -2, reason: 'Damaged', isApproved: true, journalEntryId: 'journal-1',
      createdAt: '2026-09-01T00:00:00Z',
    }] });
    expect(screen.getByRole('button', { name: /reverse/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });
});
