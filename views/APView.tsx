
import React, { useState, useMemo, useEffect } from 'react';
import { Vendor, JournalEntry, JournalLine, NonStockItem, ChartOfAccount, AccountClass, TaxCategory, WHTCategory, BankAccount, Payable, PurchaseOrder, PurchaseOrderLine, GoodsReceipt, GoodsReceiptLine, CheckVoucher, RecurringBill, RecurringBillHistory } from '../types';
import { AccountingService } from '../accountingService';
import MatchingDashboard from './MatchingDashboard';
import CheckRegisterView from './CheckRegisterView';
import RecurringBillsView from './RecurringBillsView';
import { 
  Truck, Plus, Filter, Search, FileText, ChevronRight, Clock, 
  X, Save, Trash2, AlertCircle, Calculator, Percent, History,
  Calendar, BarChart3, Download, Printer, MoreVertical, CreditCard,
  CheckCircle, Landmark, Receipt, GitCompare
} from 'lucide-react';

interface APViewProps {
  vendors: Vendor[];
  entries: JournalEntry[];
  lines: JournalLine[];
  items: NonStockItem[];
  accounts: ChartOfAccount[];
  bankAccounts: BankAccount[];
  payables: Payable[];
  checks: CheckVoucher[];
  recurringBills: RecurringBill[];
  recurringBillHistory: RecurringBillHistory[];
  purchaseOrders: PurchaseOrder[];
  purchaseOrderLines: PurchaseOrderLine[];
  goodsReceipts: GoodsReceipt[];
  goodsReceiptLines: GoodsReceiptLine[];
  currency?: string;
  currentUserId?: string;
  onPostBill: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void;
  onCreatePayable: (payable: Payable) => void;
  onApproveException?: (payableId: string, notes: string) => void;
  onCreateRecurringBill?: (bill: Partial<RecurringBill>) => void;
  onUpdateRecurringBill?: (id: string, updates: Partial<RecurringBill>) => void;
  onDeleteRecurringBill?: (id: string) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

type APTab = 'bills' | 'payments' | 'aging' | 'matching' | 'checks' | 'recurring';

const APView: React.FC<APViewProps> = ({ 
  vendors, entries, lines, items, accounts, bankAccounts, payables = [], checks = [], recurringBills = [], recurringBillHistory = [], purchaseOrders = [], purchaseOrderLines = [], goodsReceipts = [], goodsReceiptLines = [], currency = 'PHP', currentUserId = 'system', onPostBill, onCreatePayable, onApproveException, onNotify, onCreateRecurringBill, onUpdateRecurringBill, onDeleteRecurringBill 
}) => {
  const [activeTab, setActiveTab] = useState<APTab>('bills');
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [agingAsOf, setAgingAsOf] = useState(new Date().toISOString().split('T')[0]);

  // Bill Form State
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [billRef, setBillRef] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [billLines, setBillLines] = useState<{ itemId: string, qty: number, price: number }[]>([
    { itemId: '', qty: 1, price: 0 }
  ]);

  // Payment Form State
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payRef, setPayRef] = useState('');
  const [payVendorId, setPayVendorId] = useState('');
  const [payBankId, setPayBankId] = useState('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMemo, setPayMemo] = useState('');

  // Load next sequential references
  useEffect(() => {
    if (showModal) {
      setBillRef(AccountingService.getNextReference(entries, 'BILL'));
    }
  }, [showModal, entries]);

  useEffect(() => {
    if (showPaymentModal) {
      setPayRef(AccountingService.getNextReference(entries, 'PV'));
    }
  }, [showPaymentModal, entries]);

  const apEntries = entries.filter(e => e.sourceType === 'BILL' && e.status !== 'REVERSED');
  const paymentEntries = entries.filter(e => e.sourceType === 'PAYMENT' && e.status !== 'REVERSED');
  
  const totalPayables = useMemo(() => {
    const targetAccounts = accounts.filter(a => 
      a.class === AccountClass.LIABILITY && a.name.toLowerCase().includes('payable')
    );
    const targetIds = new Set(targetAccounts.map(a => a.id));
    const apLines = lines.filter(l => targetIds.has(l.accountId));
    return apLines.reduce((sum, l) => sum + (l.credit - l.debit), 0);
  }, [lines, accounts]);

  const filteredBills = apEntries.filter(bill => 
    bill.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bill.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPayments = paymentEntries.filter(p => 
    p.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const vendorBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    const apAccountIds = new Set(accounts.filter(a => a.class === AccountClass.LIABILITY && a.name.toLowerCase().includes('payable')).map(a => a.id));
    lines.forEach(l => {
      if (l.contactId && apAccountIds.has(l.accountId)) {
        balances[l.contactId] = (balances[l.contactId] || 0) + (l.credit - l.debit);
      }
    });
    return balances;
  }, [lines, accounts]);

  const agingReport = useMemo(() => {
    const targetAccounts = accounts.filter(a => a.class === AccountClass.LIABILITY && a.name.toLowerCase().includes('payable'));
    const targetIds = new Set(targetAccounts.map(a => a.id));
    const targetEntries = entries.filter(e => e.date <= agingAsOf && e.status !== 'REVERSED');
    const targetEntryIds = new Set(targetEntries.map(e => e.id));
    const targetLines = lines.filter(l => targetEntryIds.has(l.journalEntryId) && targetIds.has(l.accountId) && l.contactId);
    const referenceDate = new Date(agingAsOf);
    const buckets: Record<string, { name: string; total: number; current: number; thirty: number; sixty: number; ninety: number; }> = {};

    targetLines.forEach(line => {
      const entry = targetEntries.find(e => e.id === line.journalEntryId);
      if (!entry) return;
      const contactKey = line.contactId!;
      if (!buckets[contactKey]) {
        const v = vendors.find(x => x.id === contactKey);
        buckets[contactKey] = { name: v ? v.name : `Vendor: ${contactKey}`, total: 0, current: 0, thirty: 0, sixty: 0, ninety: 0 };
      }
      const diffTime = Math.abs(referenceDate.getTime() - new Date(entry.date).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const val = line.credit - line.debit;
      buckets[contactKey].total += val;
      if (diffDays <= 30) buckets[contactKey].current += val;
      else if (diffDays <= 60) buckets[contactKey].thirty += val;
      else if (diffDays <= 90) buckets[contactKey].sixty += val;
      else buckets[contactKey].ninety += val;
    });
    return Object.values(buckets).filter(b => Math.abs(b.total) > 0.01);
  }, [agingAsOf, lines, entries, accounts, vendors]);

  const handleAddLine = () => setBillLines([...billLines, { itemId: '', qty: 1, price: 0 }]);
  const handleRemoveLine = (index: number) => {
    if (billLines.length <= 1) return;
    setBillLines(billLines.filter((_, i) => i !== index));
  };

  const updateBillLine = (index: number, updates: any) => {
    const newLines = [...billLines];
    newLines[index] = { ...newLines[index], ...updates };
    if (updates.itemId) {
      const item = items.find(i => i.id === updates.itemId);
      if (item) newLines[index].price = item.unitPrice;
    }
    setBillLines(newLines);
  };

  const vatablePurchases = useMemo(() => billLines.reduce((sum, l) => {
    const item = items.find(i => i.id === l.itemId);
    return (item?.taxCategoryId) ? sum + (l.qty * l.price) : sum;
  }, 0), [billLines, items]);

  const totalInputVat = vatablePurchases * 0.12;
  const nonVatPurchases = useMemo(() => billLines.reduce((sum, l) => {
    const item = items.find(i => i.id === l.itemId);
    return (!item?.taxCategoryId) ? sum + (l.qty * l.price) : sum;
  }, 0), [billLines, items]);

  const totalEwt = useMemo(() => billLines.reduce((sum, l) => {
    const item = items.find(i => i.id === l.itemId);
    return sum + (l.qty * l.price * (item?.taxCategoryId ? 0.02 : 0));
  }, 0), [billLines, items]);

  const netPayableToVendor = (vatablePurchases + totalInputVat + nonVatPurchases) - totalEwt;

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) return onNotify('error', 'Vendor selection is mandatory for Accounts Payable recognition.');
    if (netPayableToVendor <= 0) return onNotify('error', 'Zero-value bills cannot be recognized as liabilities.');

    const entryId = `je-bill-${Date.now()}`;
    const vendor = vendors.find(v => v.id === vendorId);
    const apAccountId = vendor?.apAccountId || accounts.find(a => a.code.startsWith('2100'))?.id;
    const inputVatId = accounts.find(a => a.code.startsWith('1210'))?.id;
    const ewtPayableId = accounts.find(a => a.code.startsWith('2300'))?.id;

    if (!apAccountId || !inputVatId || !ewtPayableId) {
      return onNotify('error', "Accounting Framework Error: Missing mandatory G/L accounts for AP, Input VAT, or EWT.");
    }

    const finalizedLines: JournalLine[] = [];
    billLines.forEach((bl, idx) => {
      const item = items.find(i => i.id === bl.itemId);
      if (item) {
        finalizedLines.push({
          id: `l-exp-${idx}-${Date.now()}`,
          journalEntryId: entryId,
          accountId: item.expenseAccountId,
          debit: bl.qty * bl.price,
          credit: 0,
          memo: `${item.name} from ${vendor?.name}`,
          contactId: vendorId,
          contactType: 'VENDOR',
          itemId: bl.itemId
        });
      }
    });

    if (totalInputVat > 0) finalizedLines.push({ id: `l-ivat-${Date.now()}`, journalEntryId: entryId, accountId: inputVatId, debit: totalInputVat, credit: 0, memo: `Input VAT from ${billRef}`, contactId: vendorId, contactType: 'VENDOR' });
    if (totalEwt > 0) finalizedLines.push({ id: `l-ewt-${Date.now()}`, journalEntryId: entryId, accountId: ewtPayableId, debit: 0, credit: totalEwt, memo: `Expanded WHT from ${billRef}`, contactId: vendorId, contactType: 'VENDOR' });
    finalizedLines.push({ id: `l-ap-${Date.now()}`, journalEntryId: entryId, accountId: apAccountId, debit: 0, credit: netPayableToVendor, memo: `Bill ${billRef} from ${vendor?.name}`, contactId: vendorId, contactType: 'VENDOR' });

    // Post the journal entry
    onPostBill({
      id: entryId,
      date: billDate,
      reference: billRef,
      description: `Vendor Bill: ${vendor?.name}`,
      sourceType: 'BILL',
      status: 'POSTED'
    }, finalizedLines);

    // Create the payable record
    const payable: Payable = {
      id: `pay-${Date.now()}`,
      orgId: '',  // Will be set in App.tsx
      vendorId: vendorId,
      payableNumber: billRef,
      category: 'supplies',  // Default category
      description: `Bill ${billRef} from ${vendor?.name}`,
      amount: vatablePurchases + nonVatPurchases,
      billDate: billDate,
      dueDate: billDate,  // Same as bill date; can be adjusted in payables view
      paymentDate: undefined,
      currency: 'PHP',
      status: 'for_approval',
      referenceDocument: billRef,
      journalEntryId: entryId,
      glAccountId: apAccountId,
      notes: `Posted from Bill ${billRef}`,
      withholdingType: totalEwt > 0 ? 'EXPANDED' : undefined,
      withholdingAmount: totalEwt,
      netPayable: netPayableToVendor,
      createdBy: currentUserId,
      createdAt: new Date().toISOString(),
      isDeleted: false
    };
    onCreatePayable(payable);
    
    setShowModal(false);
    resetForm();
  };

