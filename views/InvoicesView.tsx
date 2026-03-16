import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, InvoiceLine, InvoiceStatus, Sponsor, Student, Enrollment, Batch, Qualification, CourseFee, ChartOfAccount, AccountClass, StudentLedger, JournalEntry, TaxCategoryEntry, Organization } from '../types';
import { generateUUID } from '../utils/uuid';
import ModalPortal from '../components/ModalPortal';
import {
  FileText, Plus, Search, Filter, X, Save, Trash2, Edit3, Eye,
  Building2, User, Calendar, DollarSign, Percent, CheckCircle,
  Clock, XCircle, AlertTriangle, Receipt, Download, Printer,
  RotateCcw, MoreHorizontal, Scissors, CornerUpLeft,
  ChevronDown, ChevronUp, MoreVertical, Send, Ban, Wand2, Users,
  GraduationCap, CheckSquare, Square, Calculator, FileSpreadsheet, ArrowUpDown
} from 'lucide-react';



interface InvoicesViewProps {
  invoices: Invoice[];
  sponsors: Sponsor[];
  students: Student[];
  enrollments: Enrollment[];
  batches: Batch[];
  qualifications: Qualification[];
  courseFees: CourseFee[];
  accounts: ChartOfAccount[];
  currency: string;
  isVatRegistered?: boolean;
  onAddInvoice: (invoice: Invoice) => void;
  onUpdateInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => Promise<boolean>;
  onPostInvoice?: (invoice: Invoice) => void;
  onVoidInvoice?: (id: string, reason: string) => void;
  onUpdateEnrollment?: (enrollment: Enrollment) => void; // For updating billing status after invoice generation
  journalEntries?: JournalEntry[];
  onAddStudentLedgerEntry?: (entry: StudentLedger) => void; // For AR subsidiary ledger
  onViewJournal?: (journalEntryId: string) => void;
  organization?: Organization;
  orgId: string;
  taxCategories: TaxCategoryEntry[];
  onNavigate?: (tab: string, context?: any) => void;
}

