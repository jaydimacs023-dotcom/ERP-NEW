
import React, { useState, useMemo, useEffect } from 'react';
import { Sponsor, Student, JournalEntry, JournalLine, NonStockItem, ChartOfAccount, AccountClass, TaxCategory, TaxCategoryEntry, WHTCategory, BankAccount, Batch, Qualification, ItemGroup, ReviewComment } from '../types';
import { AccountingService } from '../accountingService';
import {
  FileText, Plus, Search, Filter, Mail, CheckCircle, Clock,
  MoreVertical, CreditCard, ChevronRight, X, User, Handshake,
  Trash2, AlertCircle, Save, CheckCircle2, Link as LinkIcon,
  BookOpen, Calculator, Percent, History, Calendar, BarChart3,
  Download, Printer, Landmark, Wallet, Receipt, Package, MessageSquare, Send, RotateCcw, Edit3,
  FilePlus, UserSearch, FileBarChart
} from 'lucide-react';

interface ARViewProps {
  entries: JournalEntry[];
  lines: JournalLine[];
  students: Student[];
  sponsors: Sponsor[];
  items: NonStockItem[];
  itemGroups: ItemGroup[];
  accounts: ChartOfAccount[];
  bankAccounts: BankAccount[];
  batches: Batch[];
  qualifications: Qualification[];
  taxCategories: TaxCategory[]; // available tax categories for selection
  onPostInvoice: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void;
  onUpdateInvoice?: (entryId: string, entry: Partial<JournalEntry>, lines: JournalLine[]) => void;
  onApproveInvoice?: (entryId: string, comment?: string) => void;
  onRequestRevision?: (entryId: string, comment: string) => void;
  onAddComment?: (entryId: string, comment: string) => void;
  onAddItemGroup?: (group: Partial<ItemGroup>) => void;
  onUpdateItemGroup?: (id: string, updates: Partial<ItemGroup>) => void;
  onDeleteItemGroup?: (id: string) => void;
  currentUser?: any;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
  onNavigate?: (tab: string) => void;
  orgId: string;
}

type ARTab = 'invoices' | 'collections' | 'aging' | 'item-groups';