  const handlePostPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payVendorId) return onNotify('error', 'Validation Error: A payee vendor must be selected.');
    if (payAmount <= 0) return onNotify('error', 'Validation Error: Payment amount must exceed zero.');
    if (!payBankId) return onNotify('error', 'Configuration Error: Specify the source bank/cash account for disbursement.');

    const vendor = vendors.find(v => v.id === payVendorId);
    const bank = bankAccounts.find(b => b.id === payBankId);
    const apAccountId = vendor?.apAccountId || accounts.find(a => a.code.startsWith('2100'))?.id;

    if (!bank || !apAccountId) return onNotify('error', "Accounting Resolution Error: Targeted bank or AP ledger account is currently unreachable.");

    const entryId = `je-pymt-${Date.now()}`;
    const finalizedLines: JournalLine[] = [
      { id: `l-ap-dr-${Date.now()}`, journalEntryId: entryId, accountId: apAccountId, debit: payAmount, credit: 0, memo: payMemo || `Payment ${payRef} to ${vendor?.name}`, contactId: payVendorId, contactType: 'VENDOR' },
      { id: `l-cash-cr-${Date.now()}`, journalEntryId: entryId, accountId: bank.glAccountId, debit: 0, credit: payAmount, memo: payMemo || `Payment ${payRef} to ${vendor?.name}`, contactId: payVendorId, contactType: 'VENDOR' }
    ];

    onPostBill({
      id: entryId,
      date: payDate,
      reference: payRef,
      description: `Vendor Payment: ${vendor?.name}`,
      sourceType: 'PAYMENT',
      status: 'POSTED'
    }, finalizedLines);

    setShowPaymentModal(false);
    setPayAmount(0);
    setPayVendorId('');
  };

  const resetForm = () => {
    setBillDate(new Date().toISOString().split('T')[0]);
    setVendorId('');
    setBillLines([{ itemId: '', qty: 1, price: 0 }]);
  };

  const formatCurrency = (val: number) => {
    const symbol = currency === 'PHP' ? '\u20B1' : currency === 'USD' ? '$' : '';
    return `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Payables & Procurement</h2>
          <p className="text-sm text-slate-500 font-normal italic">Manage supplier liabilities and monitor procurement credit cycles.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
           <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 flex-wrap">
             <button onClick={() => setActiveTab('bills')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'bills' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <FileText size={14} className="inline mr-1.5" /> Bills
             </button>
             <button onClick={() => setActiveTab('matching')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'matching' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <GitCompare size={14} className="inline mr-1.5" /> 3-Way Match
             </button>
             <button onClick={() => setActiveTab('payments')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'payments' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <CreditCard size={14} className="inline mr-1.5" /> Payments
             </button>
             <button onClick={() => setActiveTab('checks')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'checks' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <Printer size={14} className="inline mr-1.5" /> Check Register
             </button>
             <button onClick={() => setActiveTab('recurring')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'recurring' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <Clock size={14} className="inline mr-1.5" /> Recurring Bills
             </button>
             <button onClick={() => setActiveTab('aging')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'aging' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <BarChart3 size={14} className="inline mr-1.5" /> Aging
             </button>
           </div>
           <button 
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-md font-bold text-sm active:scale-95"
          >
            <Landmark size={18} /> Pay Bill
          </button>
           <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-all shadow-md font-bold text-sm active:scale-95"
          >
            <Plus size={18} /> Record Bill
          </button>
        </div>
      </div>

      {activeTab === 'bills' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryBox label="Total Payables" value={formatCurrency(totalPayables)} color="teal" />
            <SummaryBox label="Pending Approval" value="0.00" color="slate" />
            <SummaryBox label="Due within 7 Days" value="0.00" color="rose" />
            <SummaryBox label="Active Vendors" value={vendors.length.toString()} color="amber" />
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input placeholder="Find bill by ref or vendor..." className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none w-64 focus:ring-1 focus:ring-teal-600" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Supplier / Vendor</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bill #</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount Due</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBills.length > 0 ? filteredBills.reverse().map(bill => {
                  const apLine = lines.find(l => {
                    if (l.journalEntryId !== bill.id) return false;
                    const acc = accounts.find(a => a.id === l.accountId);
                    return acc && acc.class === AccountClass.LIABILITY && acc.name.toLowerCase().includes('payable');
                  });
                  const amount = apLine ? apLine.credit - apLine.debit : 0;
                  return (
                    <tr key={bill.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-400 flex items-center justify-center font-bold text-[10px]">V</div>
                        <div className="text-sm font-bold text-slate-800">{bill.description.split(': ')[1]}</div>
                      </td>
                      <td className="px-6 py-5 text-xs font-mono font-semibold text-teal-600">{bill.reference}</td>
                      <td className="px-6 py-5 text-xs text-slate-600">{bill.date}</td>
                      <td className="px-6 py-5 text-right font-mono font-bold text-slate-800">{formatCurrency(amount)}</td>
                      <td className="px-6 py-5 text-center">
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-bold uppercase rounded-full border border-amber-100">Unpaid</span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button 
                          onClick={() => { setSelectedJournalId(bill.id); setShowJournalModal(true); }}
                          className="p-2 hover:bg-slate-100 rounded-lg text-teal-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="View Journal Entry"
                        >
                          <FileText size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr><td colSpan={6} className="py-20 text-center text-slate-400 italic">No vendor bills recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'payments' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest px-2">Payment Journal Registry</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input placeholder="Find payment by ref or vendor..." className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none w-64 focus:ring-1 focus:ring-teal-600" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payee / Vendor</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payment Ref</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount Paid</th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bank Source</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length > 0 ? filteredPayments.reverse().map(pymt => {
                const bankLine = lines.find(l => l.journalEntryId === pymt.id && l.credit > 0);
                const bankAcc = bankAccounts.find(b => b.glAccountId === bankLine?.accountId);
                return (
                  <tr key={pymt.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-teal-600 flex items-center justify-center font-bold text-[10px]"><CheckCircle size={14} /></div>
                      <div className="text-sm font-bold text-slate-800">{pymt.description.split(': ')[1]}</div>
                    </td>
                    <td className="px-6 py-5 text-xs font-mono font-semibold text-teal-600">{pymt.reference}</td>
                    <td className="px-6 py-5 text-xs text-slate-600">{pymt.date}</td>
                    <td className="px-6 py-5 text-right font-mono font-bold text-rose-600">{formatCurrency(bankLine?.credit || 0)}</td>
                    <td className="px-6 py-5 text-center">
                       <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[9px] font-bold text-slate-500 uppercase">
                        <Landmark size={10} /> {bankAcc?.bankName || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right"><MoreVertical size={16} className="text-slate-300" /></td>
                  </tr>
                )
              }) : (
                <tr><td colSpan={6} className="py-20 text-center text-slate-400 italic">No payment journals posted.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'matching' && (
        <MatchingDashboard
          payables={payables}
          purchaseOrders={purchaseOrders}
          goodsReceipts={goodsReceipts}
          poLines={purchaseOrderLines}
          grLines={goodsReceiptLines}
          vendors={vendors}
          accounts={accounts}
          onApproveException={onApproveException}
          onNotify={onNotify}
        />
      )}

      {activeTab === 'recurring' && (
        <RecurringBillsView
          recurringBills={recurringBills}
          history={recurringBillHistory}
          vendors={vendors}
          accounts={accounts}
          bankAccounts={bankAccounts}
          onCreateBill={onCreateRecurringBill || ((bill) => {})}
          onUpdateBill={onUpdateRecurringBill || ((id, updates) => {})}
          onDeleteBill={onDeleteRecurringBill || ((id) => {})}
          onNotify={onNotify}
        />
      )}

      {activeTab === 'checks' && (
        <CheckRegisterView
          checks={checks}
          bankAccounts={bankAccounts}
          vendors={vendors}
          payables={payables}
          onNotify={onNotify}
        />
      )}

      {activeTab === 'aging' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-50 text-teal-600 rounded-xl"><Calendar size={20} /></div>
                <div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Effective Aging Date</p>
                   <input type="date" className="bg-transparent border-none outline-none font-bold text-slate-800 text-lg p-0 focus:ring-0" value={agingAsOf} onChange={e => setAgingAsOf(e.target.value)} />
                </div>
             </div>
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vendor Entity</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current (0-30)</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">31 - 60 Days</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">61 - 90 Days</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-rose-500 uppercase tracking-widest">Over 90 Days</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-900 uppercase tracking-widest">Total Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agingReport.length > 0 ? agingReport.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5 flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-[9px] uppercase">V</div>
                       <div className="text-sm font-bold text-slate-800">{row.name}</div>
                    </td>
                    <td className="px-6 py-5 text-right font-mono text-xs text-teal-600 font-bold">{formatCurrency(row.current)}</td>
                    <td className="px-6 py-5 text-right font-mono text-xs text-amber-600 font-bold">{formatCurrency(row.thirty)}</td>
                    <td className="px-6 py-5 text-right font-mono text-xs text-orange-600 font-bold">{formatCurrency(row.sixty)}</td>
                    <td className="px-6 py-5 text-right font-mono text-xs text-rose-600 font-black bg-rose-50/30">{formatCurrency(row.ninety)}</td>
                    <td className="px-6 py-5 text-right font-mono text-sm text-slate-900 font-black">{formatCurrency(row.total)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="py-20 text-center text-slate-400 italic">No outstanding payables found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90] overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-600 text-white rounded-xl shadow-md"><Receipt size={20} /></div>
                <h3 className="text-xl font-semibold text-slate-800 uppercase tracking-tight">Post Vendor Settlement</h3>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>

            <form onSubmit={handlePostPayment} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Payment Date</label>
                  <input type="date" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" value={payDate} onChange={e => setPayDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Payment Voucher (PV) #</label>
                  <input readOnly className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-black text-rose-600 font-mono" value={payRef} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Select Vendor to Pay</label>
                <select required className="w-full px-4 py-2.5 bg-white border border-teal-200 rounded-xl text-sm font-semibold text-teal-700 appearance-none" value={payVendorId} onChange={e => setPayVendorId(e.target.value)}>
                  <option value="">Choose Supplier...</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} (Outstanding: {formatCurrency(vendorBalances[v.id] || 0)})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Bank/Source Account</label>
                  <select required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" value={payBankId} onChange={e => setPayBankId(e.target.value)}>
                    <option value="">Select Account...</option>
                    {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bankName}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Payment Amount</label>
                  <input type="number" step="0.01" required className="w-full px-4 py-2.5 bg-white border border-rose-200 rounded-xl text-lg font-mono font-black text-rose-600 outline-none" value={payAmount || ''} onChange={e => setPayAmount(Number(e.target.value))} placeholder="0.00" />
                </div>
              </div>

              <div className="space-y-1.5">
                 <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Memo / Internal Notes</label>
                 <textarea rows={2} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none resize-none" value={payMemo} onChange={e => setPayMemo(e.target.value)} placeholder="e.g. Settlement for Bill..." />
              </div>

              <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100 flex gap-3">
                 <AlertCircle className="text-teal-600 shrink-0" size={20} />
                 <p className="text-[11px] text-teal-800 leading-relaxed font-medium">
                   Recording a payment will Debit your Accounts Payable subsidiary and Credit the selected Cash account. This will reduce your total liabilities.
                 </p>
              </div>

              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="flex-1 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-2xl transition-all">Discard</button>
                <button type="submit" disabled={payAmount <= 0 || !payVendorId || !payBankId} className="flex-1 py-3.5 bg-rose-600 text-white rounded-2xl text-sm font-bold shadow-xl shadow-rose-100 disabled:opacity-50 hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Save size={18} /> Confirm Disbursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bill Registration Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90] overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-600 text-white rounded-xl shadow-md"><Truck size={20} /></div>
                <h3 className="text-xl font-semibold text-slate-800 uppercase tracking-tight">Record Supplier Bill</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handlePost} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="space-y-1.5"><label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Bill Date</label><input type="date" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" value={billDate} onChange={e => setBillDate(e.target.value)} /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Bill Reference (Sequential)</label><input readOnly className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-mono font-black text-teal-600" value={billRef} /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Select Vendor</label><select required className="w-full px-4 py-2.5 bg-white border border-teal-200 rounded-xl text-sm font-semibold text-teal-600 appearance-none" value={vendorId} onChange={e => setVendorId(e.target.value)}><option value="">Choose Supplier...</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
              </div>

              <div className="space-y-4 mb-8">
                {billLines.map((line, idx) => {
                  const item = items.find(i => i.id === line.itemId);
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-3 items-center p-3 bg-white rounded-2xl border border-slate-100 hover:border-teal-200 shadow-sm">
                      <div className="col-span-4"><select required className="w-full px-3 py-2 bg-teal-50/50 border border-teal-100 rounded-xl text-xs font-bold text-teal-700 outline-none" value={line.itemId} onChange={e => updateBillLine(idx, { itemId: e.target.value })}><option value="">Select Item...</option>{items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
                      <div className="col-span-2 text-center"><div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest inline-block ${item?.taxCategoryId ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{item?.taxCategoryId ? 'VAT' : 'NO-VAT'}</div></div>
                      <div className="col-span-1"><input type="number" min="1" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm font-bold" value={line.qty} onChange={e => updateBillLine(idx, { qty: Number(e.target.value) })} /></div>
                      <div className="col-span-2"><input type="number" step="0.01" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-right text-xs font-mono font-medium" value={line.price} onChange={e => updateBillLine(idx, { price: Number(e.target.value) })} /></div>
                      <div className="col-span-2 text-right text-xs font-mono font-bold text-slate-800">{(line.qty * line.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      <div className="col-span-1 flex justify-center"><button type="button" onClick={() => handleRemoveLine(idx)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button></div>
                    </div>
                  );
                })}
                <button type="button" onClick={handleAddLine} className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-teal-600 hover:bg-teal-50 rounded-xl transition-colors"><Plus size={16} /> Add Procurement Row</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8 bg-slate-50 rounded-3xl border border-slate-200">
                <div className="space-y-2"><SummaryRow label="Input VAT (12%)" value={totalInputVat} isHighlighted /><SummaryRow label="Non-VAT / Exempt" value={nonVatPurchases} /></div>
                <div className="space-y-2"><div className="flex justify-between items-center text-xs font-bold text-rose-600"><span>Less: Withheld Tax (EWT)</span><span>({formatCurrency(totalEwt)})</span></div><div className="pt-2 border-t border-slate-200 mt-2"><SummaryRow label="Net Amount to Vendor" value={netPayableToVendor} isBig /></div></div>
                <div className="flex flex-col justify-end gap-3"><button type="button" onClick={() => setShowModal(false)} className="py-3.5 text-sm font-bold text-slate-500 hover:bg-white rounded-2xl border border-transparent hover:border-slate-200 transition-all">Discard</button><button type="submit" disabled={netPayableToVendor <= 0 || !vendorId} className="py-3.5 bg-teal-600 text-white rounded-2xl text-sm font-bold shadow-xl shadow-teal-100 hover:bg-teal-700 transition-all flex items-center justify-center gap-2"><Save size={18} /> Post to Payables</button></div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Journal Entry Details Modal */}
      {showJournalModal && selectedJournalId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-96 overflow-auto">
            {(() => {
              const entry = entries.find(e => e.id === selectedJournalId);
              const entryLines = lines.filter(l => l.journalEntryId === selectedJournalId);
              return (
                <>
                  <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center sticky top-0">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">Journal Entry Details</h3>
                      <p className="text-xs text-slate-500 mt-1">Reference: {entry?.reference} | Date: {entry?.date}</p>
                    </div>
                    <button 
                      onClick={() => { setShowJournalModal(false); setSelectedJournalId(null); }}
                      className="p-2 hover:bg-white rounded-lg transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Description</p>
                        <p className="text-sm font-semibold text-slate-800 mt-1">{entry?.description}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Source Type</p>
                        <p className="text-sm font-semibold text-teal-600 mt-1">{entry?.sourceType}</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left px-3 py-2 font-bold text-slate-500">Account</th>
                            <th className="text-right px-3 py-2 font-bold text-slate-500">Debit</th>
                            <th className="text-right px-3 py-2 font-bold text-slate-500">Credit</th>
                            <th className="text-left px-3 py-2 font-bold text-slate-500">Memo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {entryLines.map(line => {
                            const acc = accounts.find(a => a.id === line.accountId);
                            return (
                              <tr key={line.id} className="hover:bg-slate-50">
                                <td className="px-3 py-2">
                                  <div className="font-semibold text-slate-700">{acc?.name}</div>
                                  <div className="text-[9px] text-slate-400 font-mono">{acc?.code}</div>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {line.debit > 0 && <span className="font-mono font-semibold text-slate-800">{line.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {line.credit > 0 && <span className="font-mono font-semibold text-slate-800">{line.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
                                </td>
                                <td className="px-3 py-2 text-slate-600">{line.memo}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                      <button 
                        onClick={() => { setShowJournalModal(false); setSelectedJournalId(null); }}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryRow: React.FC<{ label: string, value: number, isHighlighted?: boolean, isBig?: boolean }> = ({ label, value, isHighlighted, isBig }) => (
  <div className="flex justify-between items-center">
     <span className={`text-[11px] font-medium ${isHighlighted ? 'text-teal-700' : 'text-slate-500'}`}>{label}</span>
     <span className={`font-mono font-bold ${isBig ? 'text-lg text-slate-900' : isHighlighted ? 'text-teal-700 text-xs' : 'text-slate-700 text-xs'}`}>
        {value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
     </span>
  </div>
);

const SummaryBox: React.FC<{ label: string, value: string, color: string }> = ({ label, value, color }) => (
  <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
     <p className={`text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1`}>{label}</p>
     <p className={`text-xl font-mono font-bold text-${color === 'emerald' ? 'emerald-600' : color === 'rose' ? 'rose-600' : color === 'teal' ? 'teal-600' : 'amber-600'}`}>{value}</p>
  </div>
);

export default APView;
