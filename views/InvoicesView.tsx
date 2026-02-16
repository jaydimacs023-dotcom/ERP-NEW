import React, { useState, useMemo } from 'react';
import { Invoice, InvoiceLine, InvoiceStatus, Sponsor, Student, Enrollment, Batch, Qualification, CourseFee, ChartOfAccount, AccountClass } from '../types';
import { generateUUID } from '../utils/uuid';
import { 
  FileText, Plus, Search, Filter, X, Save, Trash2, Edit3, Eye, 
  Building2, User, Calendar, DollarSign, Percent, CheckCircle, 
  Clock, XCircle, AlertTriangle, Receipt, Download, Printer,
  ChevronDown, ChevronUp, MoreVertical, Send, Ban, Wand2, Users, 
  GraduationCap, CheckSquare, Square
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
  onAddInvoice: (invoice: Invoice) => void;
  onUpdateInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => Promise<boolean>;
  onPostInvoice?: (invoice: Invoice) => void;
  onVoidInvoice?: (id: string, reason: string) => void;
  onUpdateEnrollment?: (enrollment: Enrollment) => void; // For updating billing status after invoice generation
  onAddStudentLedgerEntry?: (entry: StudentLedger) => void; // For AR subsidiary ledger
}

const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices, sponsors, students, enrollments, batches, qualifications, courseFees, accounts, currency,
  onAddInvoice, onUpdateInvoice, onDeleteInvoice, onPostInvoice, onVoidInvoice, onUpdateEnrollment
}) => {
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false); // Generate from enrollments wizard
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [voidingInvoice, setVoidingInvoice] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
    status: InvoiceStatus;
    isSubjectToEwt: boolean;
    ewtRate: number;
    reference: string;
    terms: string;
    notes: string;
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
    isSubjectToEwt: false,
    ewtRate: 0.02,
    reference: '',
    terms: 'Net 30',
    notes: '',
    lines: []
  });

  const brandColor = '#F47721';

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

  // Calculate totals
  const calculateTotals = (lines: InvoiceLine[], isSubjectToEwt: boolean, ewtRate: number) => {
    const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
    const vatAmount = lines.reduce((sum, line) => sum + (line.vatAmount || 0), 0);
    const grandTotal = subtotal + vatAmount;
    const totalEwtAmount = isSubjectToEwt ? grandTotal * ewtRate : 0;
    const netAmountDue = grandTotal - totalEwtAmount;
    return { subtotal, vatAmount, grandTotal, totalEwtAmount, netAmountDue, balanceDue: netAmountDue };
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
      isSubjectToEwt: false,
      ewtRate: 0.02,
      reference: '',
      terms: 'Net 30',
      notes: '',
      lines: []
    });
    setEditingInvoice(null);
  };

  // Open modal for new invoice
  const handleNew = () => {
    resetForm();
    setShowModal(true);
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
      isSubjectToEwt: invoice.isSubjectToEwt,
      ewtRate: invoice.ewtRate || 0.02,
      reference: invoice.reference || '',
      terms: invoice.terms || '',
      notes: invoice.notes || '',
      lines: invoice.lines || []
    });
    setShowModal(true);
  };

  // View invoice details
  const handleView = (invoice: Invoice) => {
    setViewingInvoice(invoice);
    setShowViewModal(true);
  };

  // Handle sponsor change - auto-fill EWT rate
  const handleSponsorChange = (sponsorId: string) => {
    setFormData(prev => {
      const sponsor = sponsors.find(s => s.id === sponsorId);
      return {
        ...prev,
        sponsorId,
        isSubjectToEwt: sponsor?.ewtRate ? true : prev.isSubjectToEwt,
        ewtRate: sponsor?.ewtRate || prev.ewtRate
      };
    });
  };

  // Add line
  const handleAddLine = () => {
    const newLine: InvoiceLine = {
      id: generateUUID(),
      invoiceId: editingInvoice?.id || '',
      lineNumber: formData.lines.length + 1,
      description: '',
      quantity: 1,
      unitPrice: 0,
      amount: 0
    };
    setFormData(prev => ({ ...prev, lines: [...prev.lines, newLine] }));
  };

  // Update line
  const handleUpdateLine = (index: number, field: keyof InvoiceLine, value: any) => {
    setFormData(prev => {
      const lines = [...prev.lines];
      lines[index] = { ...lines[index], [field]: value };
      // Recalculate amount
      if (field === 'quantity' || field === 'unitPrice') {
        lines[index].amount = lines[index].quantity * lines[index].unitPrice;
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
      handleUpdateLine(index, 'courseFeeId', courseFeeId);
      handleUpdateLine(index, 'description', fee.feeName);
      handleUpdateLine(index, 'unitPrice', fee.amount || 0);
      handleUpdateLine(index, 'amount', (formData.lines[index].quantity || 1) * (fee.amount || 0));
      if (fee.glAccountId) {
        handleUpdateLine(index, 'glAccountId', fee.glAccountId);
      }
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

    const totals = calculateTotals(formData.lines, formData.isSubjectToEwt, formData.ewtRate);
    
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
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      grandTotal: totals.grandTotal,
      totalEwtAmount: totals.totalEwtAmount,
      netAmountDue: totals.netAmountDue,
      amountPaid: editingInvoice?.amountPaid || 0,
      balanceDue: totals.netAmountDue - (editingInvoice?.amountPaid || 0),
      ewtRate: formData.isSubjectToEwt ? formData.ewtRate : undefined,
      isSubjectToEwt: formData.isSubjectToEwt,
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

    setShowModal(false);
    resetForm();
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
        sponsors.find(s => s.id === inv.sponsorId)?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        students.find(s => s.id === inv.studentId)?.firstName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter, sponsors, students]);

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

  // Helpers
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: currency || 'PHP' }).format(amount);
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'DRAFT': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 flex items-center gap-1"><Clock size={12} />Draft</span>;
      case 'OPEN': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-600 flex items-center gap-1"><Send size={12} />Open</span>;
      case 'CLOSED': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-600 flex items-center gap-1"><CheckCircle size={12} />Closed</span>;
      case 'VOIDED': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-rose-100 text-rose-600 flex items-center gap-1"><XCircle size={12} />Voided</span>;
    }
  };

  const getSponsorName = (id?: string) => sponsors.find(s => s.id === id)?.name || '-';
  const getStudentName = (id?: string) => {
    const s = students.find(st => st.id === id);
    return s ? `${s.lastName}, ${s.firstName}` : '-';
  };
  const getBatchCode = (id?: string) => batches.find(b => b.id === id)?.batchCode || '-';

  // Revenue accounts for line items
  const revenueAccounts = useMemo(() => 
    accounts.filter(a => a.class === AccountClass.REVENUE && !a.isHeader && a.isActive),
    [accounts]
  );

  const formTotals = useMemo(() => 
    calculateTotals(formData.lines, formData.isSubjectToEwt, formData.ewtRate),
    [formData.lines, formData.isSubjectToEwt, formData.ewtRate]
  );

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

  // Get unbilled enrollments for selected sponsor
  const unbilledEnrollmentsForSponsor = useMemo(() => {
    if (!selectedSponsorId) return [];
    return unbilledEnrollmentsBySponsor.get(selectedSponsorId) || [];
  }, [selectedSponsorId, unbilledEnrollmentsBySponsor]);

  // Calculate preview totals for selected enrollments
  const generatePreviewTotals = useMemo(() => {
    if (selectedEnrollmentIds.size === 0) {
      return { subtotal: 0, vatAmount: 0, grandTotal: 0, ewtAmount: 0, netAmountDue: 0, lineItems: [] };
    }

    const sponsor = sponsors.find(s => s.id === selectedSponsorId);
    const isVat = sponsor?.taxType === 'VAT';
    const ewtRate = sponsor?.ewtRate || 0;

    // Group selected enrollments by batch (for line consolidation)
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
    let totalEwtBase = 0;
    const lineItems: { description: string; quantity: number; unitPrice: number; amount: number; vatAmount: number; isEwtSubject: boolean }[] = [];

    // For each batch, find the applicable course fee and create a line
    enrollmentsByBatch.forEach((batchEnrollments, batchId) => {
      const batch = batches.find(b => b.id === batchId);
      const qualification = batch ? qualifications.find(q => q.id === batch.qualificationId) : null;
      
      // Find primary course fee for this qualification
      const courseFee = courseFees.find(cf => cf.qualificationId === batch?.qualificationId && cf.isActive && !cf.isDeleted);
      
      // If no specific course fee, use enrollment totalFees
      const unitPrice = courseFee?.amount || (batchEnrollments[0]?.totalFees || 0);
      const quantity = batchEnrollments.length;
      const amount = unitPrice * quantity;
      const vatAmount = isVat ? amount * 0.12 : 0;
      const isEwtSubject = courseFee?.isSubjectToEwt || false;

      const description = qualification 
        ? `${qualification.name} - ${batch?.batchCode || 'Batch'} (${quantity} student${quantity > 1 ? 's' : ''})`
        : `Training Fee - ${batch?.batchCode || 'Unknown Batch'} (${quantity} student${quantity > 1 ? 's' : ''})`;

      lineItems.push({
        description,
        quantity,
        unitPrice,
        amount,
        vatAmount,
        isEwtSubject
      });

      subtotal += amount;
      if (isEwtSubject) {
        totalEwtBase += amount + vatAmount;
      }
    });

    const vatAmount = lineItems.reduce((sum, l) => sum + l.vatAmount, 0);
    const grandTotal = subtotal + vatAmount;
    const ewtAmount = totalEwtBase * ewtRate;
    const netAmountDue = grandTotal - ewtAmount;

    return { subtotal, vatAmount, grandTotal, ewtAmount, netAmountDue, lineItems };
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

    const { subtotal, vatAmount, grandTotal, ewtAmount, netAmountDue, lineItems } = generatePreviewTotals;
    const hasEwtSubjectItems = lineItems.some(l => l.isEwtSubject);
    const ewtRate = sponsor.ewtRate || 0;

    // Create invoice lines
    const invoiceLines: InvoiceLine[] = lineItems.map((item, idx) => ({
      id: generateUUID(),
      invoiceId: '', // Will be set below
      lineNumber: idx + 1,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      vatAmount: item.vatAmount
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
      subtotal,
      vatAmount,
      grandTotal,
      totalEwtAmount: ewtAmount,
      netAmountDue,
      amountPaid: 0,
      balanceDue: netAmountDue,
      ewtRate: hasEwtSubjectItems && ewtRate > 0 ? ewtRate : undefined,
      isSubjectToEwt: hasEwtSubjectItems && ewtRate > 0,
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Invoices</h2>
          <p className="text-gray-500 text-sm">Manage AR invoices with EWT tracking</p>
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
                {Array.from(unbilledEnrollmentsBySponsor.values()).reduce((sum, arr) => sum + arr.length, 0)}
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
              <p className="text-xs text-gray-500">Draft</p>
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
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Percent size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total EWT</p>
              <p className="text-lg font-bold text-purple-600">{formatCurrency(stats.totalEwt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as InvoiceStatus | 'ALL')}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="VOIDED">Voided</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invoice List */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sponsor/Student</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Grand Total</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">EWT</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Due</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                  <FileText size={40} className="mx-auto mb-2 text-gray-300" />
                  No invoices found
                </td>
              </tr>
            ) : (
              filteredInvoices.map(inv => (
                <React.Fragment key={inv.id}>
                  <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow(inv.id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {expandedRows.has(inv.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        <span className="font-medium text-gray-800">{inv.invoiceNo}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{inv.invoiceDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {inv.sponsorId ? <Building2 size={14} className="text-gray-400" /> : <User size={14} className="text-gray-400" />}
                        <span className="text-sm">{inv.sponsorId ? getSponsorName(inv.sponsorId) : getStudentName(inv.studentId)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(inv.status)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(inv.grandTotal)}</td>
                    <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(inv.totalEwtAmount)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(inv.netAmountDue)}</td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: inv.balanceDue > 0 ? brandColor : '#10B981' }}>
                      {formatCurrency(inv.balanceDue)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleView(inv)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="View">
                          <Eye size={16} />
                        </button>
                        {inv.status === 'DRAFT' && (
                          <>
                            <button onClick={() => handleEdit(inv)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded" title="Edit">
                              <Edit3 size={16} />
                            </button>
                            <button onClick={() => handlePost(inv)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded" title="Post">
                              <Send size={16} />
                            </button>
                            <button onClick={() => onDeleteInvoice(inv.id)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded" title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                        {inv.status === 'OPEN' && (
                          <button 
                            onClick={() => { setVoidingInvoice(inv); setShowVoidModal(true); }} 
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded" 
                            title="Void"
                          >
                            <Ban size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Expanded row with line details */}
                  {expandedRows.has(inv.id) && inv.lines && inv.lines.length > 0 && (
                    <tr>
                      <td colSpan={9} className="bg-gray-50 px-8 py-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="text-left py-1">#</th>
                              <th className="text-left py-1">Description</th>
                              <th className="text-right py-1">Qty</th>
                              <th className="text-right py-1">Unit Price</th>
                              <th className="text-right py-1">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inv.lines.map((line, idx) => (
                              <tr key={line.id || idx}>
                                <td className="py-1">{line.lineNumber}</td>
                                <td className="py-1">{line.description}</td>
                                <td className="py-1 text-right">{line.quantity}</td>
                                <td className="py-1 text-right">{formatCurrency(line.unitPrice)}</td>
                                <td className="py-1 text-right">{formatCurrency(line.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b" style={{ backgroundColor: `${brandColor}10` }}>
              <h3 className="text-lg font-bold text-gray-800">
                {editingInvoice ? 'Edit Invoice' : 'New Invoice'}
              </h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1 hover:bg-gray-200 rounded">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Header fields */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">Invoice No</label>
                  <input
                    type="text"
                    value={formData.invoiceNo}
                    onChange={e => setFormData({ ...formData, invoiceNo: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50"
                    readOnly
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Invoice Date *</label>
                  <input
                    type="date"
                    value={formData.invoiceDate}
                    onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Due Date *</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Reference</label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={e => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="External ref"
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
                  />
                </div>
              </div>

              {/* Bill To */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">Sponsor</label>
                  <select
                    value={formData.sponsorId}
                    onChange={e => handleSponsorChange(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
                  >
                    <option value="">-- Select Sponsor --</option>
                    {sponsors.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Or Student</label>
                  <select
                    value={formData.studentId}
                    onChange={e => setFormData({ ...formData, studentId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
                    disabled={!!formData.sponsorId}
                  >
                    <option value="">-- Select Student --</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Batch (optional)</label>
                  <select
                    value={formData.batchId}
                    onChange={e => setFormData({ ...formData, batchId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
                  >
                    <option value="">-- Select Batch --</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.batchCode} - {qualifications.find(q => q.id === b.qualificationId)?.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* EWT Configuration */}
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isSubjectToEwt}
                      onChange={e => setFormData({ ...formData, isSubjectToEwt: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Subject to EWT</span>
                  </label>
                  {formData.isSubjectToEwt && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">EWT Rate:</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={formData.ewtRate * 100}
                        onChange={e => setFormData({ ...formData, ewtRate: parseFloat(e.target.value) / 100 || 0 })}
                        className="w-20 px-2 py-1 border rounded text-sm"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-700">Line Items</h4>
                  <button
                    onClick={handleAddLine}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-dashed hover:bg-gray-50"
                  >
                    <Plus size={16} /> Add Line
                  </button>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left w-8">#</th>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-left w-32">Course Fee</th>
                        <th className="px-3 py-2 text-right w-20">Qty</th>
                        <th className="px-3 py-2 text-right w-28">Unit Price</th>
                        <th className="px-3 py-2 text-right w-28">Amount</th>
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
                              <input
                                type="text"
                                value={line.description}
                                onChange={e => handleUpdateLine(idx, 'description', e.target.value)}
                                placeholder="Description"
                                className="w-full px-2 py-1 border rounded"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={line.courseFeeId || ''}
                                onChange={e => handleApplyCourseFee(idx, e.target.value)}
                                className="w-full px-2 py-1 border rounded text-xs"
                              >
                                <option value="">-- Select --</option>
                                {courseFees.map(cf => (
                                  <option key={cf.id} value={cf.id}>{cf.feeCode} - {cf.feeName}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="1"
                                value={line.quantity}
                                onChange={e => handleUpdateLine(idx, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-full px-2 py-1 border rounded text-right"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={line.unitPrice}
                                onChange={e => handleUpdateLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 border rounded text-right"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatCurrency(line.amount)}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                onClick={() => handleRemoveLine(idx)}
                                className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              >
                                <Trash2 size={14} />
                              </button>
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
                  {formData.isSubjectToEwt && (
                    <div className="flex justify-between text-purple-600">
                      <span>Less: EWT ({(formData.ewtRate * 100).toFixed(0)}%):</span>
                      <span>({formatCurrency(formTotals.totalEwtAmount)})</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2" style={{ color: brandColor }}>
                    <span className="font-bold">Net Amount Due:</span>
                    <span className="font-bold text-lg">{formatCurrency(formTotals.netAmountDue)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-gray-500">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
                  placeholder="Invoice notes or memo..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg"
                style={{ backgroundColor: brandColor }}
              >
                <Save size={18} />
                {editingInvoice ? 'Update Invoice' : 'Save as Draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Invoice Modal */}
      {showViewModal && viewingInvoice && (
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
      )}

      {/* Void Modal */}
      {showVoidModal && voidingInvoice && (
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
      )}

      {/* Generate from Enrollments Modal */}
      {showGenerateModal && (
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
                          {item.isEwtSubject && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">EWT</span>
                          )}
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
                    {generatePreviewTotals.ewtAmount > 0 && (
                      <div className="flex justify-between text-purple-600">
                        <span>Less: EWT ({((sponsors.find(s => s.id === selectedSponsorId)?.ewtRate || 0) * 100).toFixed(0)}%):</span>
                        <span>({formatCurrency(generatePreviewTotals.ewtAmount)})</span>
                      </div>
                    )}
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
      )}
    </div>
  );
};

export default InvoicesView;
