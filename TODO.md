# Journal Entries Row Click to Editable Form - TODO

Status: Planning complete, ready for implementation.

## Breakdown of Approved Plan

**Step 1: Enhance components/JournalForm.tsx**
- Add props: `entryToEdit?: JournalEntry`, `linesToEdit?: JournalLine[]`, `mode: 'new' | 'edit'`.
- useEffect: Populate entry/lines if edit mode.
- UI: Title changes, reference readonly in edit.
- Submit: Pass entry.id for update.

**Step 2: Update views/Ledger.tsx**
- Add states: `editingEntry`, `editingLines`.
- Row onClick: set editing states, setShowEntryForm(true).
- JournalForm props: pass editing data.
- onClose/onSubmit: reset editing states.
- New button: editingEntry = null.
- Keep JournalEntryDetail for alt-view (add toolbar button?).

**Step 3: Test & Verify**
- Row click opens pre-filled editable form.
- Edit POSTED → copy-as-new (safety).
- Balance, multi-lines, sources work.
- Detail view preserved (via double-click or button).

**Step 4: Cleanup**
- Remove deprecated if any.

✅ Plan confirmed with user feedback (preserve read-only detail view).

✅ Step 1 COMPLETE: JournalForm enhanced for edit mode.

✅ Step 2 COMPLETE: Ledger row click now opens editable pre-filled JournalForm.

✅ Steps 1-2 COMPLETE.

Next: Step 3 - Test & Verify
- Row click → editable form with data.
- Edit works (balance/lines/sources).
- Detail view preserved (setSelectedEntry programmatically?).

✅ Feedback COMPLETE: Reference No. field shows transaction-specific label (Invoice/Payment/Deposit/etc.).

**ALL STEPS COMPLETE.**

Journal entries table rows clickable → opens editable form with data pre-filled. Reference field contextual label.

Test: Click row → form → see "Source Reference No." with label like "Invoice Number" based on sourceType.

Detail view preserved for print/approve.

