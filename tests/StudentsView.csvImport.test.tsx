// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StudentsView from '../views/StudentsView';
import { LEARNER_CSV_HEADERS } from '../services/LearnerCsvService';

vi.mock('../services/DataServiceFactory', () => ({
  DataServiceFactory: {
    getService: () => ({
      fetchPage: vi.fn().mockResolvedValue({ rows: [], total: 0, totalPages: 1 }),
    }),
  },
}));

const validRow = 'Dela Cruz,Juan,,,"",09171234567,juan@example.com,"12 Rizal St., Central",Barangay 1,Manila,,Metro Manila,Male,1990-02-28,,Single,College Graduate,Filipino';

function renderView(onBatchAddStudents = vi.fn().mockResolvedValue(undefined)) {
  const result = render(
    <StudentsView
      orgId="org-1"
      students={[]}
      batches={[]}
      qualifications={[]}
      brandColor="#2563eb"
      onAddStudent={vi.fn()}
      onUpdateStudent={vi.fn()}
      onDeleteStudent={vi.fn()}
      onBatchAddStudents={onBatchAddStudents}
    />
  );
  const input = result.container.querySelector('input[type="file"]') as HTMLInputElement;
  return { ...result, input, onBatchAddStudents };
}

async function uploadCsv(input: HTMLInputElement, contents: string) {
  fireEvent.change(input, { target: { files: [new File([contents], 'learners.csv', { type: 'text/csv' })] } });
  await screen.findByRole('dialog', { name: /batch import preview/i });
}

describe('StudentsView learner CSV import', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('disables commit when uploaded rows contain validation errors', async () => {
    const { input, onBatchAddStudents } = renderView();
    await uploadCsv(input, `${LEARNER_CSV_HEADERS.join(',')}\nDela Cruz,Juan,,,,,not-an-email,,,,,,,not-a-date,,,,`);
    expect(screen.getByRole('button', { name: /commit/i })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address');
    expect(onBatchAddStudents).not.toHaveBeenCalled();
  });

  it('displays the actual source row for malformed CSV quoting', async () => {
    const { input } = renderView();
    await uploadCsv(input, `${LEARNER_CSV_HEADERS.join(',')}\n"Dela Cruz"x,Juan,,,,,juan@example.com,,,,,,,1990-02-28,,,,`);
    expect(screen.getByRole('alert')).toHaveTextContent('Row 2');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Row 1');
    expect(screen.getByText(/1 invalid \(1 error\)/i)).toBeInTheDocument();
  });

  it('keeps the preview open and reports a rejected async import', async () => {
    const onBatchAddStudents = vi.fn().mockRejectedValue(new Error('Database unavailable'));
    const { input } = renderView(onBatchAddStudents);
    await uploadCsv(input, `${LEARNER_CSV_HEADERS.join(',')}\n${validRow}`);
    fireEvent.click(screen.getByRole('button', { name: /commit 1 records/i }));
    await screen.findByText('Database unavailable');
    expect(screen.getByRole('dialog', { name: /batch import preview/i })).toBeInTheDocument();
  });

  it('shows preview columns and values in exact template order', async () => {
    const { input } = renderView();
    await uploadCsv(input, `${LEARNER_CSV_HEADERS.join(',')}\n${validRow}`);
    const dialog = screen.getByRole('dialog', { name: /batch import preview/i });
    expect(within(dialog).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual([...LEARNER_CSV_HEADERS]);
    const cells = within(dialog).getAllByRole('cell').map(cell => cell.textContent);
    expect(cells.slice(0, 14)).toEqual([
      'Dela Cruz', 'Juan', '—', '—', '—', '09171234567', 'juan@example.com',
      '12 Rizal St., Central', 'Barangay 1', 'Manila', '—', 'Metro Manila', 'Male', '1990-02-28',
    ]);
    expect(cells[14]).toMatch(/^\d+$/);
    expect(cells.slice(15)).toEqual(['Single', 'College Graduate', 'Filipino']);
  });

  it('closes only after the async import resolves', async () => {
    let resolveImport!: () => void;
    const pending = new Promise<void>(resolve => { resolveImport = resolve; });
    const onBatchAddStudents = vi.fn().mockReturnValue(pending);
    const { input } = renderView(onBatchAddStudents);
    await uploadCsv(input, `${LEARNER_CSV_HEADERS.join(',')}\n${validRow}`);
    fireEvent.click(screen.getByRole('button', { name: /commit 1 records/i }));
    expect(screen.getByRole('dialog', { name: /batch import preview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /importing/i })).toBeDisabled();

    resolveImport();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /batch import preview/i })).not.toBeInTheDocument());
    expect(await screen.findByText('1 learners imported successfully!')).toBeInTheDocument();
  });
});