const ARView: React.FC<ARViewProps> = ({
  entries = [], lines = [], students = [], sponsors = [], items = [], itemGroups = [], accounts = [], bankAccounts = [], batches = [], qualifications = [], taxCategories = [], onPostInvoice, onUpdateInvoice, onApproveInvoice, onRequestRevision, onAddComment, onAddItemGroup, onUpdateItemGroup, onDeleteItemGroup, currentUser, onNotify, onNavigate,
  orgId
}) => {
  const [activeTab, setActiveTab] = useState<ARTab>('invoices');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [showItemGroupModal, setShowItemGroupModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedInvoiceForApproval, setSelectedInvoiceForApproval] = useState<JournalEntry | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<JournalEntry | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [approvalAction, setApprovalAction] = useState<'approve' | 'revision'>('approve');
  const [editingItemGroup, setEditingItemGroup] = useState<ItemGroup | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'INVOICE' | 'CREDIT' | 'OTHER'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'On Hold' | 'Open' | 'Closed' | 'Voided'>('ALL');
  const [filterDateRange, setFilterDateRange] = useState<'ALL' | '30D' | 'MTD' | 'YTD'>('ALL');
  const [agingAsOf, setAgingAsOf] = useState(new Date().toISOString().split('T')[0]);

  // Item Group Form State
  const [itemGroupCode, setItemGroupCode] = useState('');
  const [itemGroupName, setItemGroupName] = useState('');
  const [itemGroupDescription, setItemGroupDescription] = useState('');
  const [itemGroupItems, setItemGroupItems] = useState<{ itemId: string; qty: number; price: number }[]>([
    { itemId: '', qty: 1, price: 0 }
  ]);

  // Invoice Form State
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceRef, setInvoiceRef] = useState('');
  const [recipientType, setRecipientType] = useState<'STUDENT' | 'SPONSOR'>('SPONSOR');
  const [recipientId, setRecipientId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedArAccountId, setSelectedArAccountId] = useState('');
  const [invoiceLines, setInvoiceLines] = useState<{ itemId: string, qty: number, price: number, taxCategoryId?: string }[]>([
    { itemId: '', qty: 1, price: 0, taxCategoryId: '' }
  ]);
  // tax categories available for invoice modal
  const [localTaxCats, setLocalTaxCats] = useState<TaxCategoryEntry[]>(taxCategories as TaxCategoryEntry[]);

  // Get batches filtered by selected sponsor (only show batches with sponsorId matching recipientId)
  const sponsoredBatches = useMemo(() => {
    if (recipientType !== 'SPONSOR' || !recipientId) return [];
    return batches.filter(b => b.sponsorId === recipientId && !b.isDeleted);
  }, [batches, recipientId, recipientType]);

  // Handle batch selection - auto-populate sponsor when batch is selected
  const handleBatchChange = (batchId: string) => {
    setSelectedBatchId(batchId);
    if (batchId) {
      const batch = batches.find(b => b.id === batchId);
      if (batch?.sponsorId) {
        setRecipientType('SPONSOR');
        setRecipientId(batch.sponsorId);
      }
    }
  };

  // Handle sponsor change - reset batch selection if sponsor changes
  const handleRecipientChange = (newRecipientId: string) => {
    setRecipientId(newRecipientId);
    // If the new sponsor doesn't match the selected batch's sponsor, reset batch
    if (selectedBatchId) {
      const batch = batches.find(b => b.id === selectedBatchId);
      if (batch?.sponsorId !== newRecipientId) {
        setSelectedBatchId('');
      }
    }
  };

  // Collection Form State
  const [collDate, setCollDate] = useState(new Date().toISOString().split('T')[0]);
  const [collRef, setCollRef] = useState('');
  const [collPayerType, setCollPayerType] = useState<'STUDENT' | 'SPONSOR'>('SPONSOR');
  const [collPayerId, setCollPayerId] = useState('');
  const [collAmount, setCollAmount] = useState<number>(0);
  const [collBankId, setCollBankId] = useState('');
  const [selectedCollArAccountId, setSelectedCollArAccountId] = useState('');

  // Load next sequential references
  useEffect(() => {
    if (showInvoiceModal && !editingInvoice) {
      setInvoiceRef(AccountingService.getNextReference(entries, 'SI'));
    }
  }, [showInvoiceModal, entries, editingInvoice]);

  useEffect(() => {
    if (showCollectionModal) {
      setCollRef(AccountingService.getNextReference(entries, 'OR'));
    }
  }, [showCollectionModal, entries]);

  // Pre-select G/L account for Invoice when recipient changes or modal opens
  useEffect(() => {
    if (showInvoiceModal) {
      if (recipientId && recipientType === 'SPONSOR') {
        const sponsor = sponsors.find(s => s.id === recipientId);
        if (sponsor?.arAccountId) {
          setSelectedArAccountId(sponsor.arAccountId);
          return;
        }
      }

      // Default fallback: Try code 1200, then name, then ANY Asset account if still empty
      // CRITICAL: Must be an ASSET and not a header account
      const defaultAr = accounts.find(a => a.code === '1200' && a.class === AccountClass.ASSET && !a.isHeader)?.id ||
        accounts.find(a => (a.name || '').toLowerCase().includes('accounts receivable') && a.class === AccountClass.ASSET && !a.isHeader)?.id ||
        accounts.find(a => (a.name || '').toLowerCase().includes('receivable') && a.class === AccountClass.ASSET && !a.isHeader)?.id;

      if (defaultAr) {
        setSelectedArAccountId(defaultAr);
      } else {
        // Last resort
        const firstAsset = accounts.find(a => a.class === AccountClass.ASSET && !a.isHeader)?.id;
        if (firstAsset) setSelectedArAccountId(firstAsset);
      }
    }
  }, [showInvoiceModal, recipientId, recipientType, sponsors, accounts]);

  // Pre-select G/L account for Collection when payer changes
  useEffect(() => {
    if (showCollectionModal) {
      if (collPayerId && collPayerType === 'SPONSOR') {
        const sponsor = sponsors.find(s => s.id === collPayerId);
        if (sponsor?.arAccountId) {
          setSelectedCollArAccountId(sponsor.arAccountId);
          return;
        }
      }
      const defaultAr = accounts.find(a => a.code === '1200' && a.class === AccountClass.ASSET && !a.isHeader)?.id ||
        accounts.find(a => (a.name || '').toLowerCase().includes('accounts receivable') && a.class === AccountClass.ASSET && !a.isHeader)?.id;

      if (defaultAr) {
        setSelectedCollArAccountId(defaultAr);
      } else {
        const firstAsset = accounts.find(a => a.class === AccountClass.ASSET && !a.isHeader)?.id;
        if (firstAsset) setSelectedCollArAccountId(firstAsset);
      }
    }
  }, [showCollectionModal, collPayerId, collPayerType, sponsors, accounts]);

  const arInvoices = entries.filter(e => e.sourceType === 'INVOICE' && e.status !== 'REVERSED');
  const arCollections = entries.filter(e => e.sourceType === 'COLLECTION' && e.status !== 'REVERSED');

  const subsidiaryBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    const arAccounts = new Set(accounts.filter(a => a.class === AccountClass.ASSET && (a.name || '').toLowerCase().includes('receivable')).map(a => a.id));

    // Only use POSTED entries for confirmed subsidiary balances
    const postedEntryIds = new Set(entries.filter(e => e.status === 'POSTED').map(e => e.id));
    const postedLinesOnly = lines.filter(l => postedEntryIds.has(l.journalEntryId));

    postedLinesOnly.forEach(l => {
      if (l.contactId && arAccounts.has(l.accountId)) {
        balances[l.contactId] = (balances[l.contactId] || 0) + (l.debit - l.credit);
      }
    });
    return balances;
  }, [lines, entries, accounts]);

  const totalReceivables = (Object.values(subsidiaryBalances) as number[]).reduce((s, b) => s + b, 0);

  const totalOutputVat = useMemo(() => {
    // Find VAT Payable account(s)
    const vatAccountIds = new Set(accounts.filter(a =>
      (a.name || '').toLowerCase().includes('vat payable') ||
      (a.name || '').toLowerCase().includes('output vat') ||
      (a.code && a.code.startsWith('2400'))
    ).map(a => a.id));

    // VAT should also only reflect POSTED tax liabilities
    const postedEntryIds = new Set(entries.filter(e => e.status === 'POSTED').map(e => e.id));
    return lines.filter(l => postedEntryIds.has(l.journalEntryId) && vatAccountIds.has(l.accountId)).reduce((sum, l) => sum + (l.credit - l.debit), 0);
  }, [lines, entries, accounts]);

  const getDisplayStatus = (status?: string, entry?: any) => {
    // Normalize stored statuses into the UI statuses requested by the product owner
    // UI statuses: On Hold, Open, Closed, Voided
    if (!status) return 'On Hold';
    const s = status.toUpperCase();
    if (s === 'REVERSED' || s === 'VOIDED') return 'Voided';
    if (s === 'DRAFT' || s === 'REVISION_REQUESTED' || s === 'PENDING') return 'On Hold';
    if (s === 'POSTED') {
      // posted entries are assumed "Open" (outstanding) unless explicitly closed
      return 'Open';
    }
    if (s === 'CLOSED') return 'Closed';
    // fallback
    return 'Open';
  };

  const filteredInvoices = arInvoices.filter(inv => {
    const textMatch = (inv.reference || '').toLowerCase().includes(searchTerm.toLowerCase()) || (inv.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const displayStatus = getDisplayStatus(inv.status, inv);

    const statusMatch = filterStatus === 'ALL' || filterStatus === displayStatus;
    const typeMatch = filterType === 'ALL' || (inv.sourceType === filterType);

    // date range filter (simple implementations)
    let dateMatch = true;
    if (filterDateRange !== 'ALL') {
      const entryDate = new Date(inv.date);
      const now = new Date();
      if (filterDateRange === '30D') {
        const days = (now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
        dateMatch = days <= 30;
      } else if (filterDateRange === 'MTD') {
        dateMatch = entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
      } else if (filterDateRange === 'YTD') {
        dateMatch = entryDate.getFullYear() === now.getFullYear();
      }
    }

    return textMatch && statusMatch && typeMatch && dateMatch;
  });

  const handleExportInvoices = () => {
    if (!filteredInvoices || filteredInvoices.length === 0) return onNotify('info', 'No records to export.');

    const headers = ['Type', 'GL Nbr', 'Reference Nbr', 'Status', 'Date', 'Post Period', 'Customer ID', 'Customer Name', 'Description', 'Currency', 'Amount'];
    const rows: string[] = [];

    filteredInvoices.forEach(inv => {
      const arLine = lines.find(l => l.journalEntryId === inv.id && l.debit > 0);
      const batchLine = lines.find(l => l.journalEntryId === inv.id && l.batchId);
      const batch = batchLine ? batches.find(b => b.id === batchLine.batchId) : undefined;
      const contactId = arLine?.contactId || '';
      const contactType = arLine?.contactType || '';
      const customerName = contactType === 'STUDENT'
        ? (students.find(s => s.id === contactId)?.lastName ? `${students.find(s => s.id === contactId)?.lastName}, ${students.find(s => s.id === contactId)?.firstName}` : contactId)
        : (sponsors.find(s => s.id === contactId)?.name || contactId);

      const postPeriod = inv.date ? formatDateMMYYYY(inv.date) : '';
      const dateFmt = formatDateMMDDYYYY(inv.date);
      const glNbr = inv.glEntryNumber || batch?.batchCode || '';
      const status = getDisplayStatus(inv.status, inv);
      const amountVal = arLine?.debit || 0;
      const currency = inv.currency || 'PHP';

      const safe = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      rows.push([inv.sourceType || 'INVOICE', glNbr, inv.reference, status, dateFmt, postPeriod, getCustomerDisplayId(contactType, contactId), customerName, inv.description || '', currency, amountVal.toFixed(2)].map(safe).join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AR_Invoices_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredCollections = arCollections.filter(c =>
    (c.reference || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const agingReport = useMemo(() => {
    const targetAccounts = accounts.filter(a => a.class === AccountClass.ASSET && (a.name || '').toLowerCase().includes('receivable'));
    const targetIds = new Set(targetAccounts.map(a => a.id));
    // ONLY POSTED entries for aging
    const targetEntries = entries.filter(e => e.date <= agingAsOf && e.status === 'POSTED');
    const targetEntryIds = new Set(targetEntries.map(e => e.id));
    const targetLines = lines.filter(l => targetEntryIds.has(l.journalEntryId) && targetIds.has(l.accountId) && l.contactId);
    const referenceDate = new Date(agingAsOf);
    const buckets: Record<string, { name: string; total: number; current: number; thirty: number; sixty: number; ninety: number; type: string; }> = {};

    targetLines.forEach(line => {
      const entry = targetEntries.find(e => e.id === line.journalEntryId);
      if (!entry) return;
      const contactKey = line.contactId!;
      if (!buckets[contactKey]) {
        let name = "Unknown Contact";
        let type = line.contactType || 'OTHER';
        if (line.contactType === 'STUDENT') {
          const s = students.find(x => x.id === contactKey);
          name = s ? `${s.lastName}, ${s.firstName}` : `Student: ${contactKey}`;
        } else if (line.contactType === 'SPONSOR') {
          const sp = sponsors.find(s => s.id === contactKey);
          name = sp ? sp.name : `Sponsor: ${contactKey}`;
        }
        buckets[contactKey] = { name, total: 0, current: 0, thirty: 0, sixty: 0, ninety: 0, type };
      }
      const diffTime = Math.abs(referenceDate.getTime() - new Date(entry.date).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const val = line.debit - line.credit;
      buckets[contactKey].total += val;
      if (diffDays <= 30) buckets[contactKey].current += val;
      else if (diffDays <= 60) buckets[contactKey].thirty += val;
      else if (diffDays <= 90) buckets[contactKey].sixty += val;
      else buckets[contactKey].ninety += val;
    });
    return Object.values(buckets).filter(b => Math.abs(b.total) > 0.01);
  }, [agingAsOf, lines, entries, accounts, students, sponsors]);

  const handleAddInvoiceLine = () => setInvoiceLines([...invoiceLines, { itemId: '', qty: 1, price: 0, taxCategoryId: '' }]);
  const handleRemoveInvoiceLine = (i: number) => setInvoiceLines(invoiceLines.filter((_, idx) => idx !== i));
  const updateInvoiceLine = (index: number, updates: any) => {
    const newLines = [...invoiceLines];
    newLines[index] = { ...newLines[index], ...updates };
    if (updates.itemId) {
      const item = items.find(i => i.id === updates.itemId);
      if (item) {
        newLines[index].price = item.unitPrice;
        // default tax category from item if available
        if (item.taxCategoryId) newLines[index].taxCategoryId = item.taxCategoryId;
      }
    }
    setInvoiceLines(newLines);
  };

  // Apply item group to invoice lines
  const handleApplyItemGroup = (groupId: string) => {
    const group = itemGroups.find(g => g.id === groupId);
    if (!group) return;

    // Convert item group items to invoice lines
    const newLines = group.items.map(gi => ({
      itemId: gi.itemId,
      qty: gi.qty,
      price: gi.price
    }));

    setInvoiceLines(prev => {
      // Filter out empty lines and add new lines
      const nonEmpty = prev.filter(l => l.itemId);
      return [...nonEmpty, ...newLines];
    });

    onNotify('success', `Applied item group: ${group.name}`);
  };

  // Edit invoice - populate form with existing invoice data
  // keep tax categories up-to-date when modal opens
  useEffect(() => {
    if (showInvoiceModal) {
      // merge prop into local state
      if (taxCategories && taxCategories.length > 0) {
        setLocalTaxCats(taxCategories);
      }
      // also fetch directly in case prop was empty
      if ((!taxCategories || taxCategories.length === 0) && orgId) {
        import('../services/DataServiceFactory').then(({ DataServiceFactory }) => {
          DataServiceFactory.getService()
            .fetchTaxCategories(orgId)
            .then(cats => setLocalTaxCats(cats))
            .catch(err => console.error('[ARView] failed to fetch tax categories', err));
        });
      }
    }
  }, [showInvoiceModal, taxCategories, orgId]);

  const handleEditInvoice = (invoice: JournalEntry) => {
    setEditingInvoice(invoice);
    setInvoiceDate(invoice.date);
    setInvoiceRef(invoice.reference);

    // Get invoice lines to populate form
    const invoiceJournalLines = lines.filter(l => l.journalEntryId === invoice.id);

    // Find the AR line (debit line) to get recipient info
    const arLine = invoiceJournalLines.find(l => l.debit > 0);
    if (arLine) {
      setRecipientType(arLine.contactType as 'STUDENT' | 'SPONSOR');
      setRecipientId(arLine.contactId || '');
      setSelectedArAccountId(arLine.accountId);
      if (arLine.batchId) setSelectedBatchId(arLine.batchId);
    }

    // Get revenue lines (credit lines with items) to populate invoice lines
    const revenueLines = invoiceJournalLines.filter(l => l.credit > 0 && l.itemId);
    if (revenueLines.length > 0) {
      setInvoiceLines(revenueLines.map(rl => ({
        itemId: rl.itemId || '',
        qty: 1, // We don't store qty separately, so we need to calculate
        price: rl.credit,
        taxCategoryId: items.find(i => i.id === rl.itemId)?.taxCategoryId || ''
      })));
    } else {
      setInvoiceLines([{ itemId: '', qty: 1, price: 0, taxCategoryId: '' }]);
    }

    setShowInvoiceModal(true);
  };

  // Reset invoice form
  const resetInvoiceForm = () => {
    setEditingInvoice(null);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setInvoiceRef('');
    setRecipientType('SPONSOR');
    setRecipientId('');
    setSelectedBatchId('');
    setSelectedArAccountId('');
    setInvoiceLines([{ itemId: '', qty: 1, price: 0 }]);
  };

  // Item Group handlers
  const handleAddItemGroupLine = () => setItemGroupItems([...itemGroupItems, { itemId: '', qty: 1, price: 0 }]);
  const handleRemoveItemGroupLine = (i: number) => setItemGroupItems(itemGroupItems.filter((_, idx) => idx !== i));
  const updateItemGroupLine = (index: number, updates: any) => {
    const newLines = [...itemGroupItems];
    newLines[index] = { ...newLines[index], ...updates };
    if (updates.itemId) {
      const item = items.find(i => i.id === updates.itemId);
      if (item) newLines[index].price = item.unitPrice;
    }
    setItemGroupItems(newLines);
  };

  const itemGroupTotal = useMemo(() => itemGroupItems.reduce((sum, l) => sum + (l.qty * l.price), 0), [itemGroupItems]);

  const resetItemGroupForm = () => {
    setItemGroupCode('');
    setItemGroupName('');
    setItemGroupDescription('');
    setItemGroupItems([{ itemId: '', qty: 1, price: 0 }]);
    setEditingItemGroup(null);
  };

  const handleSaveItemGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemGroupCode || !itemGroupName) {
      return onNotify('error', 'Code and Name are required');
    }
    if (itemGroupItems.filter(l => l.itemId).length === 0) {
      return onNotify('error', 'At least one item is required');
    }

    const groupData = {
      code: itemGroupCode,
      name: itemGroupName,
      description: itemGroupDescription,
      items: itemGroupItems.filter(l => l.itemId).map(l => ({
        itemId: l.itemId,
        qty: l.qty,
        priceOverride: l.price
      })),
      totalAmount: itemGroupTotal,
      isActive: true
    };

    if (editingItemGroup && onUpdateItemGroup) {
      onUpdateItemGroup(editingItemGroup.id, groupData);
      onNotify('success', 'Item group updated successfully');
    } else if (onAddItemGroup) {
      onAddItemGroup({
        id: `ig-${Date.now()}`,
        ...groupData,
        createdAt: new Date().toISOString()
      });
      onNotify('success', 'Item group created successfully');
    }

    setShowItemGroupModal(false);
    resetItemGroupForm();
  };

  const handleEditItemGroup = (group: ItemGroup) => {
    setEditingItemGroup(group);
    setItemGroupCode(group.code);
    setItemGroupName(group.name);
    setItemGroupDescription(group.description || '');
    setItemGroupItems(group.items.map(i => ({ itemId: i.itemId, qty: i.qty, price: i.priceOverride || 0 })));
    setShowItemGroupModal(true);
  };

  const handleDeleteItemGroup = (id: string) => {
    if (onDeleteItemGroup && confirm('Are you sure you want to delete this item group?')) {
      onDeleteItemGroup(id);
      onNotify('success', 'Item group deleted');
    }
  };

  // helper mirroring computeAmounts logic; extracts VAT based on code or rate
  const extractVat = (amount: number, cat?: TaxCategory) => {
    if (!cat) return 0;
    const code = (cat.code || '').toUpperCase();
    let rateOverride: number | undefined;
    if (/^(VATGOODS|VATSERV)$/.test(code)) {
      rateOverride = 0.12;
    } else if (/^(NVGOODS|NVSERV|EXMPTGOODS|EXMPTSERV|ZEROGOODS|ZEROSERV)$/.test(code)) {
      rateOverride = 0;
    }
    if (rateOverride !== undefined) {
      return Math.round((amount / 1.12 * rateOverride) * 100) / 100;
    }
    if (typeof cat.rate === 'number') {
      const r = cat.rate > 1 ? cat.rate / 100 : cat.rate;
      if (cat.isInclusive) {
        return Math.round((amount / (1 + r) * r) * 100) / 100;
      }
      return Math.round(amount * r * 100) / 100;
    }
    return 0;
  };

  const totalInvoiceNet = useMemo(() => invoiceLines.reduce((sum, l) => {
    const cat = localTaxCats.find(tc => tc.id === l.taxCategoryId);
    const amt = l.qty * l.price;
    const vat = extractVat(amt, cat);
    return sum + (amt - vat);
  }, 0), [invoiceLines, localTaxCats]);

  const vatableSales = useMemo(() => invoiceLines.reduce((sum, l) => {
    const cat = localTaxCats.find(tc => tc.id === l.taxCategoryId);
    const amt = l.qty * l.price;
    const vat = extractVat(amt, cat);
    return sum + (amt - vat);
  }, 0), [invoiceLines, localTaxCats]);

  const totalVat = useMemo(() => {
    return invoiceLines.reduce((sum, l) => {
      const cat = localTaxCats.find(tc => tc.id === l.taxCategoryId);
      const amt = l.qty * l.price;
      const vatLine = extractVat(amt, cat);
      return sum + vatLine;
    }, 0);
  }, [invoiceLines, localTaxCats]);
  const grossInvoiceAmount = totalInvoiceNet + totalVat;

  const handlePostInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId) return onNotify('error', 'Validation Error: Learner or Sponsor recipient must be defined.');
    if (grossInvoiceAmount <= 0) return onNotify('error', 'Validation Error: Invoice amount must be greater than zero.');

    const entryId = editingInvoice?.id || `je-inv-${Date.now()}`;
    // Use the explicitly selected G/L account from the form
    const arAccountId = selectedArAccountId;

    const vatPayableId = accounts.find(a => a.code === '2200')?.id ||
      accounts.find(a => (a.name || '').toLowerCase().includes('vat payable'))?.id ||
      accounts.find(a => (a.name || '').toLowerCase().includes('output vat'))?.id ||
      accounts.find(a => (a.name || '').toLowerCase().includes('vat'))?.id;

    if (!arAccountId) {
      return onNotify('error', 'Accounting Error: Please select a Target G/L Receivable Account.');
    }

    if (totalVat > 0 && !vatPayableId) {
      return onNotify('error', 'Accounting Error: VAT account (2200 or "Output VAT") not found in Chart of Accounts.');
    }

    // Include batchId in all lines for tracking (if a batch is selected)
    const batchId = selectedBatchId || undefined;

    const finalizedLines: JournalLine[] = [];
    finalizedLines.push({ id: `l-ar-${Date.now()}`, journalEntryId: entryId, orgId, accountId: arAccountId, debit: grossInvoiceAmount, credit: 0, contactId: recipientId, contactType: recipientType, batchId });
    invoiceLines.forEach((il, idx) => {
      const item = items.find(i => i.id === il.itemId);
      if (item) finalizedLines.push({
        id: `l-rev-${idx}-${Date.now()}`,
        journalEntryId: entryId,
        orgId,
        accountId: item.incomeAccountId,
        debit: 0,
        credit: il.qty * il.price,
        contactId: recipientId,
        contactType: recipientType,
        itemId: il.itemId,
        taxCategoryId: il.taxCategoryId,
        batchId
      });
    });
    if (totalVat > 0) finalizedLines.push({ id: `l-vat-${Date.now()}`, journalEntryId: entryId, orgId, accountId: vatPayableId, debit: 0, credit: totalVat, contactId: recipientId, contactType: recipientType, batchId });

    // Build description including batch info if selected
    const recipientName = recipientType === 'SPONSOR' ? sponsors.find(s => s.id === recipientId)?.name : students.find(s => s.id === recipientId)?.lastName;
    const batch = selectedBatchId ? batches.find(b => b.id === selectedBatchId) : null;
    const description = batch
      ? `Sales Invoice: ${recipientName} - Batch: ${batch.batchCode || batch.name}`
      : `Sales Invoice: ${recipientName}`;

    if (editingInvoice && onUpdateInvoice) {
      // Update existing invoice - restore to DRAFT status after revision
      onUpdateInvoice({
        id: entryId,
        date: invoiceDate,
        reference: invoiceRef,
        description,
        sourceType: 'INVOICE',
        status: 'DRAFT',
        reviewComments: editingInvoice.reviewComments // Preserve review comments
      }, finalizedLines);
      onNotify('success', 'Invoice updated and resubmitted for approval');
    } else {
      // Create new invoice
      onPostInvoice({ id: entryId, date: invoiceDate, reference: invoiceRef, description, sourceType: 'INVOICE', status: 'DRAFT' }, finalizedLines);
    }

    setShowInvoiceModal(false);
    resetInvoiceForm();
  };

  const handlePostCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collPayerId) return onNotify('error', 'Validation Error: Payer entity selection is required.');
    if (collAmount <= 0) return onNotify('error', 'Validation Error: Collection amount must exceed zero.');
    if (!collBankId) return onNotify('error', 'Configuration Error: Specify the deposit destination account.');

    const entryId = `je-coll-${Date.now()}`;
    const bank = bankAccounts.find(b => b.id === collBankId);
    const arAccountId = selectedCollArAccountId;

    if (!bank) return onNotify('error', "Validation Error: Selected Bank account not found.");
    if (!arAccountId) return onNotify('error', "Validation Error: Please select a Source G/L Receivable Account.");

    const payerName = collPayerType === 'SPONSOR' ? sponsors.find(s => s.id === collPayerId)?.name : `${students.find(s => s.id === collPayerId)?.lastName}, ${students.find(s => s.id === collPayerId)?.firstName}`;

    const finalizedLines: JournalLine[] = [
      { id: `l-cash-${Date.now()}`, journalEntryId: entryId, orgId, accountId: bank.glAccountId, debit: collAmount, credit: 0, memo: `Collection ${collRef} from ${payerName}`, contactId: collPayerId, contactType: collPayerType },
      { id: `l-ar-cr-${Date.now()}`, journalEntryId: entryId, orgId, accountId: arAccountId, debit: 0, credit: collAmount, memo: `Collection ${collRef} from ${payerName}`, contactId: collPayerId, contactType: collPayerType }
    ];

    onPostInvoice({ id: entryId, date: collDate, reference: collRef, description: `Collection Payment: ${payerName}`, sourceType: 'COLLECTION', status: 'POSTED' }, finalizedLines);
    setShowCollectionModal(false);
    setCollAmount(0);
  };

  const formatCurrency = (val: number) => `\u20B1 ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDateMMDDYYYY = (d?: string | null) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d as string;
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    const yyyy = dt.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  const formatDateMMYYYY = (d?: string | null) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d as string;
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    return `${mm}-${yyyy}`;
  };

  // Returns a display-friendly Customer ID. For STUDENT contactType prefer the stored ULI (e.g. "STU-2024-00001");
  // when ULI is missing we generate a fallback in the required format: STU-<4digit-year>-<5digit-number>
  const getCustomerDisplayId = (contactType?: string, contactId?: string) => {
    if (!contactId) return '—';

    // STUDENT => prefer stored ULI; otherwise generate STU-<year>-<5digit>
    if (contactType === 'STUDENT') {
      const s = students.find(x => x.id === contactId);
      if (s?.uli) return s.uli; // existing ULI is authoritative

      const year = s?.createdAt ? new Date(s.createdAt).getFullYear() : new Date().getFullYear();
      const numericFromId = (s?.id || '').replace(/\D/g, '').slice(-5);
      const suffix = (numericFromId && numericFromId.length === 5) ? numericFromId : String(Date.now()).slice(-5);
      return `STU-${year}-${String(suffix).padStart(5, '0')}`;
    }

    // SPONSOR => generate SPO-<year>-<5digit> (use createdAt if available)
    if (contactType === 'SPONSOR') {
      const sp = sponsors.find(x => x.id === contactId);
      const year = sp?.createdAt ? new Date(sp.createdAt).getFullYear() : new Date().getFullYear();
      const numericFromId = (sp?.id || contactId || '').replace(/\D/g, '').slice(-5);
      const suffix = (numericFromId && numericFromId.length === 5) ? numericFromId : String(Date.now()).slice(-5);
      return `SPO-${year}-${String(suffix).padStart(5, '0')}`;
    }

    // Fallback: return raw id
    return contactId;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Receivables & Collections</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-6 w-full justify-start">
        <button
          onClick={() => { resetInvoiceForm(); setShowInvoiceModal(true); }}
          className="h-[200px] pt-6 px-6 pb-2 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-lg transition-all flex flex-col items-center justify-start text-center active:scale-95 w-full"
          title="Create a new sales invoice"
        >
          <div className="w-full flex justify-center">
            <div className="w-[44px] h-[44px] flex items-center justify-center rounded-full bg-[#025959]/5 text-[#025959] shadow-sm"><FilePlus size={44} /></div>
          </div>

          <div className="w-full my-3">
            <div className="mx-auto h-[2px] bg-gray-100 w-24"></div>
          </div>

          <div className="mt-1">
            <div className="text-[16px] font-semibold text-gray-800">New Invoice</div>
            <div className="text-xs text-gray-400 mt-1">Create sales invoice</div>
          </div>
        </button>

        <button
          onClick={() => { setShowCollectionModal(true); }}
          className="h-[200px] pt-6 px-6 pb-2 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-lg transition-all flex flex-col items-center justify-start text-center active:scale-95 w-full"
          title="Record a payment / official receipt"
        >
          <div className="w-full flex justify-center">
            <div className="w-[44px] h-[44px] flex items-center justify-center rounded-full bg-[#025959]/5 text-[#025959] shadow-sm"><CreditCard size={44} /></div>
          </div>

          <div className="w-full my-3">
            <div className="mx-auto h-[2px] bg-gray-100 w-24"></div>
          </div>

          <div className="mt-1">
            <div className="text-[16px] font-semibold text-gray-800">New Payment</div>
            <div className="text-xs text-gray-400 mt-1">Record cash or bank payments</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('aging')}
          className="h-[200px] pt-6 px-6 pb-2 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-lg transition-all flex flex-col items-center justify-start text-center active:scale-95 w-full"
          title="View customer ledger and aging"
        >
          <div className="w-full flex justify-center">
            <div className="w-[44px] h-[44px] flex items-center justify-center rounded-full bg-[#025959]/5 text-[#025959] shadow-sm"><UserSearch size={44} /></div>
          </div>

          <div className="w-full my-3">
            <div className="mx-auto h-[2px] bg-gray-100 w-24"></div>
          </div>

          <div className="mt-1">
            <div className="text-[16px] font-semibold text-gray-800">New Customer</div>
            <div className="text-xs text-gray-400 mt-1">Aging & balances by customer</div>
          </div>
        </button>

        <button
          onClick={() => onNavigate ? onNavigate('credits') : onNotify('info', 'Credits & Discounts — not implemented')}
          className="h-[200px] pt-6 px-6 pb-2 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-lg transition-all flex flex-col items-center justify-start text-center active:scale-95 w-full"
          title="Manage credit memos and discounts"
        >
          <div className="w-full flex justify-center">
            <div className="w-[44px] h-[44px] flex items-center justify-center rounded-full bg-[#025959]/5 text-[#025959] shadow-sm"><Percent size={44} /></div>
          </div>

          <div className="w-full my-3">
            <div className="mx-auto h-[2px] bg-gray-100 w-24"></div>
          </div>

          <div className="mt-1">
            <div className="text-[16px] font-semibold text-gray-800">Credits & Discounts</div>
            <div className="text-xs text-gray-400 mt-1">Apply credit memos or discounts</div>
          </div>
        </button>

        <button
          onClick={() => onNavigate ? onNavigate('customer-details') : onNotify('info', 'Customer Details — not implemented')}
          className="h-[200px] pt-6 px-6 pb-2 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-lg transition-all flex flex-col items-center justify-start text-center active:scale-95 w-full"
          title=" Customer Details"
        >
          <div className="w-full flex justify-center">
            <div className="w-[44px] h-[44px] flex items-center justify-center rounded-full bg-[#025959]/5 text-[#025959] shadow-sm"><User size={44} /></div>
          </div>

          <div className="w-full my-3">
            <div className="mx-auto h-[2px] bg-gray-100 w-24"></div>
          </div>

          <div className="mt-1">
            <div className="text-[16px] font-semibold text-gray-800"> Customer Details</div>
            <div className="text-xs text-gray-400 mt-1">View or edit customer profile</div>
          </div>
        </button>

        <button
          onClick={() => onNavigate ? onNavigate('reports') : setActiveTab('aging')}
          className="h-[200px] pt-6 px-6 pb-2 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-lg transition-all flex flex-col items-center justify-start text-center active:scale-95 w-full"
          title="Open AR reports and forms"
        >
          <div className="w-full flex justify-center">
            <div className="w-[44px] h-[44px] flex items-center justify-center rounded-full bg-[#025959]/5 text-[#025959] shadow-sm"><FileBarChart size={44} /></div>
          </div>

          <div className="w-full my-3">
            <div className="mx-auto h-[2px] bg-gray-100 w-24"></div>
          </div>

          <div className="mt-1">
            <div className="text-[16px] font-semibold text-gray-800">Reports & Forms</div>
            <div className="text-xs text-gray-400 mt-1">Print AR reports and export data</div>
          </div>
        </button>
      </div>

      {activeTab === 'invoices' && (
        <div className="bg-white rounded-b-md border border-gray-200 border-t-0 overflow-hidden shadow-sm -mt-2">
          <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select className="px-3 py-2 bg-white border border-gray-200 rounded text-xs" value={filterType} onChange={e => setFilterType(e.target.value as any)}>
                <option value="ALL">Type: All</option>
                <option value="INVOICE">Invoice</option>
                <option value="CREDIT">Credit Memo</option>
                <option value="OTHER">Other</option>
              </select>

              <select className="px-3 py-2 bg-white border border-gray-200 rounded text-xs" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                <option value="ALL">Status: All</option>
                <option value="On Hold">On Hold</option>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
                <option value="Voided">Voided</option>
              </select>

              <select className="px-3 py-2 bg-white border border-gray-200 rounded text-xs" value={filterDateRange} onChange={e => setFilterDateRange(e.target.value as any)}>
                <option value="ALL">Date: All</option>
                <option value="30D">Last 30 days</option>
                <option value="MTD">This month</option>
                <option value="YTD">This year</option>
              </select>

              <button onClick={() => handleExportInvoices()} className="flex items-center gap-2 px-3 py-2 bg-[#025959] text-white rounded text-xs font-bold hover:bg-[#014242] transition-all">
                <Download size={14} /> Export
              </button>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input placeholder="Find invoice by ref or customer..." className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded text-xs outline-none w-full focus:ring-1 focus:ring-orange-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-400 uppercase"> </th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-400 uppercase"> </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Type</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">GL Nbr</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Reference Nbr.</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Date</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Post Period</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Customer ID</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Customer Name</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Description</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Currency</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInvoices.length > 0 ? filteredInvoices.reverse().map(inv => {
                const arLine = lines.find(l => l.journalEntryId === inv.id && l.debit > 0);
                const batchLine = lines.find(l => l.journalEntryId === inv.id && l.batchId);
                const batch = batchLine ? batches.find(b => b.id === batchLine.batchId) : undefined;
                const contactId = arLine?.contactId || '';
                const contactType = arLine?.contactType || '';
                const customerName = contactType === 'STUDENT'
                  ? (students.find(s => s.id === contactId)?.lastName ? `${students.find(s => s.id === contactId)?.lastName}, ${students.find(s => s.id === contactId)?.firstName}` : contactId)
                  : (sponsors.find(s => s.id === contactId)?.name || contactId);

                const postPeriod = inv.date ? formatDateMMYYYY(inv.date) : '';

                const hasComments = inv.reviewComments && inv.reviewComments.length > 0;
                const latestComment = hasComments ? inv.reviewComments![inv.reviewComments!.length - 1] : null;

                return (
                  <tr key={inv.id} className={`hover:bg-gray-50 transition-colors group ${inv.status === 'REVISION_REQUESTED' ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-3 py-4 text-xs text-gray-400">{/* placeholder for attach icon */}</td>
                    <td className="px-3 py-4 text-xs text-gray-400">{/* placeholder for doc icon */}</td>

                    <td className="px-6 py-4 text-xs font-medium text-gray-700">{inv.sourceType || 'INVOICE'}</td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-600">{inv.glEntryNumber || batch?.batchCode || (batch?.name || '—')}</td>
                    <td className="px-6 py-4 text-xs font-mono font-semibold text-[#025959]">{inv.reference}</td>

                    <td className="px-6 py-4 text-xs">
                      {(() => {
                        const displayStatus = getDisplayStatus(inv.status, inv);
                        const cls = displayStatus === 'Open'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : displayStatus === 'On Hold'
                            ? 'bg-amber-50 text-amber-600 border-amber-100'
                            : displayStatus === 'Voided'
                              ? 'bg-rose-50 text-rose-600 border-rose-100'
                              : 'bg-gray-50 text-gray-500 border-gray-100';
                        return <span className={`px-2 py-0.5 text-xs font-bold uppercase rounded-full border ${cls}`}>{displayStatus}</span>;
                      })()}
                    </td>

                    <td className="px-6 py-4 text-xs text-gray-600">{formatDateMMDDYYYY(inv.date)}</td>
                    <td className="px-6 py-4 text-xs text-gray-600">{postPeriod}</td>

                    <td className="px-6 py-4 text-xs text-gray-700">{getCustomerDisplayId(contactType, contactId)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-800">{customerName}</td>

                    <td className="px-6 py-4 text-xs text-gray-500 line-clamp-1">{inv.description || '—'}</td>

                    <td className="px-4 py-4 text-xs text-gray-500">{inv.currency || 'PHP'}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">{formatCurrency(arLine?.debit || 0)}</td>


                  </tr>
                );
              }) : (
                <tr><td colSpan={13} className="py-20 text-center text-gray-400 italic">No sales invoices recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'collections' && (
        <div className="bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="text-xs font-semibold uppercase text-gray-400 tracking-wide px-2">Recent Official Receipts</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input placeholder="Find by OR# or Payer..." className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded text-xs outline-none w-72 focus:ring-1 focus:ring-orange-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Payer Entity</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">OR # / Ref</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Date</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">Collected Amount</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wide">Deposit Account</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCollections.length > 0 ? filteredCollections.reverse().map(coll => {
                const cashLine = lines.find(l => l.journalEntryId === coll.id && l.debit > 0);
                const bankAcc = bankAccounts.find(b => b.glAccountId === cashLine?.accountId);
                return (
                  <tr key={coll.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#025959]/10 text-[#025959] flex items-center justify-center"><CheckCircle size={14} /></div>
                      <div className="text-sm font-bold text-gray-800">{coll.description.split(': ')[1]}</div>
                    </td>
                    <td className="px-6 py-5 text-xs font-mono font-bold text-[#025959]">{coll.reference}</td>
                    <td className="px-6 py-5 text-xs text-gray-600">{formatDateMMDDYYYY(coll.date)}</td>
                    <td className="px-6 py-5 text-right font-mono font-bold text-[#025959]">{formatCurrency(cashLine?.debit || 0)}</td>
                    <td className="px-6 py-5 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-100 rounded text-xs font-bold text-gray-500 uppercase">
                        <Landmark size={10} /> {bankAcc?.bankName || 'Treasury'}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right"><MoreVertical size={16} className="text-gray-300 inline" /></td>
                  </tr>
                )
              }) : (
                <tr><td colSpan={5} className="py-20 text-center text-gray-400 italic">No collections recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'aging' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#025959]/10 text-[#025959] rounded"><Calendar size={20} /></div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Effective Aging Date</p>
                <input type="date" className="bg-transparent border-none outline-none font-bold text-gray-800 text-lg p-0 focus:ring-0" value={agingAsOf} onChange={e => setAgingAsOf(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Debtor Identity</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">Current (0-30)</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">31 - 60 Days</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">61 - 90 Days</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-rose-500 uppercase tracking-wide">Over 90 Days</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-900 uppercase tracking-wide">Total Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {agingReport.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-5 text-sm font-bold text-gray-800">{row.name}</td>
                    <td className="px-6 py-5 text-right font-mono text-xs text-[#025959] font-bold">{formatCurrency(row.current)}</td>
                    <td className="px-6 py-5 text-right font-mono text-xs text-[#025959]">{formatCurrency(row.thirty)}</td>
                    <td className="px-6 py-5 text-right font-mono text-xs text-[#025959]">{formatCurrency(row.sixty)}</td>
                    <td className="px-6 py-5 text-right font-mono text-xs text-rose-600 font-bold bg-rose-50/20">{formatCurrency(row.ninety)}</td>
                    <td className="px-6 py-5 text-right font-mono text-sm font-semibold text-gray-900">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
                {agingReport.length === 0 && (
                  <tr><td colSpan={6} className="py-20 text-center text-gray-400 italic">No outstanding receivables found as of this date.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Item Groups Tab */}
      {activeTab === 'item-groups' && (
        <div className="bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Package size={18} className="text-[#025959]" />
              <span className="font-bold text-gray-800">Item Groups</span>
              <span className="text-xs text-gray-500">({itemGroups.length} groups)</span>
            </div>
            <button onClick={() => { resetItemGroupForm(); setShowItemGroupModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-[#025959] text-white rounded hover:bg-[#014242] transition-all font-bold text-sm shadow-sm active:scale-95">
              <Plus size={16} /> New Item Group
            </button>
          </div>
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Code</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Name</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Description</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wide">Items</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">Total Amount</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {itemGroups.map(group => (
                <tr key={group.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono font-bold text-[#025959]">{group.code}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-800">{group.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{group.description || '—'}</td>
                  <td className="px-6 py-4 text-center text-sm">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-bold">
                      {group.items.length} items
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-sm font-semibold text-gray-900">{formatCurrency(group.totalAmount)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${group.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                      {group.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleEditItemGroup(group)} className="p-1.5 text-gray-400 hover:text-[#F47721] hover:bg-orange-50 rounded transition-colors" title="Edit">
                        <FileText size={14} />
                      </button>
                      <button onClick={() => handleDeleteItemGroup(group.id)} className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {itemGroups.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-gray-400 italic">
                    No item groups defined. Create one to bundle items for quick invoicing.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90] overflow-y-auto">
          <div className="bg-white rounded-md shadow-md w-full max-w-[95%] lg:max-w-6xl overflow-hidden animate-in zoom-in duration-200 border border-gray-200 my-8">
            <div className="p-8 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#025959] text-white rounded shadow-sm"><FileText size={24} /></div>
                <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">{editingInvoice ? 'Edit Invoice' : 'Create Sales Invoice'}</h3>
              </div>
              <button onClick={() => { setShowInvoiceModal(false); resetInvoiceForm(); }} className="text-gray-400 hover:text-gray-600"><X size={28} /></button>
            </div>

            <form onSubmit={handlePostInvoice} className="p-5 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Invoice Date</label>
                  <input type="date" required className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded text-sm font-bold" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Sequential #</label>
                  <input readOnly className="w-full px-5 py-3.5 bg-gray-100 border border-gray-200 rounded text-sm font-semibold text-[#025959] font-mono" value={invoiceRef} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Recipient Type</label>
                  <select className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded text-sm font-bold" value={recipientType} onChange={e => { setRecipientType(e.target.value as any); setRecipientId(''); setSelectedBatchId(''); }}>
                    <option value="SPONSOR">Corporate Sponsor</option>
                    <option value="STUDENT">Individual Learner</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Select Entity</label>
                  <select required className="w-full px-5 py-3.5 bg-white border-2 border-[#025959]/10 rounded text-sm font-semibold text-[#025959]" value={recipientId} onChange={e => handleRecipientChange(e.target.value)}>
                    <option value="">Choose...</option>
                    {recipientType === 'SPONSOR'
                      ? sponsors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                      : students.map(st => <option key={st.id} value={st.id}>{st.lastName}, {st.firstName}</option>)
                    }
                  </select>
                </div>
              </div>

              {/* Batch Selection - Only show for SPONSOR type */}
              {recipientType === 'SPONSOR' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-blue-50/30 rounded-md border border-blue-100/50">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide flex items-center gap-2 px-1">
                      <Calendar size={12} /> Training Batch (Optional)
                    </label>
                    <select
                      className="w-full px-5 py-3.5 bg-white border border-gray-200 rounded text-sm font-bold shadow-sm"
                      value={selectedBatchId}
                      onChange={e => handleBatchChange(e.target.value)}
                    >
                      <option value="">No specific batch</option>
                      {sponsoredBatches.map(batch => {
                        const qual = qualifications.find(q => q.id === batch.qualificationId);
                        return (
                          <option key={batch.id} value={batch.id}>
                            {batch.batchCode || batch.name} - {qual?.name || 'Unknown'} ({formatDateMMDDYYYY(batch.startDate)} to {formatDateMMDDYYYY(batch.endDate)})
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-xs text-gray-500 italic mt-1 px-1">
                      Link this invoice to a specific training batch for tracking purposes.
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {selectedBatchId && (() => {
                      const batch = batches.find(b => b.id === selectedBatchId);
                      const qual = qualifications.find(q => q.id === batch?.qualificationId);
                      return batch ? (
                        <div className="bg-white p-4 rounded border border-blue-100 w-full">
                          <p className="text-xs font-bold text-blue-600 uppercase mb-2">Selected Batch Details</p>
                          <p className="text-sm font-semibold text-gray-800">{batch.batchCode || batch.name}</p>
                          <p className="text-xs text-gray-500">{qual?.name}</p>
                          <p className="text-xs text-gray-400 mt-1">{batch.studentIds?.length || 0} enrolled students</p>
                          <p className="text-xs text-gray-400">{formatDateMMDDYYYY(batch.startDate)} → {formatDateMMDDYYYY(batch.endDate)}</p>
                        </div>
                      ) : null;
                    })()}
                    {!selectedBatchId && sponsoredBatches.length === 0 && recipientId && (
                      <p className="text-xs text-gray-400 italic">No training batches found for this sponsor.</p>
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-orange-50/30 rounded-md border border-orange-100/50">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#F47721] uppercase tracking-wide flex items-center gap-2 px-1">
                    <BookOpen size={12} /> Target G/L Receivable Account
                  </label>
                  <select
                    required
                    className="w-full px-5 py-3.5 bg-white border border-gray-200 rounded text-sm font-bold shadow-sm"
                    value={selectedArAccountId}
                    onChange={e => setSelectedArAccountId(e.target.value)}
                  >
                    <option value="">Select account...</option>
                    {accounts.filter(a => a.class === AccountClass.ASSET && !a.isHeader && (a.name || '').toLowerCase().includes('receivable')).map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 italic mt-1 px-1">
                    This defines where the debit entry will be recorded in the general ledger.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-gray-400 italic text-xs pt-4">
                  <AlertCircle size={14} className="text-[#025959]/60" />
                  <span>Selected account is automatically synced with {recipientType === 'SPONSOR' ? 'Sponsor' : 'Individual'} defaults but can be overridden here.</span>
                </div>
              </div>

              {/* Quick Apply Item Group */}
              {itemGroups.length > 0 && (
                <div className="p-4 bg-purple-50/50 rounded-md border border-purple-100/50">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Package size={16} className="text-purple-600" />
                      <span className="text-xs font-bold text-purple-700 uppercase">Quick Add Item Group</span>
                    </div>
                    <select
                      className="flex-1 px-4 py-2.5 bg-white border border-purple-200 rounded text-sm font-semibold shadow-sm"
                      onChange={e => { if (e.target.value) { handleApplyItemGroup(e.target.value); e.target.value = ''; } }}
                      value=""
                    >
                      <option value="">Select an item group to add...</option>
                      {itemGroups.filter(g => g.isActive).map(group => (
                        <option key={group.id} value={group.id}>
                          {group.code} - {group.name} ({group.items.length} items, ₱{group.totalAmount.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-purple-500 italic mt-2 px-1">
                    Select an item group to quickly add multiple pre-configured line items to this invoice.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <div className="col-span-12 sm:col-span-4">Item / Service</div>
                  <div className="col-span-12 sm:col-span-2">Tax Cat</div>
                  <div className="col-span-4 sm:col-span-2 text-center">Qty</div>
                  <div className="col-span-4 sm:col-span-2 text-right">Rate</div>
                  <div className="col-span-4 sm:col-span-2 text-right">Subtotal</div>
                  <div className="col-span-12 sm:col-span-1"></div>
                </div>

                {invoiceLines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-4 items-center p-4 bg-white rounded border border-gray-100 hover:border-[#025959]/20 transition-all">
                    <div className="col-span-12 sm:col-span-4">
                      <select required className="w-full px-4 py-2 bg-gray-50 border-none rounded text-xs font-bold" value={line.itemId} onChange={e => updateInvoiceLine(idx, { itemId: e.target.value })}>
                        <option value="">Select Item...</option>
                        {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-12 sm:col-span-2">
                      <select className="w-full px-4 py-2 bg-gray-50 border-none rounded text-xs" value={line.taxCategoryId || ''} onChange={e => updateInvoiceLine(idx, { taxCategoryId: e.target.value })}>
                        <option value="">-- None --</option>
                        {localTaxCats.map(tc => (
                          <option key={tc.id} value={tc.id}>{tc.code || tc.description} {tc.rate ? `(${tc.rate}%)` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-4 sm:col-span-2"><input type="number" min="1" className="w-full px-4 py-2 bg-gray-50 border-none rounded text-center text-xs font-semibold" value={line.qty} onChange={e => updateInvoiceLine(idx, { qty: Number(e.target.value) })} /></div>
                    <div className="col-span-4 sm:col-span-2"><input type="number" step="0.01" className="w-full px-4 py-2 bg-gray-50 border-none rounded text-right text-xs font-mono font-bold" value={line.price} onChange={e => updateInvoiceLine(idx, { price: Number(e.target.value) })} /></div>
                    <div className="col-span-4 sm:col-span-2 text-right font-mono font-semibold text-sm">{(line.qty * line.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div className="col-span-12 sm:col-span-1 flex justify-center"><button type="button" onClick={() => handleRemoveInvoiceLine(idx)} className="text-gray-300 hover:text-rose-500"><Trash2 size={16} /></button></div>
                  </div>
                ))}

                <div className="flex items-center justify-between gap-4">
                  <button type="button" onClick={handleAddInvoiceLine} className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase text-[#025959] hover:bg-[#025959]/10 rounded transition-colors border-2 border-dashed border-[#025959]/10"><Plus size={14} /> Add Invoice Line</button>
                  <div className="text-xs text-gray-400 italic">Tip: use Quick Add Item Group (above) to add multiple lines at once.</div>
                </div>
              </div>

              <div className="p-5 bg-[#014242] rounded-md flex flex-col md:flex-row justify-between items-center gap-5 shadow-md">
                <div className="flex gap-5">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Subtotal (Net)</p>
                    <p className="text-xl font-mono font-semibold text-white">{"\u20B1"} {totalInvoiceNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Output VAT (12%)</p>
                    <p className="text-xl font-mono font-semibold text-white">{"\u20B1"} {totalVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="w-px h-12 bg-white/10"></div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-white uppercase tracking-wide">Gross Invoice Value</p>
                    <p className="text-xl font-mono font-semibold text-white tracking-tighter">{"\u20B1"} {grossInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                  <button type="button" onClick={() => setShowInvoiceModal(false)} className="flex-1 px-8 py-4 text-xs font-semibold text-gray-200 uppercase tracking-wide hover:text-white transition-colors">Discard</button>
                  <button type="submit" className="flex-1 px-12 py-4 bg-[#025959] text-white rounded text-xs font-semibold uppercase tracking-wide shadow-sm shadow-gray-300/30 hover:bg-[#014242] active:scale-95 transition-all">Submit Invoice</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collection Modal */}
      {showCollectionModal && (
        <div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90] overflow-y-auto">
          <div className="bg-white rounded-md shadow-md w-full max-w-xl overflow-hidden animate-in zoom-in duration-200 border border-gray-200">
            <div className="p-8 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#025959] text-white rounded shadow-sm shadow-gray-200"><Landmark size={24} /></div>
                <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Record Receipt (OR)</h3>
              </div>
              <button onClick={() => setShowCollectionModal(false)} className="text-gray-400 hover:text-gray-600"><X size={28} /></button>
            </div>

            <form onSubmit={handlePostCollection} className="p-5 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Receipt Date</label>
                  <input type="date" required className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded text-sm font-bold" value={collDate} onChange={e => setCollDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">OR # / Reference</label>
                  <input readOnly className="w-full px-5 py-3.5 bg-gray-100 border border-gray-200 rounded text-sm font-semibold text-[#025959] font-mono" value={collRef} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Payer Category</label>
                  <select className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded text-sm font-bold" value={collPayerType} onChange={e => { setCollPayerType(e.target.value as any); setCollPayerId(''); }}>
                    <option value="SPONSOR">Corporate Sponsor</option>
                    <option value="STUDENT">Individual Learner</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Entity Identity</label>
                  <select required className="w-full px-5 py-3.5 bg-white border-2 border-[#025959]/10 rounded text-sm font-semibold text-[#025959]" value={collPayerId} onChange={e => setCollPayerId(e.target.value)}>
                    <option value="">Select Payer...</option>
                    {collPayerType === 'SPONSOR'
                      ? sponsors.map(s => <option key={s.id} value={s.id}>{s.name} (Bal: {formatCurrency(subsidiaryBalances[s.id] || 0)})</option>)
                      : students.map(st => <option key={st.id} value={st.id}>{st.lastName} (Bal: {formatCurrency(subsidiaryBalances[st.id] || 0)})</option>)
                    }
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-[#025959]/5 rounded-md border border-[#025959]/10">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#025959] uppercase tracking-wide flex items-center gap-2 px-1">
                    <BookOpen size={12} /> Source G/L Receivable Account
                  </label>
                  <select
                    required
                    className="w-full px-5 py-3.5 bg-white border border-gray-200 rounded text-sm font-bold shadow-sm"
                    value={selectedCollArAccountId}
                    onChange={e => setSelectedCollArAccountId(e.target.value)}
                  >
                    <option value="">Select account...</option>
                    {accounts.filter(a => a.class === AccountClass.ASSET && !a.isHeader && (a.name || '').toLowerCase().includes('receivable')).map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#025959] uppercase tracking-wide px-1">Deposit Target</label>
                  <select required className="w-full px-5 py-3.5 bg-white border border-gray-200 rounded text-sm font-bold shadow-sm" value={collBankId} onChange={e => setCollBankId(e.target.value)}>
                    <option value="">Select Treasury Account...</option>
                    {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bankName} ({b.currency})</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Total Collection Amount</label>
                <div className="relative">
                  <input type="number" step="0.01" required className="w-full px-6 py-5 bg-gray-50 border-none rounded text-xl font-mono font-semibold text-gray-900 outline-none focus:ring-4 focus:ring-[#025959]/10 transition-all" value={collAmount || ''} onChange={e => setCollAmount(Number(e.target.value))} placeholder="0.00" />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-lg font-semibold text-gray-300">PHP</span>
                </div>
              </div>

              <div className="bg-[#025959]/5 p-6 rounded border border-[#025959]/10 flex gap-4">
                <CheckCircle size={24} className="text-[#025959] shrink-0" />
                <p className="text-xs text-[#025959]/80 leading-relaxed font-bold">
                  Receipting will reduce the debtor subsidiary ledger balance and increase the institutional liquid assets. This entry is cryptographic and final.
                </p>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setShowCollectionModal(false)} className="flex-1 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-800 transition-colors">Discard</button>
                <button type="submit" className="flex-1 py-4 bg-[#025959] text-white rounded text-xs font-semibold uppercase tracking-wide shadow-sm shadow-gray-100 active:scale-95 transition-all">Confirm Collection</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Group Modal */}
      {showItemGroupModal && (
        <div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90] overflow-y-auto">
          <div className="bg-white rounded-md shadow-md w-full max-w-4xl overflow-hidden animate-in zoom-in duration-200 border border-gray-200 my-8">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-600 text-white rounded shadow-sm"><Package size={24} /></div>
                <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">
                  {editingItemGroup ? 'Edit Item Group' : 'Create Item Group'}
                </h3>
              </div>
              <button onClick={() => { setShowItemGroupModal(false); resetItemGroupForm(); }} className="text-gray-400 hover:text-gray-600"><X size={28} /></button>
            </div>

            <form onSubmit={handleSaveItemGroup} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Group Code *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm font-bold font-mono"
                    value={itemGroupCode}
                    onChange={e => setItemGroupCode(e.target.value.toUpperCase())}
                    placeholder="e.g., PKG-TESDA-01"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Group Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm font-bold"
                    value={itemGroupName}
                    onChange={e => setItemGroupName(e.target.value)}
                    placeholder="e.g., TESDA Certification Package"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Description</label>
                <textarea
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm resize-none"
                  rows={2}
                  value={itemGroupDescription}
                  onChange={e => setItemGroupDescription(e.target.value)}
                  placeholder="Brief description of what this item group includes..."
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-purple-600 uppercase tracking-wide px-1">Group Items</label>
                  <button type="button" onClick={handleAddItemGroupLine} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-purple-600 hover:bg-purple-50 rounded transition-colors border border-dashed border-purple-200">
                    <Plus size={14} /> Add Item
                  </button>
                </div>
                <div className="grid grid-cols-12 gap-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <div className="col-span-6">Item / Service</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-1 text-right">Subtotal</div>
                  <div className="col-span-1"></div>
                </div>
                {itemGroupItems.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-4 items-center p-3 bg-white rounded border border-gray-100 hover:border-purple-100 transition-all">
                    <div className="col-span-6">
                      <select
                        required
                        className="w-full px-3 py-2 bg-gray-50 border-none rounded text-xs font-bold"
                        value={line.itemId}
                        onChange={e => updateItemGroupLine(idx, { itemId: e.target.value })}
                      >
                        <option value="">Select Item...</option>
                        {items.map(i => <option key={i.id} value={i.id}>{i.code} - {i.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        className="w-full px-3 py-2 bg-gray-50 border-none rounded text-center text-xs font-semibold"
                        value={line.qty}
                        onChange={e => updateItemGroupLine(idx, { qty: Number(e.target.value) })}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-3 py-2 bg-gray-50 border-none rounded text-right text-xs font-mono font-bold"
                        value={line.price}
                        onChange={e => updateItemGroupLine(idx, { price: Number(e.target.value) })}
                      />
                    </div>
                    <div className="col-span-1 text-right font-mono text-xs font-semibold text-gray-700">
                      {(line.qty * line.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItemGroupLine(idx)}
                        className="text-gray-300 hover:text-rose-500"
                        disabled={itemGroupItems.length <= 1}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-purple-50 rounded-md flex justify-between items-center">
                <div>
                  <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide">Total Group Amount</p>
                  <p className="text-xl font-mono font-semibold text-purple-700">₱ {itemGroupTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setShowItemGroupModal(false); resetItemGroupForm(); }} className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-800 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="px-8 py-3 bg-purple-600 text-white rounded text-xs font-semibold uppercase tracking-wide shadow-sm hover:bg-purple-700 active:scale-95 transition-all">
                    {editingItemGroup ? 'Update Group' : 'Create Group'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approval/Review Modal */}
      {showApprovalModal && selectedInvoiceForApproval && (
        <div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
          <div className="bg-white rounded-md shadow-lg w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-gray-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4">
                <div className={`p-3 ${approvalAction === 'approve' ? 'bg-emerald-500' : 'bg-amber-500'} text-white rounded shadow-sm`}>
                  {approvalAction === 'approve' ? <CheckCircle2 size={24} /> : <RotateCcw size={24} />}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Review Invoice</h3>
                  <p className="text-xs text-gray-500">{selectedInvoiceForApproval.reference}</p>
                </div>
              </div>
              <button onClick={() => { setShowApprovalModal(false); setSelectedInvoiceForApproval(null); }} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            <div className="p-6 space-y-6">
              {/* Invoice Summary */}
              <div className="p-4 bg-gray-50 rounded-md space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Invoice:</span>
                  <span className="font-bold text-gray-800">{selectedInvoiceForApproval.reference}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Description:</span>
                  <span className="font-semibold text-gray-700">{selectedInvoiceForApproval.description.split(': ')[1] || selectedInvoiceForApproval.description}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Date:</span>
                  <span className="font-semibold text-gray-700">{formatDateMMDDYYYY(selectedInvoiceForApproval.date)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Amount:</span>
                  <span className="font-bold text-[#025959]">
                    {formatCurrency(lines.find(l => l.journalEntryId === selectedInvoiceForApproval.id && l.debit > 0)?.debit || 0)}
                  </span>
                </div>
              </div>

              {/* Action Selection */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setApprovalAction('approve')}
                  className={`flex-1 p-4 rounded-md border-2 transition-all ${approvalAction === 'approve'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-emerald-200'
                    }`}
                >
                  <CheckCircle2 size={24} className={`mx-auto mb-2 ${approvalAction === 'approve' ? 'text-emerald-500' : 'text-gray-400'}`} />
                  <p className={`text-sm font-bold ${approvalAction === 'approve' ? 'text-emerald-700' : 'text-gray-500'}`}>Approve & Post</p>
                  <p className="text-xs text-gray-400 mt-1">Post to General Ledger</p>
                </button>
                <button
                  type="button"
                  onClick={() => setApprovalAction('revision')}
                  className={`flex-1 p-4 rounded-md border-2 transition-all ${approvalAction === 'revision'
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-200 hover:border-amber-200'
                    }`}
                >
                  <RotateCcw size={24} className={`mx-auto mb-2 ${approvalAction === 'revision' ? 'text-amber-500' : 'text-gray-400'}`} />
                  <p className={`text-sm font-bold ${approvalAction === 'revision' ? 'text-amber-700' : 'text-gray-500'}`}>Request Revision</p>
                  <p className="text-xs text-gray-400 mt-1">Send back for changes</p>
                </button>
              </div>

              {/* Comment Field */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                  <MessageSquare size={12} />
                  {approvalAction === 'approve' ? 'Comment (Optional)' : 'Revision Instructions (Required)'}
                </label>
                <textarea
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm resize-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition-all"
                  rows={3}
                  placeholder={approvalAction === 'approve'
                    ? 'Add optional approval notes...'
                    : 'Describe what changes are needed...'}
                  value={approvalComment}
                  onChange={e => setApprovalComment(e.target.value)}
                  required={approvalAction === 'revision'}
                />
              </div>

              {/* Previous Comments */}
              {selectedInvoiceForApproval.reviewComments && selectedInvoiceForApproval.reviewComments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Previous Comments</p>
                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {selectedInvoiceForApproval.reviewComments.map(comment => (
                      <div key={comment.id} className="p-3 bg-gray-50 rounded text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-gray-700">{comment.userName}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${comment.action === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' :
                            comment.action === 'REQUEST_REVISION' ? 'bg-amber-100 text-amber-600' :
                              'bg-gray-100 text-gray-500'
                            }`}>{comment.action.replace('_', ' ')}</span>
                        </div>
                        <p className="text-gray-600">{comment.comment}</p>
                        <p className="text-gray-400 mt-1">{new Date(comment.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button
                type="button"
                onClick={() => { setShowApprovalModal(false); setSelectedInvoiceForApproval(null); }}
                className="flex-1 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (approvalAction === 'revision') {
                    if (!approvalComment.trim()) {
                      onNotify('error', 'Please provide revision instructions');
                      return;
                    }
                    onRequestRevision?.(selectedInvoiceForApproval.id, approvalComment);
                  } else {
                    onApproveInvoice?.(selectedInvoiceForApproval.id, approvalComment || undefined);
                  }
                  setShowApprovalModal(false);
                  setSelectedInvoiceForApproval(null);
                  setApprovalComment('');
                }}
                className={`flex-1 py-3 rounded text-xs font-semibold uppercase tracking-wide shadow-sm transition-all ${approvalAction === 'approve'
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
              >
                {approvalAction === 'approve' ? 'Approve & Post' : 'Request Revision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments History Modal */}
      {showCommentsModal && selectedInvoiceForApproval && (
        <div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
          <div className="bg-white rounded-md shadow-lg w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-gray-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#025959] text-white rounded shadow-sm"><MessageSquare size={24} /></div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Review History</h3>
                  <p className="text-xs text-gray-500">{selectedInvoiceForApproval.reference}</p>
                </div>
              </div>
              <button onClick={() => { setShowCommentsModal(false); setSelectedInvoiceForApproval(null); }} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              {selectedInvoiceForApproval.reviewComments && selectedInvoiceForApproval.reviewComments.length > 0 ? (
                selectedInvoiceForApproval.reviewComments.map(comment => (
                  <div key={comment.id} className={`p-4 rounded-md border ${comment.action === 'APPROVED' ? 'bg-emerald-50 border-emerald-100' :
                    comment.action === 'REQUEST_REVISION' ? 'bg-amber-50 border-amber-100' :
                      'bg-gray-50 border-gray-100'
                    }`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm">
                          {comment.userName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-gray-800">{comment.userName}</p>
                          <p className="text-xs text-gray-400">{new Date(comment.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${comment.action === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' :
                        comment.action === 'REQUEST_REVISION' ? 'bg-amber-100 text-amber-600' :
                          comment.action === 'REJECTED' ? 'bg-rose-100 text-rose-600' :
                            'bg-gray-100 text-gray-500'
                        }`}>
                        {comment.action.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 pl-10">{comment.comment}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400 italic">No comments yet</div>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50">
              <button
                type="button"
                onClick={() => { setShowCommentsModal(false); setSelectedInvoiceForApproval(null); }}
                className="w-full py-3 bg-gray-200 hover:bg-gray-300 rounded text-xs font-semibold text-gray-700 uppercase tracking-wide transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryBox: React.FC<{ label: string, value: string, color: string }> = ({ label, value, color }) => (
  <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm">
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
    <p className={`text-lg font-mono font-semibold text-${color === 'rose' ? 'rose-600' : 'orange-600'} tracking-tighter`}>{value}</p>
  </div>
);

export default ARView;