const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices, sponsors, students, enrollments, batches, qualifications, courseFees, accounts, currency, isVatRegistered,
  onAddInvoice, onUpdateInvoice, onDeleteInvoice, onPostInvoice, onVoidInvoice, onUpdateEnrollment, onAddStudentLedgerEntry,
  onViewJournal,
  journalEntries = [],
  organization,
  orgId,
  taxCategories,
  onNavigate
}) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'FORM'>('LIST');
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false); // Generate from enrollments wizard
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [printingInvoice, setPrintingInvoice] = useState<Invoice | null>(null);
  const [voidingInvoice, setVoidingInvoice] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState<'ALL' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | 'none' }>({ key: 'invoiceDate', direction: 'desc' });
  const [filterSponsorId, setFilterSponsorId] = useState('ALL');
  const [filterStudentId, setFilterStudentId] = useState('ALL');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Drag-and-drop column ordering state
  const [columnOrder, setColumnOrder] = useState<string[]>([
    'invoiceNo', 'status', 'glReference', 'payer', 'invoiceDate', 'totalAmount', 'balance'
  ]);
  const [draggedColumnIdx, setDraggedColumnIdx] = useState<number | null>(null);

  // Column resize state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizeRef = React.useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);

  // local copy of tax categories; we fetch from backend when form is active
  const [localTaxCats, setLocalTaxCats] = useState<TaxCategoryEntry[]>(taxCategories);

  // Sponsor/Student (Payer) Custom Filter State
  const [showPayerDropdown, setShowPayerDropdown] = useState(false);
  const [payerFilterMode, setPayerFilterMode] = useState<'ALL' | 'CUSTOM'>('ALL');
  const [payerSearchTerm, setPayerSearchTerm] = useState('');
  const [showExportDropdown, setShowExportDropdown] = useState(false);


  // Derived: Students in the batch for annex
  const batchStudents = React.useMemo(() => {
    if (!showViewModal || !viewingInvoice?.batchId) return [];
    const batchEnrollments = enrollments.filter(e => e.batchId === viewingInvoice.batchId && !e.isDeleted);
    return batchEnrollments.map(e => {
      const student = students.find(s => s.id === e.studentId);
      return student ? {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        studentNo: student.studentNo || student.id,
        courseName: qualifications.find(q => q.id === student.qualificationId)?.name || '',
      } : null;
    }).filter(Boolean);
  }, [showViewModal, viewingInvoice, enrollments, students, qualifications]);

  // Generate from Enrollments state
  const [selectedSponsorId, setSelectedSponsorId] = useState<string>('');
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<Set<string>>(new Set());
  const [generateInvoiceDate, setGenerateInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [generateDueDate, setGenerateDueDate] = useState<string>(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  // Form state
  const [formData, setFormData] = useState<{
    invoiceNo: string;
    sponsorId: string;
    studentId: string;
    enrollmentId: string;
    batchId: string;
    invoiceDate: string;
    dueDate: string;
    notes: string;
    vatPricing: 'EXCLUSIVE' | 'INCLUSIVE' | 'EXEMPT';
    vatRate: number;
    glEntryNumber?: string;
    lines: InvoiceLine[];
  }>({
    invoiceNo: '',
    sponsorId: '',
    studentId: '',
    enrollmentId: '',
    batchId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'DRAFT',
    reference: '',
    terms: 'Net 30',
    notes: '',
    vatPricing: 'INCLUSIVE',
    vatRate: 0.12,
    glEntryNumber: '',
    lines: []
  });

  const brandColor = '#F47721';

  // Check if form should be read-only (invoice is approved and locked)
  const isReadOnly = editingInvoice?.status === 'OPEN';

  // Generate next invoice number
  const generateInvoiceNo = () => {
    const year = new Date().getFullYear();
    const existingNums = invoices
      .filter(i => i.invoiceNo?.startsWith(`INV-${year}-`))
      .map(i => parseInt(i.invoiceNo?.split('-')[2] || '0'))
      .filter(n => !isNaN(n));
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    return `INV-${year}-${String(nextNum).padStart(5, '0')}`;
  };

  // Calculate totals (simple version without VatService)
  const calculateTotals = (lines: InvoiceLine[]) => {
    const subtotal = lines.reduce((sum, l) => sum + (l.netAmount || 0), 0);
    const vatAmount = lines.reduce((sum, l) => sum + (l.vatAmount || 0), 0);
    // grand total should be subtotal + vat, not sum of gross amounts
    const grandTotal = Math.round((subtotal + vatAmount) * 100) / 100;
    return {
      subtotal,
      vatAmount,
      grandTotal,
      totalEwtAmount: 0,
      netAmountDue: grandTotal,
      balanceDue: grandTotal
    };
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      invoiceNo: generateInvoiceNo(),
      sponsorId: '',
      studentId: '',
      enrollmentId: '',
      batchId: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'DRAFT',
      reference: '',
      terms: 'Net 30',
      vatPricing: 'INCLUSIVE',
      vatRate: 0.12,
      glEntryNumber: '',
      lines: []
    });
    setEditingInvoice(null);
    setViewMode('LIST');
  };

  // Open form for new invoice
  const handleNew = () => {
    resetForm();
    setViewMode('FORM');
  };

  // Open modal for editing
  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      invoiceNo: invoice.invoiceNo,
      sponsorId: invoice.sponsorId || '',
      studentId: invoice.studentId || '',
      enrollmentId: invoice.enrollmentId || '',
      batchId: invoice.batchId || '',
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      reference: invoice.reference || '',
      terms: invoice.terms || '',
      notes: invoice.notes || '',
      vatPricing: invoice.vatPricing || 'INCLUSIVE',
      vatRate: invoice.vatRate || 0.12,
      glEntryNumber: invoice.glEntryNumber || '',
      lines: invoice.lines || []
    });
    setViewMode('FORM');
  };

  // keep localTaxCats in sync with prop; fetch from backend if still empty
  // keep in sync with parent property
  useEffect(() => {
    if (taxCategories && taxCategories.length > 0) {
      console.debug('[InvoicesView] prop taxCategories', taxCategories.length);
      setLocalTaxCats(taxCategories);
    } else {
      console.debug('[InvoicesView] prop taxCategories empty or undefined');
    }
  }, [taxCategories]);

  // refresh tax categories when invoice form becomes active (viewMode changes)
  useEffect(() => {
    if (viewMode === 'FORM' && orgId) {
      console.debug('[InvoicesView] viewMode FORM; fetching tax categories for org', orgId);
      import('../services/DataServiceFactory').then(({ DataServiceFactory }) => {
        DataServiceFactory.getService()
          .fetchTaxCategories(orgId)
          .then(cats => {
            console.debug('[InvoicesView] fetched tax categories', cats);
            if (!cats || cats.length === 0) {
              console.warn('[InvoicesView] no tax categories returned for org', orgId);
            }
            setLocalTaxCats(cats);
          })
          .catch(err => console.error('Failed to fetch tax categories', err));
      });
    }
  }, [viewMode, orgId]);

  // whenever the list of tax categories changes, recompute net/vat/gross for existing lines
  // but do NOT touch the visible amount â€“ leave whatever the user entered intact
  useEffect(() => {
    console.debug('[InvoicesView] localTaxCats changed', localTaxCats.length);
    if (viewMode === 'FORM' && formData.lines.length > 0 && localTaxCats.length > 0) {
      setFormData(prev => {
        const updated = prev.lines.map(line => {
          const { netAmount, vatAmount, grossAmount } = computeAmounts(line);
          return { ...line, netAmount, vatAmount, grossAmount };
        });
        return { ...prev, lines: updated };
      });
    }
  }, [localTaxCats, viewMode, formData.lines.length]);

  // View invoice details
  const handleView = (invoice: Invoice) => {
    setViewingInvoice(invoice);
    setShowViewModal(true);
  };

  const handlePrintPreview = (invoice: Invoice) => {
    setPrintingInvoice(invoice);
    setShowPrintModal(true);
  };

  // Handle sponsor change - auto-fill EWT rate
  const handleSponsorChange = (sponsorId: string) => {
    setFormData(prev => ({
      ...prev,
      sponsorId
    }));
  };

  // Recalculate VAT for all lines when VAT settings change or during initial edit load
  useEffect(() => {
    if (viewMode === 'FORM' && formData.lines.length > 0) {
      setFormData(prev => {
        let linesChanged = false;
        const sponsor = sponsors.find(s => s.id === prev.sponsorId);
        const taxType = sponsor?.taxType || 'NON_VAT';
        const isInclusive = prev.vatPricing === 'INCLUSIVE';

        const mappedLines = prev.lines.map(line => {
          const { netAmount, vatAmount, grossAmount } = computeAmounts(line as InvoiceLine);
          if (line.netAmount !== netAmount || line.vatAmount !== vatAmount || line.grossAmount !== grossAmount) {
            linesChanged = true;
            return {
              ...line,
              netAmount,
              vatAmount,
              grossAmount
              // amount left untouched so user entries persist
            };
          }
          return line;
        });

        if (linesChanged) {
          return { ...prev, lines: mappedLines };
        }
        return prev;
      });
    }
  }, [viewMode, formData.vatPricing, formData.vatRate, formData.sponsorId, sponsors]);

  // Handle batch change - auto-fill sponsor, quantity, and line items
  const handleBatchChange = (batchId: string) => {
    const batch = batches.find(b => b.id === batchId);
    if (!batch) {
      setFormData(prev => ({ ...prev, batchId: '', sponsorId: '', studentId: '', lines: [] }));
      return;
    }

    const batchEnrollments = enrollments.filter(e => e.batchId === batchId && !e.isDeleted);
    const studentsInBatch = batchEnrollments
      .map(e => students.find(s => s.id === e.studentId))
      .filter((s): s is Student => !!s && !s.isDeleted);
    const sponsorId = batch.sponsorId || '';

    // if there are already lines, do not override description/course fee/unit price/amount
    if (formData.lines.length > 0) {
      setFormData(prev => ({
        ...prev,
        batchId,
        sponsorId,
        studentId: sponsorId ? '' : (studentsInBatch[0]?.id || prev.studentId || '')
      }));
      return;
    }

    const qualificationFees = courseFees.filter(f => f.qualificationId === batch.qualificationId && f.isActive && !f.isDeleted);

    // Count students from enrollments
    const studentCount = batchEnrollments.length || batch.studentIds?.length || 0;

    const newLines: InvoiceLine[] = qualificationFees.map((fee, idx) => {
      const qty = sponsorId ? studentCount : 1;
      const netAmount = Math.round(qty * (fee.amount || 0) * 100) / 100;
      const vatAmount = 0;
      const grossAmount = netAmount; // initially no tax

      return {
        id: generateUUID(),
        invoiceId: editingInvoice?.id || '',
        lineNumber: idx + 1,
        description: fee.feeName,
        courseFeeId: fee.id,
        quantity: qty,
        unitPrice: fee.amount || 0,
        netAmount,
        vatAmount,
        grossAmount,
        amount: netAmount,
        glAccountId: fee.glAccountId
      };
    });

    setFormData(prev => ({
      ...prev,
      batchId,
      sponsorId,
      studentId: sponsorId ? '' : (studentsInBatch[0]?.id || ''),
      lines: newLines
    }));
  };

  // Add line
  const handleAddLine = () => {
    const newLine: InvoiceLine = {
      id: generateUUID(),
      invoiceId: editingInvoice?.id || '',
      orgId,
      lineNumber: formData.lines.length + 1,
      description: '',
      quantity: 1,
      unitPrice: 0,
      netAmount: 0,
      vatAmount: 0,
      grossAmount: 0,
      amount: 0,
      taxCategoryId: ''
    };
    setFormData(prev => ({ ...prev, lines: [...prev.lines, newLine] }));
  };

  // helper â€“ calculate amounts based on selected tax category
  //
  // The amount calculation always revolves around a *base* value which
  // helper â€“ calculate amounts based on selected tax category
  //
  // The amount calculation always revolves around a *base* value which
  // originally represented the gross figure but we now display the net
  // amount in the invoice lines. By default the base is computed as quantity
  // Ã— unitPrice, but if an explicit `line.amount` value is present we treat
  // that as the base so manual adjustments (e.g. import or override) are
  // respected.
  //
  // VAT is now always computed using a unified formula for special tax
  // category codes (VATGOODS, VATSERV, NVGOODS, NVSERV, EXMPTGOODS,
  // EXMPTSERV, ZEROGOODS, ZEROSERV).  The formula is:
  //
  //     vat = amount Ã· 1.12 Ã— rate
  //
  // with rate 12% for the first six codes and 0% for the zeroâ€‘rated ones.
  // This reflects the user's request to treat nonâ€‘VAT, exempt, and regular
  // categories identically for output VAT computation.  For all other
  // categories we fall back to the previous inclusive/exclusive logic.

  const extractVat = (amount: number, cat?: TaxCategoryEntry): number => {
    if (!cat) return 0;
    const code = (cat.code || '').toUpperCase();
    let rateOverride: number | undefined;
    if (/^(VATGOODS|VATSERV)$/.test(code)) {
      // use prescribed formula: line amount is assumed inclusive
      // vat = amount / 1.12 * 12%
      rateOverride = 0.12;
    } else if (/^(NVGOODS|NVSERV|EXMPTGOODS|EXMPTSERV|ZEROGOODS|ZEROSERV)$/.test(code)) {
      // these categories are treated as 0% vat using the same base formula
      rateOverride = 0;
    }
    if (rateOverride !== undefined) {
      return Math.round((amount / 1.12 * rateOverride) * 100) / 100;
    }
    // nonâ€‘special categories: use existing rate based logic
    if (typeof cat.rate === 'number') {
      const r = cat.rate > 1 ? cat.rate / 100 : cat.rate;
      if (cat.isInclusive) {
        return Math.round((amount / (1 + r) * r) * 100) / 100;
      }
      return Math.round(amount * r * 100) / 100;
    }
    return 0;
  };

  const computeAmounts = (line: InvoiceLine) => {
    const qty = line.quantity || 0;
    const price = line.unitPrice || 0;
    // start with qty*price but allow explicit override
    let base = Math.round(qty * price * 100) / 100;
    if (line.amount && line.amount > 0) {
      base = line.amount;
    }

    let netAmount = base;
    let vatAmount = 0;
    let grossAmount = base;

    if (line.taxCategoryId) {
      const cat = localTaxCats.find(c => c.id === line.taxCategoryId);
      if (cat) {
        vatAmount = extractVat(base, cat);
        netAmount = Math.round((base - vatAmount) * 100) / 100;
        grossAmount = base;
      }
    }
    return { netAmount, vatAmount, grossAmount };
  };

  // Update line
  const handleUpdateLine = (index: number, field: keyof InvoiceLine, value: any) => {
    setFormData(prev => {
      const lines = [...prev.lines];
      lines[index] = { ...lines[index], [field]: value };

      // when qty or unit price change, we may want to autoâ€‘populate the amount
      if ((field === 'quantity' || field === 'unitPrice')) {
        // only update the amount if the user hasn't already overridden it (i.e. it's zero)
        if (!lines[index].amount) {
          const qty = lines[index].quantity || 0;
          const upr = lines[index].unitPrice || 0;
          lines[index].amount = Math.round(qty * upr * 100) / 100;
        }
      }

      // Recompute net/vat/gross when any of the relevant fields change
      if (field === 'quantity' || field === 'unitPrice' || field === 'taxCategoryId' || field === 'amount') {
        const { netAmount, vatAmount, grossAmount } = computeAmounts(lines[index]);
        lines[index].netAmount = netAmount;
        lines[index].vatAmount = vatAmount;
        lines[index].grossAmount = grossAmount;
        // do not touch `amount` when tax category changes â€“ user value stays
        // if the user edited the amount directly we already set it above
      }
      return { ...prev, lines };
    });
  };

  // Remove line
  const handleRemoveLine = (index: number) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index).map((l, i) => ({ ...l, lineNumber: i + 1 }))
    }));
  };

  // Apply course fee to line
  const handleApplyCourseFee = (index: number, courseFeeId: string) => {
    const fee = courseFees.find(f => f.id === courseFeeId);
    if (fee) {
      const sponsor = sponsors.find(s => s.id === formData.sponsorId);
      const qty = formData.lines[index].quantity || 1;
      const unitPrice = fee.amount || 0;
      const tempLine: InvoiceLine = {
        ...formData.lines[index],
        quantity: qty,
        unitPrice,
        taxCategoryId: fee.taxCategoryId || formData.lines[index].taxCategoryId || ''
      };
      const { netAmount, vatAmount, grossAmount } = computeAmounts(tempLine);

      const updatedLines = [...formData.lines];
      updatedLines[index] = {
        ...updatedLines[index],
        courseFeeId,
        description: fee.feeName,
        unitPrice,
        netAmount,
        vatAmount,
        grossAmount,
        amount: netAmount,
        glAccountId: fee.glAccountId || updatedLines[index].glAccountId,
        taxCategoryId: fee.taxCategoryId || updatedLines[index].taxCategoryId
      };

      setFormData(prev => ({ ...prev, lines: updatedLines }));
    }
  };

  // Save invoice
  const handleSave = () => {
    if (!formData.sponsorId && !formData.studentId) {
      alert('Please select a sponsor or student.');
      return;
    }
    if (formData.lines.length === 0) {
      alert('Please add at least one line item.');
      return;
    }

    const totals = calculateTotals(formData.lines);

    const invoice: Invoice = {
      id: editingInvoice?.id || generateUUID(),
      orgId: editingInvoice?.orgId || '',
      invoiceNo: formData.invoiceNo,
      sponsorId: formData.sponsorId || undefined,
      studentId: formData.studentId || undefined,
      enrollmentId: formData.enrollmentId || undefined,
      batchId: formData.batchId || undefined,
      invoiceDate: formData.invoiceDate,
      dueDate: formData.dueDate,
      status: formData.status,
      vatPricing: formData.vatPricing,
      vatRate: formData.vatRate,
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      grandTotal: totals.grandTotal,
      totalEwtAmount: 0,
      netAmountDue: totals.grandTotal,
      amountPaid: editingInvoice?.amountPaid || 0,
      balanceDue: totals.grandTotal - (editingInvoice?.amountPaid || 0),
      reference: formData.reference || undefined,
      terms: formData.terms || undefined,
      notes: formData.notes || undefined,
      lines: formData.lines.map(l => ({ ...l, invoiceId: editingInvoice?.id || '' })),
      createdAt: editingInvoice?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (editingInvoice) {
      onUpdateInvoice(invoice);
    } else {
      onAddInvoice(invoice);
    }

    resetForm();
    setViewMode('LIST');
  };

  // Approve invoice
  const handleApprove = () => {
    if (!formData.sponsorId && !formData.studentId) {
      alert('Please select a sponsor or student.');
      return;
    }
    if (formData.lines.length === 0) {
      alert('Please add at least one line item.');
      return;
    }

    const totals = calculateTotals(formData.lines);

    const invoice: Invoice = {
      id: editingInvoice?.id || generateUUID(),
      orgId: editingInvoice?.orgId || '',
      invoiceNo: formData.invoiceNo,
      sponsorId: formData.sponsorId || undefined,
      studentId: formData.studentId || undefined,
      enrollmentId: formData.enrollmentId || undefined,
      batchId: formData.batchId || undefined,
      invoiceDate: formData.invoiceDate,
      dueDate: formData.dueDate,
      status: 'OPEN',
      vatPricing: formData.vatPricing,
      vatRate: formData.vatRate,
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      grandTotal: totals.grandTotal,
      totalEwtAmount: 0,
      netAmountDue: totals.grandTotal,
      amountPaid: editingInvoice?.amountPaid || 0,
      balanceDue: totals.grandTotal - (editingInvoice?.amountPaid || 0),
      reference: formData.reference || undefined,
      terms: formData.terms || undefined,
      notes: formData.notes || undefined,
      lines: formData.lines.map(l => ({ ...l, invoiceId: editingInvoice?.id || '' })),
      createdAt: editingInvoice?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      postedAt: new Date().toISOString()
    };

    if (editingInvoice) {
      onUpdateInvoice(invoice);
    } else {
      onAddInvoice(invoice);
    }

    resetForm();
    setViewMode('LIST');
  };

  // Post invoice
  const handlePost = (invoice: Invoice) => {
    // Subsidiary Ledger: For sponsor-billed invoices, create StudentLedger entries for each student in the batch
    if (invoice.sponsorId && onAddStudentLedgerEntry) {
      // Find all enrollments for this sponsor and batch
      const coveredEnrollments = enrollments.filter(e => e.sponsorId === invoice.sponsorId && (!invoice.batchId || e.batchId === invoice.batchId));
      // Distribute netAmountDue equally if possible, else use enrollment.feeAmount or fallback
      const perStudentAmount = coveredEnrollments.length > 0 ? invoice.netAmountDue / coveredEnrollments.length : 0;
      coveredEnrollments.forEach(e => {
        onAddStudentLedgerEntry({
          id: generateUUID(),
          orgId: invoice.orgId,
          studentId: e.studentId,
          invoiceId: invoice.id,
          date: invoice.invoiceDate,
          description: `Sponsor-billed: ${sponsors.find(s => s.id === invoice.sponsorId)?.name || 'Sponsor'} Invoice ${invoice.invoiceNo}`,
          debit: 0,
          credit: perStudentAmount,
          balance: 0, // Will be recomputed in ledger view
          sponsorId: invoice.sponsorId,
          createdAt: new Date().toISOString(),
        });
      });
    }
    if (onPostInvoice) {
      onPostInvoice({ ...invoice, status: 'OPEN', postedAt: new Date().toISOString() });
    } else {
      onUpdateInvoice({ ...invoice, status: 'OPEN', postedAt: new Date().toISOString() });
    }
  };

  // Void invoice
  const handleVoid = () => {
    if (voidingInvoice && voidReason.trim()) {
      if (onVoidInvoice) {
        onVoidInvoice(voidingInvoice.id, voidReason);
      } else {
        onUpdateInvoice({
          ...voidingInvoice,
          status: 'VOIDED',
          voidedAt: new Date().toISOString(),
          voidReason
        });
      }
      setShowVoidModal(false);
      setVoidingInvoice(null);
      setVoidReason('');
    }
  };

  // Toggle row expansion
  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch =
        inv.invoiceNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.glEntryNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sponsors.find(s => s.id === inv.sponsorId)?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        students.find(s => s.id === inv.studentId)?.firstName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
      
      let matchesDate = true;
      const today = new Date().toISOString().split('T')[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      if (dateFilterMode === 'TODAY') {
        matchesDate = inv.invoiceDate === today;
      } else if (dateFilterMode === 'THIS_MONTH') {
        matchesDate = inv.invoiceDate >= firstDayOfMonth && inv.invoiceDate <= today;
      } else if (dateFilterMode === 'CUSTOM') {
        matchesDate = (!dateFrom || inv.invoiceDate >= dateFrom) && 
                      (!dateTo || inv.invoiceDate <= dateTo);
      }
      
      // Sponsor/Student (Payer) filter
      let matchesPayer = true;
      if (payerFilterMode === 'CUSTOM' && payerSearchTerm.trim() !== '') {
        let payerName = '';
        if (inv.sponsorId) {
          payerName = sponsors.find(s => s.id === inv.sponsorId)?.name || '';
        } else if (inv.studentId) {
          const st = students.find(s => s.id === inv.studentId);
          payerName = st ? `${st.lastName}, ${st.firstName}` : '';
        }
        matchesPayer = payerName.toLowerCase().includes(payerSearchTerm.trim().toLowerCase());
      } else {
        const matchesSponsor = filterSponsorId === 'ALL' || inv.sponsorId === filterSponsorId;
        const matchesStudent = filterStudentId === 'ALL' || inv.studentId === filterStudentId;
        matchesPayer = matchesSponsor && matchesStudent;
      }

      return matchesSearch && matchesStatus && matchesDate && matchesPayer;
    }).sort((a, b) => {
      if (sortConfig.direction === 'none') return 0;
      
      const key = sortConfig.key;
      let valA: any = (a as any)[key];
      let valB: any = (b as any)[key];

      // Handle specific keys that need derivation
      if (key === 'payer') {
        const payerA = a.sponsorId ? sponsors.find(s => s.id === a.sponsorId)?.name : students.find(s => s.id === a.studentId)?.lastName;
        const payerB = b.sponsorId ? sponsors.find(s => s.id === b.sponsorId)?.name : students.find(s => s.id === b.studentId)?.lastName;
        valA = payerA || '';
        valB = payerB || '';
      }

      if (key === 'invoiceDate') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (key === 'totalAmount') {
        valA = a.grandTotal;
        valB = b.grandTotal;
      }

      if (key === 'balance') {
        valA = a.balanceDue;
        valB = b.balanceDue;
      }

      if (typeof valA === 'string') {
        const comparison = valA.localeCompare(valB);
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      const comparison = (valA || 0) - (valB || 0);
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [invoices, searchTerm, statusFilter, dateFilterMode, dateFrom, dateTo, filterSponsorId, filterStudentId, sponsors, students, sortConfig, payerFilterMode, payerSearchTerm]);

  // Summary stats
  const stats = useMemo(() => {
    const draft = invoices.filter(i => i.status === 'DRAFT');
    const open = invoices.filter(i => i.status === 'OPEN');
    const closed = invoices.filter(i => i.status === 'CLOSED');
    const voided = invoices.filter(i => i.status === 'VOIDED');
    const totalOutstanding = open.reduce((sum, i) => sum + i.balanceDue, 0);
    const totalEwt = invoices.filter(i => i.status !== 'VOIDED').reduce((sum, i) => sum + i.totalEwtAmount, 0);
    return { draft, open, closed, voided, totalOutstanding, totalEwt };
  }, [invoices]);

  // Header Sort Toggle
  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIndicator = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="ml-1 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={12} className="ml-1 text-blue-600" /> 
      : <ChevronDown size={12} className="ml-1 text-blue-600" />;
  };

  // Helpers
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: currency || 'PHP' }).format(amount);
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    const badges: Record<InvoiceStatus, { bg: string; text: string; label: string; title?: string }> = {
      'DRAFT': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'ON HOLD', title: 'Invoice saved as draft, pending approval' },
      'OPEN': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'OPEN' },
      'CLOSED': { bg: 'bg-slate-100', text: 'text-slate-700', label: 'CLOSED' },
      'VOIDED': { bg: 'bg-rose-100', text: 'text-rose-700', label: 'VOIDED' }
    };
    const badge = badges[status];
    return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badge.bg} ${badge.text}`} title={badge.title || ''}>{badge.label}</span>;
  };

  const getSponsorName = (id?: string) => sponsors.find(s => s.id === id)?.name || '-';
  const getStudentName = (id?: string) => {
    const s = students.find(st => st.id === id);
    return s ? `${s.lastName}, ${s.firstName}` : '-';
  };
  const getBatchCode = (id?: string) => batches.find(b => b.id === id)?.batchCode || '-';
  const getInvoiceGlRef = (invoice: Invoice) => {
    if (invoice.glEntryNumber?.trim()) return invoice.glEntryNumber.trim();
    if (invoice.journalEntryId) {
      const je = journalEntries.find(j => j.id === invoice.journalEntryId);
      const glNum = (je?.glEntryNumber || je?.reference || '').trim();
      if (glNum) return glNum;
    }
    return '-';
  };

  const escapeHtml = (value: any): string =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  // ── Export helpers ──────────────────────────────────────────────
  const getExportRows = () => {
    const statusLabel = (s: InvoiceStatus) => {
      const map: Record<InvoiceStatus, string> = { DRAFT: 'ON HOLD', OPEN: 'OPEN', CLOSED: 'CLOSED', VOIDED: 'VOIDED' };
      return map[s] || s;
    };
    return filteredInvoices.map(inv => ({
      'Invoice No.': inv.invoiceNo || '-',
      'Status': statusLabel(inv.status),
      'GL Ref.': getInvoiceGlRef(inv),
      'Sponsor/Student': inv.sponsorId ? getSponsorName(inv.sponsorId) : getStudentName(inv.studentId),
      'Date': inv.invoiceDate || '-',
      'Grand Total': inv.grandTotal ?? 0,
      'Balance': inv.balanceDue ?? 0,
    }));
  };

  const exportToExcel = () => {
    const rows = getExportRows();
    if (rows.length === 0) { alert('No invoices to export.'); return; }
    const cols = Object.keys(rows[0]);
    const esc = (v: any) => escapeHtml(v);
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/><style>td,th{padding:6px 10px;border:1px solid #ccc;font-family:Arial,sans-serif;font-size:12px}th{background:#F47721;color:#fff;font-weight:bold}td.num{text-align:right;mso-number-format:"#,##0.00"}</style></head><body><table>';
    html += '<tr>' + cols.map(c => `<th>${esc(c)}</th>`).join('') + '</tr>';
    rows.forEach(r => {
      html += '<tr>';
      cols.forEach(c => {
        const val = (r as any)[c];
        const isNum = typeof val === 'number';
        html += `<td${isNum ? ' class="num"' : ''}>${esc(isNum ? val.toFixed(2) : val)}</td>`;
      });
      html += '</tr>';
    });
    html += '</table></body></html>';
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice_Registry_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToPdf = () => {
    const rows = getExportRows();
    if (rows.length === 0) { alert('No invoices to export.'); return; }
    const cols = Object.keys(rows[0]);
    const esc = (v: any) => escapeHtml(v);
    const orgName = organization?.name || 'Invoice Registry';
    let html = `<!doctype html><html><head><meta charset="utf-8"/><title>Invoice Registry</title><style>
      @page { size: landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      body { margin:0; font-family:Arial,Helvetica,sans-serif; color:#111827; padding:20px; }
      h2 { margin:0 0 4px; font-size:18px; }
      .subtitle { color:#6b7280; font-size:12px; margin-bottom:16px; }
      table { width:100%; border-collapse:collapse; font-size:11px; }
      th { background:#F47721; color:#fff; padding:8px 10px; text-align:left; font-weight:700; }
      td { padding:7px 10px; border-bottom:1px solid #e5e7eb; }
      tr:nth-child(even) { background:#f9fafb; }
      .num { text-align:right; }
      .footer { margin-top:16px; font-size:10px; color:#9ca3af; text-align:right; }
    </style></head><body>`;
    html += `<h2>${esc(orgName)}</h2>`;
    html += `<div class="subtitle">Invoice Registry &mdash; Exported ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} &mdash; ${rows.length} record(s)</div>`;
    html += '<table><thead><tr>' + cols.map(c => `<th>${esc(c)}</th>`).join('') + '</tr></thead><tbody>';
    rows.forEach(r => {
      html += '<tr>';
      cols.forEach(c => {
        const val = (r as any)[c];
        const isNum = typeof val === 'number';
        html += `<td${isNum ? ' class="num"' : ''}>${esc(isNum ? new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) : val)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += `<div class="footer">Generated on ${new Date().toLocaleString('en-PH')}</div>`;
    html += '</body></html>';
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 400);
    }
  };

  const buildInvoiceA4Html = (invoice: Invoice): string => {
    const billedTo = invoice.sponsorId ? getSponsorName(invoice.sponsorId) : getStudentName(invoice.studentId);
    const billAddress = invoice.sponsorId
      ? (sponsors.find(s => s.id === invoice.sponsorId)?.address || '-')
      : (() => {
        const s = students.find(st => st.id === invoice.studentId);
        return s ? [s.street, s.barangay, s.district, s.city, s.province].filter(Boolean).join(', ') : '-';
      })();
    const glRef = getInvoiceGlRef(invoice);
    const orgName = organization?.name || 'Tenant Organization';
    const logoUrl = organization?.logoUrl || '';

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Invoice ${escapeHtml(invoice.invoiceNo)}</title>
    <style>
      @page { size: A4; margin: 16mm; }
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; color:#111827; }
      .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 16mm; box-sizing: border-box; }
      .muted { color:#6b7280; font-size:12px; }
      table { width:100%; border-collapse: collapse; font-size:12px; }
      .band { background:#d8ebf6; font-weight:700; }
      .totals { margin-left:auto; width:300px; font-size:12px; }
      .totals div { display:flex; justify-content:space-between; padding:4px 0; }
      .totals .grand { font-weight:700; border-top:1px solid #d1d5db; margin-top:4px; padding-top:6px; }
    </style>
  </head>
  <body>
    <div class="page">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Tenant logo" style="max-width:300px;max-height:90px;object-fit:contain;" />` : `<div style="font-size:28px;font-weight:800;">${escapeHtml(orgName)}</div>`}
          <div style="margin-top:8px;font-size:13px;">${escapeHtml(orgName)}</div>
        </div>
        <div style="text-align:left;min-width:310px;">
          <div style="font-size:44px;font-weight:700;line-height:1;margin-bottom:8px;">Invoice</div>
          <table style="font-size:14px;">
            <tr><td style="padding:2px 8px 2px 0;font-weight:700;">Reference No.:</td><td style="padding:2px 0;text-align:right;">${escapeHtml(invoice.invoiceNo)}</td></tr>
            <tr><td style="padding:2px 8px 2px 0;font-weight:700;">Date:</td><td style="padding:2px 0;text-align:right;">${escapeHtml(invoice.invoiceDate)}</td></tr>
            <tr><td style="padding:2px 8px 2px 0;font-weight:700;">Due Date:</td><td style="padding:2px 0;text-align:right;">${escapeHtml(invoice.dueDate)}</td></tr>
          </table>
        </div>
      </div>
      <div style="margin-top:6px;font-size:13px;white-space:pre-line;">${escapeHtml(organization?.taxId || '')}</div>

      <table style="margin-top:18px;">
        <thead>
          <tr class="band">
            <th style="padding:4px;text-align:left;">BILL TO:</th>
            <th style="padding:4px;text-align:left;">SHIP TO:</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:6px 4px;vertical-align:top;white-space:pre-line;">${escapeHtml(`${billedTo}\n${billAddress}`)}</td>
            <td style="padding:6px 4px;vertical-align:top;white-space:pre-line;">${escapeHtml(`${billedTo}\n${billAddress}`)}</td>
          </tr>
        </tbody>
      </table>

      <table style="margin-top:14px;">
        <thead>
          <tr class="band">
            <th style="padding:4px;text-align:left;">CUSTOMER REF. NBR.</th>
            <th style="padding:4px;text-align:left;">TERMS</th>
            <th style="padding:4px;text-align:left;">CONTACT</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:4px;">${escapeHtml(glRef)}</td>
            <td style="padding:4px;">${escapeHtml(invoice.terms || '-')}</td>
            <td style="padding:4px;">${escapeHtml(invoice.sponsorId ? (sponsors.find(s => s.id === invoice.sponsorId)?.contactPerson || '-') : (students.find(s => s.id === invoice.studentId)?.contactNumber || '-'))}</td>
          </tr>
        </tbody>
      </table>

      <table style="margin-top:8px;">
        <thead>
          <tr class="band">
            <th style="padding:6px;text-align:left;">NO.</th>
            <th style="padding:6px;text-align:left;">ITEM</th>
            <th style="padding:6px;text-align:right;">QTY.</th>
            <th style="padding:6px;text-align:right;">UOM</th>
            <th style="padding:6px;text-align:right;">UNIT PRICE</th>
            <th style="padding:6px;text-align:right;">DISC.</th>
            <th style="padding:6px;text-align:right;">EXTENDED PRICE</th>
          </tr>
        </thead>
        <tbody>${(invoice.lines || []).map((line, idx) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${idx + 1}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(line.description)}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(line.quantity || 0)}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">EA</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatCurrency(line.unitPrice || 0))}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">0%</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatCurrency(line.amount || 0))}</td>
          </tr>
        `).join('')}</tbody>
      </table>

      <div class="totals">
        <div><span class="muted">Subtotal</span><strong>${escapeHtml(formatCurrency(invoice.subtotal || 0))}</strong></div>
        <div><span class="muted">VAT</span><strong>${escapeHtml(formatCurrency(invoice.vatAmount || 0))}</strong></div>
        <div class="grand"><span>Grand Total</span><span>${escapeHtml(formatCurrency(invoice.grandTotal || 0))}</span></div>
        <div><span class="muted">Net Amount Due</span><strong>${escapeHtml(formatCurrency(invoice.netAmountDue || 0))}</strong></div>
        <div><span class="muted">Amount Paid</span><strong>${escapeHtml(formatCurrency(invoice.amountPaid || 0))}</strong></div>
        <div class="grand"><span>Balance Due</span><span>${escapeHtml(formatCurrency(invoice.balanceDue || 0))}</span></div>
      </div>

      ${invoice.notes ? `<div style="margin-top:20px;"><div class="muted">Notes</div><div>${escapeHtml(invoice.notes)}</div></div>` : ''}
    </div>
  </body>
</html>`;
  };

  const handleDownloadA4 = (invoice: Invoice) => {
    const html = buildInvoiceA4Html(invoice);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.invoiceNo || 'invoice'}-A4.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Revenue accounts for line items
  const revenueAccounts = useMemo(() =>
    accounts.filter(a => a.class === AccountClass.REVENUE && !a.isHeader && a.isActive),
    [accounts]
  );

  const formTotals = useMemo(() => {
    const sponsor = sponsors.find(s => s.id === formData.sponsorId);
    const totals = calculateTotals(formData.lines);
    return totals;
  }, [formData.lines, formData.sponsorId, sponsors]);

  // ============================================
  // GENERATE FROM ENROLLMENTS LOGIC
  // ============================================

  // Get unbilled enrollments grouped by sponsor
  const unbilledEnrollmentsBySponsor = useMemo(() => {
    const grouped = new Map<string, Enrollment[]>();

    enrollments
      .filter(e => !e.isDeleted && e.billingStatus === 'UNBILLED' && e.sponsorId)
      .forEach(e => {
        const sponsorId = e.sponsorId!;
        if (!grouped.has(sponsorId)) {
          grouped.set(sponsorId, []);
        }
        grouped.get(sponsorId)!.push(e);
      });

    return grouped;
  }, [enrollments]);

  // Get sponsors with unbilled enrollments
  const sponsorsWithUnbilledEnrollments = useMemo(() => {
    return sponsors.filter(s => unbilledEnrollmentsBySponsor.has(s.id) && !s.isDeleted);
  }, [sponsors, unbilledEnrollmentsBySponsor]);

  // Batches already billed should not appear in New Invoice batch selection.
  // Keep currently selected batch visible while editing its own invoice.
  const selectableBatches = useMemo(() => {
    const billedBatchIds = new Set(
      invoices
        .filter(inv => !!inv.batchId && inv.status !== 'VOIDED' && inv.id !== editingInvoice?.id)
        .map(inv => inv.batchId as string)
    );

    return batches.filter(batch => !batch.isDeleted && !billedBatchIds.has(batch.id));
  }, [batches, invoices, editingInvoice?.id]);

  const batchStudentsForBilling = useMemo(() => {
    if (!formData.batchId) return [] as Student[];
    const enrolled = enrollments
      .filter(e => e.batchId === formData.batchId && !e.isDeleted)
      .map(e => students.find(s => s.id === e.studentId))
      .filter((s): s is Student => !!s && !s.isDeleted);

    if (enrolled.length > 0) return enrolled;

    const batch = batches.find(b => b.id === formData.batchId);
    if (!batch?.studentIds?.length) return [] as Student[];
    return batch.studentIds
      .map(id => students.find(s => s.id === id))
      .filter((s): s is Student => !!s && !s.isDeleted);
  }, [formData.batchId, enrollments, students, batches]);

  // Get unbilled enrollments for selected sponsor
  const unbilledEnrollmentsForSponsor = useMemo(() => {
    if (!selectedSponsorId) return [];
    return unbilledEnrollmentsBySponsor.get(selectedSponsorId) || [];
  }, [selectedSponsorId, unbilledEnrollmentsBySponsor]);

  // Calculate preview totals for selected enrollments
  const generatePreviewTotals = useMemo(() => {
    if (selectedEnrollmentIds.size === 0) {
      return { subtotal: 0, vatAmount: 0, grandTotal: 0, netAmountDue: 0, lineItems: [], vatPricing: 'EXEMPT', vatRate: 0 };
    }

    const sponsor = sponsors.find(s => s.id === selectedSponsorId);
    const vatPricing: 'EXCLUSIVE' | 'INCLUSIVE' | 'EXEMPT' = sponsor?.taxType === 'VAT' ? 'INCLUSIVE' : 'EXEMPT';
    const vatRate = 0.12; // Assuming a fixed VAT rate for generated invoices

    const enrollmentsByBatch = new Map<string, Enrollment[]>();
    selectedEnrollmentIds.forEach(enrollmentId => {
      const enrollment = enrollments.find(e => e.id === enrollmentId);
      if (enrollment) {
        const batchId = enrollment.batchId;
        if (!enrollmentsByBatch.has(batchId)) {
          enrollmentsByBatch.set(batchId, []);
        }
        enrollmentsByBatch.get(batchId)!.push(enrollment);
      }
    });

    let subtotal = 0;
    const lineItems: { description: string; quantity: number; unitPrice: number; netAmount: number; vatAmount: number; grossAmount: number }[] = [];

    enrollmentsByBatch.forEach((batchEnrollments, batchId) => {
      const batch = batches.find(b => b.id === batchId);
      const qualification = batch ? qualifications.find(q => q.id === batch.qualificationId) : null;
      const courseFee = courseFees.find(cf => cf.qualificationId === batch?.qualificationId && cf.isActive && !cf.isDeleted);

      const unitPrice = courseFee?.amount || (batchEnrollments[0]?.totalFees || 0);
      const quantity = batchEnrollments.length;

      // determine a tax category for this fee if provided
      const tempLine: InvoiceLine = {
        id: '',
        orgId,
        lineNumber: 0,
        description: '',
        quantity,
        unitPrice,
        netAmount: 0,
        vatAmount: 0,
        grossAmount: 0,
        amount: 0,
        taxCategoryId: courseFee?.taxCategoryId || ''
      } as any;
      const { netAmount, vatAmount, grossAmount } = computeAmounts(tempLine);

      const description = qualification
        ? `${qualification.name} - ${batch?.batchCode || 'Batch'} (${quantity} student${quantity > 1 ? 's' : ''})`
        : `Training Fee - ${batch?.batchCode || 'Unknown Batch'} (${quantity} student${quantity > 1 ? 's' : ''})`;

      lineItems.push({
        description,
        quantity,
        unitPrice,
        netAmount,
        vatAmount,
        grossAmount
      });

      subtotal += netAmount;
    });

    const vatAmount = lineItems.reduce((sum, l) => sum + l.vatAmount, 0);
    const grandTotal = lineItems.reduce((sum, l) => sum + l.grossAmount, 0);

    return { subtotal, vatAmount, grandTotal, netAmountDue: grandTotal, lineItems, vatPricing, vatRate };
  }, [selectedEnrollmentIds, selectedSponsorId, enrollments, batches, qualifications, courseFees, sponsors]);

  // Reset generate modal state
  const resetGenerateModal = () => {
    setSelectedSponsorId('');
    setSelectedEnrollmentIds(new Set());
    setGenerateInvoiceDate(new Date().toISOString().split('T')[0]);
    setGenerateDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  };

  // Toggle enrollment selection
  const toggleEnrollmentSelection = (enrollmentId: string) => {
    setSelectedEnrollmentIds(prev => {
      const next = new Set(prev);
      if (next.has(enrollmentId)) {
        next.delete(enrollmentId);
      } else {
        next.add(enrollmentId);
      }
      return next;
    });
  };

  // Select/deselect all enrollments for sponsor
  const toggleAllEnrollments = () => {
    if (selectedEnrollmentIds.size === unbilledEnrollmentsForSponsor.length) {
      setSelectedEnrollmentIds(new Set());
    } else {
      setSelectedEnrollmentIds(new Set(unbilledEnrollmentsForSponsor.map(e => e.id)));
    }
  };

  // Handle generate invoice submission
  const handleGenerateInvoice = () => {
    if (selectedEnrollmentIds.size === 0) {
      alert('Please select at least one enrollment to bill.');
      return;
    }

    const sponsor = sponsors.find(s => s.id === selectedSponsorId);
    if (!sponsor) {
      alert('Please select a sponsor.');
      return;
    }

    const { subtotal, vatAmount, grandTotal, netAmountDue, lineItems, vatPricing, vatRate } = generatePreviewTotals;

    // Create invoice lines
    const invoiceLines: InvoiceLine[] = lineItems.map((item, idx) => ({
      id: generateUUID(),
      invoiceId: '', // Will be set below
      lineNumber: idx + 1,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      netAmount: item.netAmount,
      vatAmount: item.vatAmount,
      grossAmount: item.grossAmount,
      amount: item.grossAmount // Use grossAmount for line item amount
    }));

    // Create the invoice
    const invoiceId = generateUUID();
    const invoice: Invoice = {
      id: invoiceId,
      orgId: '',
      invoiceNo: generateInvoiceNo(),
      sponsorId: selectedSponsorId,
      invoiceDate: generateInvoiceDate,
      dueDate: generateDueDate,
      status: 'DRAFT',
      vatPricing: vatPricing,
      vatRate: vatRate,
      subtotal,
      vatAmount,
      grandTotal,
      totalEwtAmount: 0,
      netAmountDue: grandTotal,
      amountPaid: 0,
      balanceDue: grandTotal,
      terms: 'Net 30',
      notes: `Generated from ${selectedEnrollmentIds.size} enrollment(s)`,
      lines: invoiceLines.map(l => ({ ...l, invoiceId })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add the invoice
    onAddInvoice(invoice);

    // Update enrollment billing status to BILLED
    if (onUpdateEnrollment) {
      selectedEnrollmentIds.forEach(enrollmentId => {
        const enrollment = enrollments.find(e => e.id === enrollmentId);
        if (enrollment) {
          onUpdateEnrollment({
            ...enrollment,
            billingStatus: 'BILLED',
            updatedAt: new Date().toISOString()
          });
        }
      });
    }

    // Close modal and reset
    setShowGenerateModal(false);
    resetGenerateModal();
  };

  return (
    <div className="space-y-6">
      {viewMode === 'LIST' ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Invoices</h2>

            </div>
            <div className="flex items-center gap-3">
              {sponsorsWithUnbilledEnrollments.length > 0 && (
                <button
                  onClick={() => setShowGenerateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-purple-50 transition-colors text-purple-600 border-purple-300"
                >
                  <Wand2 size={18} />
                  Generate from Enrollments
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-purple-100 rounded-full">
                    {Array.from(unbilledEnrollmentsBySponsor.values()).reduce((sum: number, arr) => sum + (arr as any[]).length, 0)}
                  </span>
                </button>
              )}
              <button
                onClick={handleNew}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors"
                style={{ backgroundColor: brandColor }}
              >
                <Plus size={20} />
                New Invoice
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100">
                  <Clock size={20} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">On Hold</p>
                  <p className="text-xl font-bold text-gray-800">{stats.draft.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Send size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Open</p>
                  <p className="text-xl font-bold text-blue-600">{stats.open.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <CheckCircle size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Closed</p>
                  <p className="text-xl font-bold text-green-600">{stats.closed.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${brandColor}20` }}>
                  <DollarSign size={20} style={{ color: brandColor }} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Outstanding</p>
                  <p className="text-lg font-bold" style={{ color: brandColor }}>{formatCurrency(stats.totalOutstanding)}</p>
                </div>
              </div>
            </div>

          </div>

          {/* Filters */}
          <div className="bg-white border-y px-4 py-2">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar - Far Left */}
              <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-64">
                <Search size={14} className="text-gray-400 mr-2" />
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
                />
              </div>

              {/* Status Filter */}
              <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
                <span className="text-[13px] text-gray-500 mr-1">Status:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as InvoiceStatus | 'ALL')}
                  className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer"
                >
                  <option value="ALL">All</option>
                  <option value="DRAFT">ON HOLD</option>
                  <option value="OPEN">OPEN</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="VOIDED">VOIDED</option>
                </select>
                <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
              </div>

              {/* Sponsor/Student Filter Dropdown */}
              <div className="relative">
                <div
                  onClick={() => setShowPayerDropdown(!showPayerDropdown)}
                  className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none max-w-[220px]"
                >
                  <span className="text-[13px] text-gray-500 mr-1 truncate">Sponsor/Student:</span>
                  <span className="text-[13px] font-bold text-gray-800 pr-5 truncate">
                    {payerFilterMode === 'ALL' ? 'All' : payerFilterMode === 'CUSTOM' && payerSearchTerm ? `"${payerSearchTerm}"` : 'Custom...'}
                  </span>
                  <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
                </div>

                {showPayerDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowPayerDropdown(false)}></div>
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="p-1">
                        <button
                          onClick={() => { setSortConfig({ key: 'payer', direction: 'asc' }); setShowPayerDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-100 flex items-center gap-2 ${sortConfig.key === 'payer' && sortConfig.direction === 'asc' ? 'font-bold text-orange-600 bg-orange-50' : 'text-gray-700'}`}
                        >
                          <ChevronUp size={14} /> Sort Ascending
                        </button>
                        <button
                          onClick={() => { setSortConfig({ key: 'payer', direction: 'desc' }); setShowPayerDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-100 flex items-center gap-2 ${sortConfig.key === 'payer' && sortConfig.direction === 'desc' ? 'font-bold text-orange-600 bg-orange-50' : 'text-gray-700'}`}
                        >
                          <ChevronDown size={14} /> Sort Descending
                        </button>
                      </div>

                      <div className="border-t border-gray-100 p-1">
                        <button
                          onClick={() => { setPayerFilterMode('ALL'); setPayerSearchTerm(''); setShowPayerDropdown(false); }}
                          className="w-full text-left px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100"
                        >
                          Remove Quick Filter
                        </button>
                        <button
                          onClick={() => { setPayerFilterMode('ALL'); setPayerSearchTerm(''); setShowPayerDropdown(false); }}
                          className="w-full text-left px-3 py-1.5 text-[13px] text-gray-400 hover:bg-gray-100 cursor-not-allowed"
                          disabled
                        >
                          Clear Filter
                        </button>
                      </div>

                      <div className="border-t border-gray-100 p-1">
                        <button
                          onClick={() => setPayerFilterMode('CUSTOM')}
                          className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${payerFilterMode === 'CUSTOM' ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {payerFilterMode === 'CUSTOM' && <CheckSquare size={14} />} Equal to
                        </button>
                      </div>

                      <div className="border-t border-gray-100 p-3 space-y-2 bg-gray-50/50">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Type to search..."
                            value={payerSearchTerm}
                            onChange={(e) => {
                              setPayerSearchTerm(e.target.value);
                              if (payerFilterMode !== 'CUSTOM') setPayerFilterMode('CUSTOM');
                            }}
                            className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-blue-400"
                          />
                        </div>
                        <div className="flex justify-end items-center gap-2 pt-1">
                          <button
                            onClick={() => setShowPayerDropdown(false)}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Date Filter Dropdown */}
              <div className="relative">
                <div 
                  onClick={() => setShowDateDropdown(!showDateDropdown)}
                  className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none"
                >
                  <span className="text-[13px] text-gray-500 mr-1">Date:</span>
                  <span className="text-[13px] font-bold text-gray-800 pr-5 truncate max-w-[120px]">
                    {dateFilterMode === 'ALL' ? 'All' : dateFilterMode === 'TODAY' ? 'Today' : dateFilterMode === 'THIS_MONTH' ? 'This Month' : 'Between...'}
                  </span>
                  <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
                </div>

                {showDateDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDateDropdown(false)}></div>
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="p-1">
                        <button 
                          onClick={() => { setSortConfig({ key: 'invoiceDate', direction: 'asc' }); setShowDateDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-100 flex items-center gap-2 ${sortConfig.key === 'invoiceDate' && sortConfig.direction === 'asc' ? 'font-bold text-orange-600 bg-orange-50' : 'text-gray-700'}`}
                        >
                          <ChevronUp size={14} /> Sort Ascending
                        </button>
                        <button 
                          onClick={() => { setSortConfig({ key: 'invoiceDate', direction: 'desc' }); setShowDateDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-100 flex items-center gap-2 ${sortConfig.key === 'invoiceDate' && sortConfig.direction === 'desc' ? 'font-bold text-orange-600 bg-orange-50' : 'text-gray-700'}`}
                        >
                          <ChevronDown size={14} /> Sort Descending
                        </button>
                      </div>

                      <div className="border-t border-gray-100 p-1">
                        <button 
                          onClick={() => { setDateFilterMode('ALL'); setDateFrom(''); setDateTo(''); setShowDateDropdown(false); }}
                          className="w-full text-left px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100"
                        >
                          Remove Quick Filter
                        </button>
                        <button 
                          onClick={() => { setDateFilterMode('ALL'); setDateFrom(''); setDateTo(''); setShowDateDropdown(false); }}
                          className="w-full text-left px-3 py-1.5 text-[13px] text-gray-400 hover:bg-gray-100 cursor-not-allowed"
                          disabled
                        >
                          Clear Filter
                        </button>
                      </div>

                      <div className="border-t border-gray-100 p-1">
                        <button 
                          onClick={() => { setDateFilterMode('CUSTOM'); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${dateFilterMode === 'CUSTOM' ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {dateFilterMode === 'CUSTOM' && <CheckSquare size={14} />} Is Between
                        </button>
                        <button 
                          onClick={() => { setDateFilterMode('TODAY'); setShowDateDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${dateFilterMode === 'TODAY' ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {dateFilterMode === 'TODAY' && <CheckSquare size={14} />} Today
                        </button>
                        <button 
                          onClick={() => { setDateFilterMode('THIS_MONTH'); setShowDateDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${dateFilterMode === 'THIS_MONTH' ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {dateFilterMode === 'THIS_MONTH' && <CheckSquare size={14} />} This Month
                        </button>
                      </div>

                      <div className="border-t border-gray-100 p-3 space-y-2 bg-gray-50/50">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">From:</span>
                          <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => { setDateFrom(e.target.value); if(dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                            className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-blue-400"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">To:</span>
                          <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => { setDateTo(e.target.value); if(dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                            className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-blue-400"
                          />
                        </div>
                        <div className="flex justify-end items-center gap-2 pt-1">
                          <button 
                            onClick={() => setShowDateDropdown(false)}
                            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-[11px] font-bold text-gray-600 uppercase transition-colors"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => { setShowDateDropdown(false); }}
                            className="px-4 py-1 bg-blue-600 hover:bg-blue-700 rounded text-[11px] font-bold text-white uppercase transition-colors shadow-sm"
                          >
                            OK
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Reset Button */}
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('ALL');
                  setDateFilterMode('ALL');
                  setDateFrom('');
                  setDateTo('');
                  setFilterSponsorId('ALL');
                  setFilterStudentId('ALL');
                }}
                className="p-2 text-gray-400 hover:text-orange-500 transition-colors"
                title="Clear all filters"
              >
                <RotateCcw size={16} />
              </button>

              {/* Export Dropdown */}
              <div className="relative ml-auto">
                <button
                  onClick={() => setShowExportDropdown(!showExportDropdown)}
                  className="flex items-center gap-1.5 h-9 px-3 bg-white text-gray-700 rounded border border-gray-200 hover:bg-gray-50 transition-colors text-[13px] font-semibold shadow-sm select-none"
                  title="Export"
                >
                  <Download size={16} />
                  <span>Export</span>
                  <ChevronDown size={14} className="text-gray-400" />
                </button>

                {showExportDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)}></div>
                    <div className="absolute top-full right-0 mt-1 w-44 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="p-1">
                        <button
                          onClick={() => {
                            setShowExportDropdown(false);
                            exportToExcel();
                          }}
                          className="w-full text-left px-3 py-2 text-[13px] text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 rounded transition-colors"
                        >
                          <FileSpreadsheet size={16} className="text-emerald-600" />
                          Export as Excel
                        </button>
                        <button
                          onClick={() => {
                            setShowExportDropdown(false);
                            exportToPdf();
                          }}
                          className="w-full text-left px-3 py-2 text-[13px] text-gray-700 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 rounded transition-colors"
                        >
                          <FileText size={16} className="text-red-500" />
                          Export as PDF
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Invoice List */}
          {/* ──────────────────────────────────────────────────────────
              COLUMN CONFIG — Reorder items below to rearrange columns.
              Each entry drives BOTH the header and the data cell.
              ────────────────────────────────────────────────────────── */}
          {(() => {
            const baseColumns = [
              // ── 1. Invoice No. ────────────────────────────
              {
                key: 'invoiceNo',
                label: 'Invoice No.',
                sortKey: 'invoiceNo',
                width: 'w-40',
                align: 'text-left' as const,
                render: (inv: any) => (
                  <span className="font-medium text-gray-800">{inv.invoiceNo}</span>
                ),
              },
              // ── 2. Status ─────────────────────────────────
              {
                key: 'status',
                label: 'Status',
                sortKey: 'status',
                width: 'w-24',
                align: 'text-left' as const,
                render: (inv: any) => getStatusBadge(inv.status),
              },
              // ── 3. GL Ref. ────────────────────────────────
              {
                key: 'glReference',
                label: 'GL Ref.',
                sortKey: 'glReference',
                width: 'w-32',
                align: 'text-left' as const,
                render: (inv: any) =>
                  inv.journalEntryId ? (
                    <span className="text-xs font-medium text-gray-600">
                      {(journalEntries.find(j => j.id === inv.journalEntryId)?.glEntryNumber || journalEntries.find(j => j.id === inv.journalEntryId)?.reference || `GL${inv.journalEntryId?.slice(-8).toUpperCase()}`).trim()}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  ),
              },
              // ── 4. Sponsor / Student ──────────────────────
              {
                key: 'payer',
                label: 'Sponsor/Student',
                sortKey: 'payer',
                width: 'w-64',
                align: 'text-left' as const,
                render: (inv: any) => (
                  <div className="flex items-center gap-2">
                    {inv.sponsorId ? <Building2 size={14} className="text-gray-400" /> : <User size={14} className="text-gray-400" />}
                    <span className="text-sm">{inv.sponsorId ? getSponsorName(inv.sponsorId) : getStudentName(inv.studentId)}</span>
                  </div>
                ),
              },
              // ── 5. Date ───────────────────────────────────
              {
                key: 'invoiceDate',
                label: 'Date',
                sortKey: 'invoiceDate',
                width: 'w-32',
                align: 'text-left' as const,
                render: (inv: any) => (
                  <span className="text-sm text-gray-600">{inv.invoiceDate}</span>
                ),
              },
              // ── 6. Grand Total ────────────────────────────
              {
                key: 'totalAmount',
                label: 'Grand Total',
                sortKey: 'totalAmount',
                width: 'w-32',
                align: 'text-right' as const,
                render: (inv: any) => (
                  <span className="text-sm font-semibold">{formatCurrency(inv.grandTotal)}</span>
                ),
              },
              // ── 7. Balance ────────────────────────────────
              {
                key: 'balance',
                label: 'Balance',
                sortKey: 'balance',
                width: 'w-32',
                align: 'text-right' as const,
                render: (inv: any) =>
                  inv.balanceDue > 0 ? (
                    <span className="text-red-600 font-bold text-sm">{formatCurrency(inv.balanceDue)}</span>
                  ) : (
                    <span className="text-emerald-600 font-bold text-sm">PAID</span>
                  ),
              },
            ];

            const registryColumns = columnOrder.map(key => baseColumns.find(c => c.key === key)).filter(Boolean) as typeof baseColumns;

            const handleDragStart = (e: React.DragEvent, index: number) => {
              setDraggedColumnIdx(index);
              e.dataTransfer.effectAllowed = 'move';
              if (e.target instanceof HTMLElement) {
                e.target.style.opacity = '0.5';
              }
            };

            const handleDragEnd = (e: React.DragEvent) => {
              setDraggedColumnIdx(null);
              if (e.target instanceof HTMLElement) {
                e.target.style.opacity = '1';
              }
            };

            const handleDragOver = (e: React.DragEvent) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            };

            const handleDrop = (e: React.DragEvent, dropIndex: number) => {
              e.preventDefault();
              if (draggedColumnIdx === null || draggedColumnIdx === dropIndex) return;
              
              const newOrder = [...columnOrder];
              const [draggedKey] = newOrder.splice(draggedColumnIdx, 1);
              newOrder.splice(dropIndex, 0, draggedKey);
              
              setColumnOrder(newOrder);
              setDraggedColumnIdx(null);
            };

            return (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr className="bg-slate-50 border-b border-gray-200">
                      {registryColumns.map((col, idx) => (
                        <th
                          key={col.key}
                          draggable
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragEnd={handleDragEnd}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, idx)}
                          className={`px-4 py-3 ${col.align} cursor-move ${draggedColumnIdx === idx ? 'bg-gray-100 border-dashed border-2 border-gray-300 opacity-50' : ''} group select-none transition-colors border-x border-transparent hover:bg-gray-100 hover:border-gray-200 relative`}
                          style={columnWidths[col.key] ? { width: columnWidths[col.key], minWidth: columnWidths[col.key] } : undefined}
                          title="Drag to reorder column"
                        >
                          <div
                            className={`flex items-center ${col.align === 'text-right' ? 'justify-end' : ''} text-[11px] font-bold text-gray-500 uppercase tracking-wider ${col.sortKey ? 'cursor-pointer hover:text-gray-800' : ''}`}
                            onClick={col.sortKey ? () => handleSort(col.sortKey) : undefined}
                          >
                            {col.label} {col.sortKey && <SortIndicator columnKey={col.sortKey} />}
                          </div>
                          {/* Resize handle */}
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              const th = e.currentTarget.parentElement;
                              if (!th) return;
                              const startWidth = th.getBoundingClientRect().width;
                              resizeRef.current = { colKey: col.key, startX: e.clientX, startWidth };
                              const onMouseMove = (ev: MouseEvent) => {
                                if (!resizeRef.current) return;
                                const diff = ev.clientX - resizeRef.current.startX;
                                const newWidth = Math.max(60, resizeRef.current.startWidth + diff);
                                setColumnWidths(prev => ({ ...prev, [resizeRef.current!.colKey]: newWidth }));
                              };
                              const onMouseUp = () => {
                                resizeRef.current = null;
                                document.removeEventListener('mousemove', onMouseMove);
                                document.removeEventListener('mouseup', onMouseUp);
                                document.body.style.cursor = '';
                                document.body.style.userSelect = '';
                              };
                              document.addEventListener('mousemove', onMouseMove);
                              document.addEventListener('mouseup', onMouseUp);
                              document.body.style.cursor = 'col-resize';
                              document.body.style.userSelect = 'none';
                            }}
                            className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize hover:bg-orange-400 transition-colors z-10"
                            title="Drag to resize column"
                            draggable={false}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={registryColumns.length} className="px-4 py-12 text-center text-gray-500">
                          <FileText size={40} className="mx-auto mb-2 text-gray-300" />
                          No invoices found
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map(inv => (
                        <tr
                          key={inv.id}
                          className={`${inv.status === 'OPEN' ? 'bg-emerald-50' : 'hover:bg-gray-50'} cursor-pointer transition-colors`}
                          onClick={() => handleEdit(inv)}
                          title={inv.status === 'OPEN' ? 'Read-only: Invoice is approved and locked' : 'Click to edit'}
                        >
                          {registryColumns.map(col => (
                            <td key={col.key} className={`px-4 py-3 ${col.align}`} style={columnWidths[col.key] ? { width: columnWidths[col.key], minWidth: columnWidths[col.key] } : undefined}>
                              {col.render(inv)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </>
      ) : (
        <>
          {/* New/Edit Invoice Page */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col min-h-[80vh]">

            <div className="flex items-center justify-between p-4 border-b" style={{ backgroundColor: `${brandColor}10` }}>
              <div>

                <h3 className="text-xl font-bold text-gray-800">
                  Invoice No: {formData.invoiceNo}
                  {(formData.sponsorId || formData.studentId) && ` - ${formData.sponsorId ? getSponsorName(formData.sponsorId) : getStudentName(formData.studentId)}`}
                </h3>
              </div>
            </div>
            {/* Action Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-white">
              <button
                title="Discard Changes and Close"
                onClick={resetForm}
                className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <RotateCcw size={20} />
              </button>
              {editingInvoice?.status !== 'OPEN' && (
                <>
                  <button
                    title="Save as Draft"
                    onClick={handleSave}
                    className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Save size={20} />
                  </button>
                  <button
                    title="Approve"
                    onClick={handleApprove}
                    className="p-2 text-gray-500 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                  >
                    <CheckCircle size={20} />
                  </button>
                </>
              )}
              <button
                title="Add New Record"
                onClick={handleNew}
                className="p-2 text-gray-500 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
              >
                <Plus size={20} />
              </button>
              <button
                title="Cancel"
                onClick={resetForm}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
              <div className="h-6 w-px bg-gray-200 mx-2" />
              <button
                title="Pay"
                disabled={editingInvoice?.status !== 'OPEN'}
                onClick={() => onNavigate?.('payments', { viewMode: 'create-payment', invoice: editingInvoice })}
                className={`p-2 rounded-lg transition-colors font-black text-[10px] leading-none flex items-center justify-center ${editingInvoice?.status === 'OPEN' ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-300 cursor-not-allowed'}`}
                style={{ width: '36px', height: '36px' }}
              >
                PAY
              </button>
              <button
                title="Print"
                onClick={() => {
                  if (editingInvoice) handlePrintPreview(editingInvoice);
                  else alert('Please save the invoice before printing.');
                }}
                className="p-2 text-gray-500 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <Printer size={20} />
              </button>
              <div className="relative group">
                <button
                  title="More Actions"
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <MoreHorizontal size={20} />
                </button>
                <div className="absolute left-0 mt-1 w-48 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <div className="py-1">
                    {editingInvoice?.status === 'OPEN' && (
                      <>
                        <button onClick={() => alert('Write Off coming soon...')} className="w-full text-left px-4 py-2 text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-2">
                          <Scissors size={16} /> Write Off
                        </button>
                        <button onClick={() => alert('Reversal coming soon...')} className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2">
                          <CornerUpLeft size={16} /> Reversal
                        </button>
                        <button onClick={() => { setVoidingInvoice(editingInvoice); setShowVoidModal(true); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                          <Ban size={16} /> Void Invoice
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 p-6 space-y-8">
              {/* Batch / Sponsor / Dates row */}
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  {/* batch in center */}
                  <div>
                    <p className="text-xs text-orange-600 mt-1">Selecting a batch will auto-populate the sponsor and line items. Already billed batches are hidden.</p>
                    <select
                      value={formData.batchId}
                      onChange={e => handleBatchChange(e.target.value)}
                      disabled={isReadOnly}
                      className="mt-2 px-3 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-200 w-full disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="">-- Select Batch --</option>
                      {selectableBatches.map(b => (
                        <option key={b.id} value={b.id}>{b.batchCode} - {qualifications.find(q => q.id === b.qualificationId)?.name}</option>
                      ))}
                    </select>

                  </div>
                  {/* sponsor on left */}
                  <div>
                    <label className="text-xs font-medium text-gray-500">Sponsor</label>
                    <select
                      value={formData.sponsorId}
                      onChange={e => handleSponsorChange(e.target.value)}
                      disabled={isReadOnly}
                      className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="">-- Auto-filled if Batch is selected --</option>
                      {sponsors.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* dates on right */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Invoice Date *</label>
                      <input
                        type="date"
                        value={formData.invoiceDate}
                        onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })}
                        disabled={isReadOnly}
                        className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Due Date *</label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                        disabled={isReadOnly}
                        className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bill To */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Reference */}
                <div>
                  <label className="text-xs font-medium text-gray-500">External Reference</label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={e => setFormData({ ...formData, reference: e.target.value })}
                    disabled={isReadOnly}
                    placeholder="QRM-00000 or P.O. Number"
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Terms</label>
                  <select
                    value={formData.terms}
                    onChange={e => setFormData({ ...formData, terms: e.target.value })}
                    disabled={isReadOnly}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="COD">COD</option>
                    <option value="Net 7">Net 7</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 60">Net 60</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Transaction Description *</label>
                  <input
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    disabled={isReadOnly}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="Invoice notes or memo..."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    {getStatusBadge(formData.status)}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                    GL Reference
                    {editingInvoice?.status === 'OPEN' && (
                      <span className="text-emerald-600 text-xs font-bold">✓ POSTED</span>
                    )}
                  </label>
                  <div className="mt-1">
                    {editingInvoice?.journalEntryId || editingInvoice?.status === 'OPEN' ? (
                      (() => {
                        const je = journalEntries.find(j => j.id === editingInvoice?.journalEntryId);
                        const glNum = (editingInvoice?.glEntryNumber || je?.glEntryNumber || je?.reference || `GL${editingInvoice?.journalEntryId?.slice(-8).toUpperCase()}`).trim();
                        return (
                          <button
                            onClick={() => (editingInvoice?.journalEntryId || je?.id) && onViewJournal && onViewJournal(editingInvoice?.journalEntryId || je?.id!)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-mono font-bold rounded-lg bg-emerald-50 text-emerald-700 border-2 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 transition-all w-full justify-center shadow-sm"
                            title="Click to view GL Accounting Entries"
                            style={{ cursor: 'pointer' }}
                          >
                            <Receipt size={16} />
                            <span>{glNum}</span>
                            <span className="text-xs text-emerald-600 ml-auto">→ View GL Entries</span>
                          </button>
                        );
                      })()
                    ) : (
                      <>
                        <input
                          value={formData.glEntryNumber || ''}
                          onChange={e => setFormData({ ...formData, glEntryNumber: e.target.value })}
                          disabled={isReadOnly}
                          placeholder="Generated when invoice is approved"
                          className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-400 mt-1">GL Reference will be auto-generated and linked when you click "Approve"</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Individual Student Option */}
              {formData.batchId && !formData.sponsorId && (
                <div>
                  <label className="text-xs font-medium text-gray-500">Select Student from Batch *</label>
                  <select
                    value={formData.studentId}
                    onChange={e => setFormData({ ...formData, studentId: e.target.value, sponsorId: '' })}
                    disabled={isReadOnly}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">-- Select Student from Batch --</option>
                    {batchStudentsForBilling.map(s => (
                      <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Individual Student Option */}
              {!formData.batchId && (
                <div>
                  <label className="text-xs font-medium text-gray-500">Or Select Student (Individual Billing)</label>
                  <select
                    value={formData.studentId}
                    onChange={e => setFormData({ ...formData, studentId: e.target.value })}
                    disabled={!!formData.sponsorId || isReadOnly}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">-- Select Student --</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>
                    ))}
                  </select>
                </div>
              )}



              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-700">Line Items</h4>
                  <button
                    onClick={handleAddLine}
                    disabled={isReadOnly}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-dashed hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={16} /> Add Line
                  </button>
                </div>

                {viewMode === 'FORM' && localTaxCats.length === 0 && (
                  <div className="p-2 text-red-600 bg-red-100 text-xs">
                    âš ï¸ No tax categories loaded. Please ensure your organization has entries in the <code>tax_categories</code> table and that RLS policies permit access.
                  </div>
                )}

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left w-8">#</th>
                        <th className="px-3 py-2 text-left">Course Fee</th>
                        <th className="px-3 py-2 text-left w-50" >Description</th>
                        <th className="px-3 py-2 text-right w-25">Tax Category</th>
                        <th className="px-3 py-2 text-right w-25">Qty</th>
                        <th className="px-3 py-2 text-right w-25">Unit Price</th>
                        <th className="px-3 py-2 text-right w-25">Amount</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.lines.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                            No line items. Click "Add Line" to add items.
                          </td>
                        </tr>
                      ) : (
                        formData.lines.map((line, idx) => (
                          <tr key={line.id || idx} className="border-t">
                            <td className="px-3 py-2 text-gray-400">{line.lineNumber}</td>

                            <td className="px-3 py-2">
                              <select
                                value={line.courseFeeId || ''}
                                onChange={e => handleApplyCourseFee(idx, e.target.value)}
                                disabled={isReadOnly}
                                className="w-full px-3 py-1 rounded text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <option value="">-- Select --</option>
                                {courseFees.map(cf => (
                                  <option key={cf.id} value={cf.id}>{cf.feeCode} - {cf.feeName}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={line.description}
                                onChange={e => handleUpdateLine(idx, 'description', e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Description"
                                className="w-full px-2 py-1 rounded disabled:opacity-60 disabled:cursor-not-allowed"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={line.taxCategoryId || ''}
                                onChange={e => handleUpdateLine(idx, 'taxCategoryId', e.target.value)}
                                disabled={isReadOnly}
                                className="w-full px-2 py-1 rounded text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <option value="">-- None --</option>
                                {localTaxCats.map(tc => (
                                  <option key={tc.id} value={tc.id}>
                                    {tc.code || tc.description || tc.id} {tc.rate ? `(${tc.rate}%)` : ''}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="1"
                                value={line.quantity}
                                onChange={e => handleUpdateLine(idx, 'quantity', parseInt(e.target.value) || 1)}
                                disabled={isReadOnly}
                                className="w-full px-2 py-1 rounded text-right disabled:opacity-60 disabled:cursor-not-allowed"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={line.unitPrice}
                                onChange={e => handleUpdateLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                disabled={isReadOnly}
                                className="w-full px-2 py-1 rounded text-right disabled:opacity-60 disabled:cursor-not-allowed"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={line.amount}
                                onChange={e => handleUpdateLine(idx, 'amount', parseFloat(e.target.value) || 0)}
                                disabled={isReadOnly}
                                className="w-full px-2 py-1 rounded text-right disabled:opacity-60 disabled:cursor-not-allowed"
                              />
                            </td>
                            <td className="px-3 py-2">
                              {!isReadOnly && (
                                <button
                                  onClick={() => handleRemoveLine(idx)}
                                  className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-72 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(formTotals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">VAT:</span>
                    <span>{formatCurrency(formTotals.vatAmount)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium">Grand Total:</span>
                    <span className="font-bold text-lg">{formatCurrency(formTotals.grandTotal)}</span>
                  </div>

                  <div className="flex justify-between border-t pt-2" style={{ color: brandColor }}>
                    <span className="font-bold">Net Amount Due:</span>
                    <span className="font-bold text-lg">{formatCurrency(formTotals.netAmountDue)}</span>
                  </div>
                </div>
          </div>
          </div>
          </div>
        </>
      )}

      {/* View Invoice Modal */}

      {
        showViewModal && viewingInvoice && (
          <ModalPortal>
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden relative">
                {/* PAID Watermark Overlay */}
                {viewingInvoice.balanceDue === 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%) rotate(-20deg)',
                      pointerEvents: 'none',
                      opacity: 0.18,
                      fontSize: '5rem',
                      fontWeight: 900,
                      color: '#10B981',
                      zIndex: 30,
                      textShadow: '2px 2px 8px #fff',
                      letterSpacing: '0.2em',
                      userSelect: 'none',
                    }}
                  >
                    PAID
                  </div>
                )}
                <div className="flex items-center justify-between p-4 border-b">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Invoice {viewingInvoice.invoiceNo}</h3>
                    <p className="text-sm text-gray-500">{viewingInvoice.invoiceDate}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePrintPreview(viewingInvoice)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                      title="Open A4 Print View"
                    >
                      <Printer size={15} />
                      Print A4
                    </button>
                    {getStatusBadge(viewingInvoice.status)}
                    <button onClick={() => setShowViewModal(false)} className="p-1 hover:bg-gray-200 rounded">
                      <X size={20} />
                    </button>
                  </div>
                </div>
                <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
                  {/* Bill To */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Bill To</p>
                      <p className="font-medium text-gray-800">
                        {viewingInvoice.sponsorId ? getSponsorName(viewingInvoice.sponsorId) : getStudentName(viewingInvoice.studentId)}
                      </p>
                      {viewingInvoice.batchId && (
                        <p className="text-sm text-gray-500">Batch: {getBatchCode(viewingInvoice.batchId)}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-gray-500 mb-1">Due Date</p>
                      <p className="font-medium text-gray-800">{viewingInvoice.dueDate}</p>
                      {viewingInvoice.terms && (
                        <p className="text-sm text-gray-500">Terms: {viewingInvoice.terms}</p>
                      )}
                    </div>
                  </div>

                  {/* Lines */}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Description</th>
                          <th className="px-4 py-2 text-right">Qty</th>
                          <th className="px-4 py-2 text-right">Unit Price</th>
                          <th className="px-4 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingInvoice.lines?.map((line, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-4 py-2">{line.description}</td>
                            <td className="px-4 py-2 text-right">{line.quantity}</td>
                            <td className="px-4 py-2 text-right">{formatCurrency(line.unitPrice)}</td>
                            <td className="px-4 py-2 text-right">{formatCurrency(line.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="flex justify-end">
                    <div className="w-72 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Subtotal:</span>
                        <span className="font-medium">{formatCurrency(viewingInvoice.subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">VAT:</span>
                        <span>{formatCurrency(viewingInvoice.vatAmount)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-medium">Grand Total:</span>
                        <span className="font-bold">{formatCurrency(viewingInvoice.grandTotal)}</span>
                      </div>
                      {viewingInvoice.isSubjectToEwt && (
                        <div className="flex justify-between text-purple-600">
                          <span>Less: EWT ({((viewingInvoice.ewtRate || 0) * 100).toFixed(0)}%):</span>
                          <span>({formatCurrency(viewingInvoice.totalEwtAmount)})</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t pt-2" style={{ color: brandColor }}>
                        <span className="font-bold">Net Amount Due:</span>
                        <span className="font-bold">{formatCurrency(viewingInvoice.netAmountDue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Less: Payments:</span>
                        <span className="text-green-600">({formatCurrency(viewingInvoice.amountPaid)})</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 text-lg">
                        <span className="font-bold">Balance Due:</span>
                        <span className="font-bold" style={{ color: viewingInvoice.balanceDue > 0 ? brandColor : '#10B981' }}>
                          {formatCurrency(viewingInvoice.balanceDue)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {viewingInvoice.notes && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                      <p className="text-sm text-gray-700">{viewingInvoice.notes}</p>
                    </div>
                  )}

                  {/* Annex: Student Breakdown for Sponsor/Batch Invoices */}
                  {viewingInvoice.sponsorId && viewingInvoice.batchId && batchStudents?.length > 0 && (
                    <div className="mt-10 print:break-before-page">
                      <h4 className="text-lg font-bold text-gray-800 mb-2">Annex: Student Breakdown</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left">Student Name</th>
                              <th className="px-4 py-2 text-left">Student ID</th>
                              <th className="px-4 py-2 text-left">Course</th>
                            </tr>
                          </thead>
                          <tbody>
                            {batchStudents.map((student, idx) => (
                              <tr key={student.id || idx} className="border-t">
                                <td className="px-4 py-2">{student.name}</td>
                                <td className="px-4 py-2">{student.studentNo}</td>
                                <td className="px-4 py-2">{student.courseName}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ModalPortal>
        )}
      {showPrintModal && printingInvoice && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">A4 Invoice Preview</h3>
                  <p className="text-sm text-gray-500">{printingInvoice.invoiceNo}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadA4(printingInvoice)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <Download size={15} />
                    Export A4 HTML
                  </button>
                  <button onClick={() => setShowPrintModal(false)} className="p-1 hover:bg-gray-200 rounded">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-gray-200 p-6">
                <div className="w-[210mm] min-h-[297mm] mx-auto bg-white shadow-lg text-[12px] leading-5 p-[16mm] text-gray-800">
                  <div className="flex justify-between items-start">
                    <div>
                      {organization?.logoUrl ? (
                        <img src={organization.logoUrl} alt="Tenant logo" className="max-w-[300px] max-h-[90px] object-contain" />
                      ) : (
                        <h2 className="text-2xl font-bold tracking-wide">{organization?.name || 'Tenant Organization'}</h2>
                      )}
                      <p className="mt-2 text-[13px]">{organization?.name || 'Tenant Organization'}</p>
                      {organization?.taxId && <p className="text-gray-600">{organization.taxId}</p>}
                    </div>
                    <div className="min-w-[300px]">
                      <h2 className="text-5xl font-bold leading-none mb-2">Invoice</h2>
                      <div className="grid grid-cols-[auto_1fr] gap-x-3 text-[14px]">
                        <p className="font-semibold">Reference No.:</p><p className="text-right">{printingInvoice.invoiceNo}</p>
                        <p className="font-semibold">Date:</p><p className="text-right">{printingInvoice.invoiceDate}</p>
                        <p className="font-semibold">Due Date:</p><p className="text-right">{printingInvoice.dueDate}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 border border-[#d8ebf6]">
                    <div className="grid grid-cols-2 bg-[#d8ebf6] text-[13px] font-semibold">
                      <div className="px-2 py-1">BILL TO:</div>
                      <div className="px-2 py-1">SHIP TO:</div>
                    </div>
                    <div className="grid grid-cols-2 text-[13px]">
                      <div className="px-2 py-2 whitespace-pre-line">
                        {printingInvoice.sponsorId ? getSponsorName(printingInvoice.sponsorId) : getStudentName(printingInvoice.studentId)}{'\n'}
                        {printingInvoice.sponsorId
                          ? (sponsors.find(s => s.id === printingInvoice.sponsorId)?.address || '-')
                          : (() => {
                            const s = students.find(st => st.id === printingInvoice.studentId);
                            return s ? [s.street, s.barangay, s.district, s.city, s.province].filter(Boolean).join(', ') : '-';
                          })()}
                      </div>
                      <div className="px-2 py-2 whitespace-pre-line">
                        {printingInvoice.sponsorId ? getSponsorName(printingInvoice.sponsorId) : getStudentName(printingInvoice.studentId)}{'\n'}
                        {printingInvoice.sponsorId
                          ? (sponsors.find(s => s.id === printingInvoice.sponsorId)?.address || '-')
                          : (() => {
                            const s = students.find(st => st.id === printingInvoice.studentId);
                            return s ? [s.street, s.barangay, s.district, s.city, s.province].filter(Boolean).join(', ') : '-';
                          })()}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 border border-[#d8ebf6]">
                    <div className="grid grid-cols-3 bg-[#d8ebf6] text-[13px] font-semibold">
                      <div className="px-2 py-1">CUSTOMER REF. NBR.</div>
                      <div className="px-2 py-1">TERMS</div>
                      <div className="px-2 py-1">CONTACT</div>
                    </div>
                    <div className="grid grid-cols-3 text-[13px]">
                      <div className="px-2 py-1">{getInvoiceGlRef(printingInvoice)}</div>
                      <div className="px-2 py-1">{printingInvoice.terms || '-'}</div>
                      <div className="px-2 py-1">
                        {printingInvoice.sponsorId
                          ? (sponsors.find(s => s.id === printingInvoice.sponsorId)?.contactPerson || '-')
                          : (students.find(s => s.id === printingInvoice.studentId)?.contactNumber || '-')}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-[#d8ebf6]">
                        <tr>
                          <th className="px-3 py-2 text-left">NO.</th>
                          <th className="px-3 py-2 text-left">ITEM</th>
                          <th className="px-3 py-2 text-right">QTY.</th>
                          <th className="px-3 py-2 text-right">UOM</th>
                          <th className="px-3 py-2 text-right">UNIT PRICE</th>
                          <th className="px-3 py-2 text-right">DISC.</th>
                          <th className="px-3 py-2 text-right">EXTENDED PRICE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(printingInvoice.lines || []).map((line, idx) => (
                          <tr key={line.id || idx} className="border-t border-gray-100">
                            <td className="px-3 py-2">{idx + 1}</td>
                            <td className="px-3 py-2">{line.description}</td>
                            <td className="px-3 py-2 text-right">{line.quantity}</td>
                            <td className="px-3 py-2 text-right">EA</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(line.unitPrice || 0)}</td>
                            <td className="px-3 py-2 text-right">0%</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(line.amount || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <div className="w-[320px] space-y-1">
                      <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-medium">{formatCurrency(printingInvoice.subtotal || 0)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">VAT</span><span className="font-medium">{formatCurrency(printingInvoice.vatAmount || 0)}</span></div>
                      <div className="flex justify-between pt-2 border-t"><span className="font-semibold">Grand Total</span><span className="font-bold">{formatCurrency(printingInvoice.grandTotal || 0)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Net Amount Due</span><span className="font-semibold">{formatCurrency(printingInvoice.netAmountDue || 0)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Amount Paid</span><span className="font-medium">{formatCurrency(printingInvoice.amountPaid || 0)}</span></div>
                      <div className="flex justify-between pt-2 border-t"><span className="font-semibold">Balance Due</span><span className="font-bold">{formatCurrency(printingInvoice.balanceDue || 0)}</span></div>
                    </div>
                  </div>

                  {printingInvoice.notes && (
                    <div className="mt-8">
                      <p className="text-gray-500 uppercase text-[11px] tracking-wide">Notes</p>
                      <p className="mt-1">{printingInvoice.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>
          </ModalPortal>
        )}

      {/* Void Modal */}
      {
        showVoidModal && voidingInvoice && (
          <ModalPortal>
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="p-4 border-b flex items-center gap-3">
                  <div className="p-2 bg-rose-100 rounded-lg">
                    <AlertTriangle size={20} className="text-rose-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Void Invoice</h3>
                    <p className="text-sm text-gray-500">{voidingInvoice.invoiceNo}</p>
                  </div>
                </div>
                <div className="p-4">
                  <label className="text-sm font-medium text-gray-700">Reason for voiding *</label>
                  <textarea
                    value={voidReason}
                    onChange={e => setVoidReason(e.target.value)}
                    rows={3}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-200"
                    placeholder="Enter reason..."
                  />
                </div>
                <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
                  <button
                    onClick={() => { setShowVoidModal(false); setVoidingInvoice(null); setVoidReason(''); }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVoid}
                    disabled={!voidReason.trim()}
                    className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
                  >
                    Void Invoice
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}

      {/* Generate from Enrollments Modal */}
      {
        showGenerateModal && (
          <ModalPortal>
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-purple-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Wand2 size={20} className="text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">Generate Invoice from Enrollments</h3>
                      <p className="text-sm text-gray-500">Select unbilled enrollments to create a draft invoice</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowGenerateModal(false); resetGenerateModal(); }}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Step 1: Select Sponsor */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                      <Building2 size={16} className="text-gray-400" />
                      Step 1: Select Sponsor
                    </label>
                    <select
                      value={selectedSponsorId}
                      onChange={e => {
                        setSelectedSponsorId(e.target.value);
                        setSelectedEnrollmentIds(new Set());
                      }}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                    >
                      <option value="">-- Select a Sponsor --</option>
                      {sponsorsWithUnbilledEnrollments.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({unbilledEnrollmentsBySponsor.get(s.id)?.length || 0} unbilled)
                          {s.taxType === 'VAT' ? ' - VAT' : ''}
                          {s.ewtRate ? ` - EWT ${(s.ewtRate * 100).toFixed(0)}%` : ''}
                        </option>
                      ))}
                    </select>
                    {selectedSponsorId && (
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                        {(() => {
                          const sponsor = sponsors.find(s => s.id === selectedSponsorId);
                          return (
                            <>
                              <span className="flex items-center gap-1">
                                <span className={`w-2 h-2 rounded-full ${sponsor?.taxType === 'VAT' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                Tax Type: {sponsor?.taxType || 'NON_VAT'}
                              </span>
                              {sponsor?.ewtRate && (
                                <span className="flex items-center gap-1">
                                  <Percent size={14} className="text-purple-500" />
                                  EWT Rate: {(sponsor.ewtRate * 100).toFixed(1)}%
                                </span>
                              )}
                              {sponsor?.tin && (
                                <span className="text-gray-400">TIN: {sponsor.tin}</span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Invoice Dates */}
                  {selectedSponsorId && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                          <Calendar size={16} className="text-gray-400" />
                          Invoice Date
                        </label>
                        <input
                          type="date"
                          value={generateInvoiceDate}
                          onChange={e => setGenerateInvoiceDate(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-200"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                          <Calendar size={16} className="text-gray-400" />
                          Due Date
                        </label>
                        <input
                          type="date"
                          value={generateDueDate}
                          onChange={e => setGenerateDueDate(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-200"
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 2: Select Enrollments */}
                  {selectedSponsorId && unbilledEnrollmentsForSponsor.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Users size={16} className="text-gray-400" />
                          Step 2: Select Enrollments to Bill
                        </label>
                        <button
                          onClick={toggleAllEnrollments}
                          className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
                        >
                          {selectedEnrollmentIds.size === unbilledEnrollmentsForSponsor.length ? (
                            <>
                              <XCircle size={14} /> Deselect All
                            </>
                          ) : (
                            <>
                              <CheckCircle size={14} /> Select All ({unbilledEnrollmentsForSponsor.length})
                            </>
                          )}
                        </button>
                      </div>

                      <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left w-10">
                                <button onClick={toggleAllEnrollments}>
                                  {selectedEnrollmentIds.size === unbilledEnrollmentsForSponsor.length
                                    ? <CheckSquare size={18} className="text-purple-600" />
                                    : <Square size={18} className="text-gray-400" />
                                  }
                                </button>
                              </th>
                              <th className="px-3 py-2 text-left">Student</th>
                              <th className="px-3 py-2 text-left">Batch</th>
                              <th className="px-3 py-2 text-left">Qualification</th>
                              <th className="px-3 py-2 text-right">Fee Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {unbilledEnrollmentsForSponsor.map(enrollment => {
                              const student = students.find(s => s.id === enrollment.studentId);
                              const batch = batches.find(b => b.id === enrollment.batchId);
                              const qualification = batch ? qualifications.find(q => q.id === batch.qualificationId) : null;
                              const courseFee = courseFees.find(cf => cf.qualificationId === batch?.qualificationId && cf.isActive);
                              const feeAmount = courseFee?.amount || enrollment.totalFees || 0;
                              const isSelected = selectedEnrollmentIds.has(enrollment.id);

                              return (
                                <tr
                                  key={enrollment.id}
                                  className={`cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-purple-50' : ''}`}
                                  onClick={() => toggleEnrollmentSelection(enrollment.id)}
                                >
                                  <td className="px-3 py-2">
                                    {isSelected
                                      ? <CheckSquare size={18} className="text-purple-600" />
                                      : <Square size={18} className="text-gray-400" />
                                    }
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <GraduationCap size={14} className="text-gray-400" />
                                      <span className="font-medium">{student?.firstName} {student?.lastName}</span>
                                    </div>
                                    {student?.uli && <span className="text-xs text-gray-400 ml-5">{student.uli}</span>}
                                  </td>
                                  <td className="px-3 py-2 text-gray-600">{batch?.batchCode || '-'}</td>
                                  <td className="px-3 py-2 text-gray-600">{qualification?.name || '-'}</td>
                                  <td className="px-3 py-2 text-right font-medium">{formatCurrency(feeAmount)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Preview Totals */}
                  {selectedEnrollmentIds.size > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <Receipt size={16} />
                        Invoice Preview
                      </h4>

                      {/* Preview Line Items */}
                      <div className="mb-4 space-y-2">
                        {generatePreviewTotals.lineItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-600">
                              {item.description}
                            </span>
                            <span className="font-medium">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Totals */}
                      <div className="border-t pt-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Subtotal:</span>
                          <span className="font-medium">{formatCurrency(generatePreviewTotals.subtotal)}</span>
                        </div>
                        {generatePreviewTotals.vatAmount > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Add: VAT (12%):</span>
                            <span>{formatCurrency(generatePreviewTotals.vatAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t pt-2">
                          <span className="font-medium">Grand Total:</span>
                          <span className="font-bold text-lg">{formatCurrency(generatePreviewTotals.grandTotal)}</span>
                        </div>

                        <div className="flex justify-between border-t pt-2" style={{ color: brandColor }}>
                          <span className="font-bold">Net Amount Due:</span>
                          <span className="font-bold text-lg">{formatCurrency(generatePreviewTotals.netAmountDue)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                  <div className="text-sm text-gray-500">
                    {selectedEnrollmentIds.size > 0 && (
                      <span className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-500" />
                        {selectedEnrollmentIds.size} enrollment(s) selected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setShowGenerateModal(false); resetGenerateModal(); }}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerateInvoice}
                      disabled={selectedEnrollmentIds.size === 0}
                      className="flex items-center gap-2 px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      style={{ backgroundColor: selectedEnrollmentIds.size > 0 ? brandColor : '#9CA3AF' }}
                    >
                      <Save size={18} />
                      Generate Draft Invoice
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}
    </div>
  );
};

export default InvoicesView;

