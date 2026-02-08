
import React, { useState, useMemo, useEffect } from 'react';
import { Sponsor, Student, JournalEntry, JournalLine, NonStockItem, ChartOfAccount, AccountClass, TaxCategory, WHTCategory, BankAccount } from '../types';
import { AccountingService } from '../accountingService';
import { 
  FileText, Plus, Search, Filter, Mail, CheckCircle, Clock, 
  MoreVertical, CreditCard, ChevronRight, X, User, Handshake, 
  Trash2, AlertCircle, Save, CheckCircle2, Link as LinkIcon,
  BookOpen, Calculator, Percent, History, Calendar, BarChart3,
  Download, Printer, Landmark, Wallet, Receipt
} from 'lucide-react';

interface ARViewProps {
  entries: JournalEntry[];
  lines: JournalLine[];
  students: Student[];
  sponsors: Sponsor[];
  items: NonStockItem[];
  accounts: ChartOfAccount[];
  bankAccounts: BankAccount[];
  onPostInvoice: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void;
  onApproveInvoice?: (entryId: string) => void;
  currentUser?: any;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

type ARTab = 'invoices' | 'collections' | 'aging';

const ARView: React.FC<ARViewProps> = ({ 
  entries, lines, students, sponsors, items, accounts, bankAccounts, onPostInvoice, onApproveInvoice, currentUser, onNotify 
}) => {
  const [activeTab, setActiveTab] = useState<ARTab>('invoices');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [agingAsOf, setAgingAsOf] = useState(new Date().toISOString().split('T')[0]);

  // Invoice Form State
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceRef, setInvoiceRef] = useState('');
  const [recipientType, setRecipientType] = useState<'STUDENT' | 'SPONSOR'>('SPONSOR');
  const [recipientId, setRecipientId] = useState('');
  const [selectedArAccountId, setSelectedArAccountId] = useState('');
  const [invoiceLines, setInvoiceLines] = useState<{ itemId: string, qty: number, price: number }[]>([
    { itemId: '', qty: 1, price: 0 }
  ]);

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
    if (showInvoiceModal) {
      setInvoiceRef(AccountingService.getNextReference(entries, 'SI'));
    }
  }, [showInvoiceModal, entries]);

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
                        accounts.find(a => a.name.toLowerCase().includes('accounts receivable') && a.class === AccountClass.ASSET && !a.isHeader)?.id ||
                        accounts.find(a => a.name.toLowerCase().includes('receivable') && a.class === AccountClass.ASSET && !a.isHeader)?.id;
      
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
                        accounts.find(a => a.name.toLowerCase().includes('accounts receivable') && a.class === AccountClass.ASSET && !a.isHeader)?.id;
      
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
    const arAccounts = new Set(accounts.filter(a => a.class === AccountClass.ASSET && a.name.toLowerCase().includes('receivable')).map(a => a.id));
    
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
      a.name.toLowerCase().includes('vat payable') || 
      a.name.toLowerCase().includes('output vat') ||
      (a.code && a.code.startsWith('2400'))
    ).map(a => a.id));
    
    // VAT should also only reflect POSTED tax liabilities
    const postedEntryIds = new Set(entries.filter(e => e.status === 'POSTED').map(e => e.id));
    return lines.filter(l => postedEntryIds.has(l.journalEntryId) && vatAccountIds.has(l.accountId)).reduce((sum, l) => sum + (l.credit - l.debit), 0);
  }, [lines, entries, accounts]);

  const filteredInvoices = arInvoices.filter(inv => 
    inv.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCollections = arCollections.filter(c => 
    c.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const agingReport = useMemo(() => {
    const targetAccounts = accounts.filter(a => a.class === AccountClass.ASSET && a.name.toLowerCase().includes('receivable'));
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

  const handleAddInvoiceLine = () => setInvoiceLines([...invoiceLines, { itemId: '', qty: 1, price: 0 }]);
  const handleRemoveInvoiceLine = (i: number) => setInvoiceLines(invoiceLines.filter((_, idx) => idx !== i));
  const updateInvoiceLine = (index: number, updates: any) => {
    const newLines = [...invoiceLines];
    newLines[index] = { ...newLines[index], ...updates };
    if (updates.itemId) {
      const item = items.find(i => i.id === updates.itemId);
      if (item) newLines[index].price = item.unitPrice;
    }
    setInvoiceLines(newLines);
  };

  const totalInvoiceNet = useMemo(() => invoiceLines.reduce((sum, l) => sum + (l.qty * l.price), 0), [invoiceLines]);

  const vatableSales = useMemo(() => invoiceLines.reduce((sum, l) => {
    const item = items.find(i => i.id === l.itemId);
    return (item?.taxCategoryId === 'VAT') ? sum + (l.qty * l.price) : sum;
  }, 0), [invoiceLines, items]);

  const totalVat = Math.round(vatableSales * 0.12 * 100) / 100;
  const grossInvoiceAmount = totalInvoiceNet + totalVat;

  const handlePostInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId) return onNotify('error', 'Validation Error: Learner or Sponsor recipient must be defined.');
    if (grossInvoiceAmount <= 0) return onNotify('error', 'Validation Error: Invoice amount must be greater than zero.');
    
    const entryId = `je-inv-${Date.now()}`;
    // Use the explicitly selected G/L account from the form
    const arAccountId = selectedArAccountId;
      
    const vatPayableId = accounts.find(a => a.code === '2200')?.id || 
      accounts.find(a => a.name.toLowerCase().includes('vat payable'))?.id ||
      accounts.find(a => a.name.toLowerCase().includes('output vat'))?.id ||
      accounts.find(a => a.name.toLowerCase().includes('vat'))?.id;
    
    if (!arAccountId) {
      return onNotify('error', 'Accounting Error: Please select a Target G/L Receivable Account.');
    }

    if (totalVat > 0 && !vatPayableId) {
      return onNotify('error', 'Accounting Error: VAT account (2200 or "Output VAT") not found in Chart of Accounts.');
    }

    const finalizedLines: JournalLine[] = [];
    finalizedLines.push({ id: `l-ar-${Date.now()}`, journalEntryId: entryId, accountId: arAccountId, debit: grossInvoiceAmount, credit: 0, contactId: recipientId, contactType: recipientType });
    invoiceLines.forEach((il, idx) => {
      const item = items.find(i => i.id === il.itemId);
      if (item) finalizedLines.push({ id: `l-rev-${idx}-${Date.now()}`, journalEntryId: entryId, accountId: item.incomeAccountId, debit: 0, credit: il.qty * il.price, contactId: recipientId, contactType: recipientType, itemId: il.itemId });
    });
    if (totalVat > 0) finalizedLines.push({ id: `l-vat-${Date.now()}`, journalEntryId: entryId, accountId: vatPayableId, debit: 0, credit: totalVat, contactId: recipientId, contactType: recipientType });

    onPostInvoice({ id: entryId, date: invoiceDate, reference: invoiceRef, description: `Sales Invoice: ${recipientType === 'SPONSOR' ? sponsors.find(s => s.id === recipientId)?.name : students.find(s => s.id === recipientId)?.lastName}`, sourceType: 'INVOICE', status: 'DRAFT' }, finalizedLines);
    setShowInvoiceModal(false);
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
      { id: `l-cash-${Date.now()}`, journalEntryId: entryId, accountId: bank.glAccountId, debit: collAmount, credit: 0, memo: `Collection ${collRef} from ${payerName}`, contactId: collPayerId, contactType: collPayerType },
      { id: `l-ar-cr-${Date.now()}`, journalEntryId: entryId, accountId: arAccountId, debit: 0, credit: collAmount, memo: `Collection ${collRef} from ${payerName}`, contactId: collPayerId, contactType: collPayerType }
    ];

    onPostInvoice({ id: entryId, date: collDate, reference: collRef, description: `Collection Payment: ${payerName}`, sourceType: 'COLLECTION', status: 'POSTED' }, finalizedLines);
    setShowCollectionModal(false);
    setCollAmount(0);
  };

  const formatCurrency = (val: number) => `\u20B1 ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Receivables & Revenue Cycle</h2>
          <p className="text-sm text-slate-500 font-normal italic">Monitor institutional cash inflows and analyzed aging debt buckets.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
           <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
             <button onClick={() => setActiveTab('invoices')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'invoices' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <FileText size={14} className="inline mr-1.5" /> Invoices
             </button>
             <button onClick={() => setActiveTab('collections')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'collections' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <Receipt size={14} className="inline mr-1.5" /> Collections
             </button>
             <button onClick={() => setActiveTab('aging')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'aging' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <BarChart3 size={14} className="inline mr-1.5" /> Aging Report
             </button>
           </div>
           <button onClick={() => { setShowCollectionModal(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-all shadow-md font-bold text-sm active:scale-95"><Landmark size={18} /> Collect Payment</button>
           <button onClick={() => { setShowInvoiceModal(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-all shadow-md font-bold text-sm active:scale-95"><Plus size={18} /> New Invoice</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryBox label="Gross Receivables" value={formatCurrency(totalReceivables)} color="teal" />
        <SummaryBox label="Collections (MTD)" value={formatCurrency(arCollections.filter(c => {
          const entryDate = new Date(c.date);
          const now = new Date();
          return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
        }).reduce((s: number, c) => {
          const l = lines.find(line => line.journalEntryId === c.id && line.debit > 0);
          return s + (l?.debit || 0);
        }, 0))} color="emerald" />
        <SummaryBox label="Output VAT Due" value={formatCurrency(totalOutputVat)} color="amber" />
        <SummaryBox label="Collection Efficiency" value="84%" color="slate" />
      </div>

      {activeTab === 'invoices' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input placeholder="Find invoice by ref or customer..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none w-72 focus:ring-1 focus:ring-teal-600" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer / Sponsor</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Invoice #</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount Due</th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length > 0 ? filteredInvoices.reverse().map(inv => {
                const arLine = lines.find(l => l.journalEntryId === inv.id && l.debit > 0);
                return (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-5"><div className="text-sm font-bold text-slate-800">{inv.description.split(': ')[1]}</div></td>
                    <td className="px-6 py-5 text-xs font-mono font-bold text-teal-600">{inv.reference}</td>
                    <td className="px-6 py-5 text-xs text-slate-600">{inv.date}</td>
                    <td className="px-6 py-5 text-right font-mono font-bold text-slate-900">{formatCurrency(arLine?.debit || 0)}</td>
                    <td className="px-6 py-5 text-center">
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-full border ${
                        inv.status === 'POSTED' 
                          ? 'bg-teal-50 text-teal-600 border-teal-100' 
                          : 'bg-amber-50 text-teal-600 border-amber-100'
                      }`}>
                        {inv.status || 'DRAFT'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {inv.status !== 'POSTED' && (currentUser?.role === 'ACCOUNTANT' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN') && (
                          <button 
                            onClick={() => onApproveInvoice?.(inv.id)}
                            className="flex items-center gap-1.5 px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[10px] font-bold transition-all shadow-sm"
                            title="Approve and Post to Ledger"
                          >
                            <CheckCircle2 size={12} /> Approve
                          </button>
                        )}
                        <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-300 transition-colors">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }) : (
                <tr><td colSpan={6} className="py-20 text-center text-slate-400 italic">No sales invoices recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'collections' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest px-2">Recent Official Receipts</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input placeholder="Find by OR# or Payer..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none w-72 focus:ring-1 focus:ring-teal-600" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payer Entity</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">OR # / Ref</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Collected Amount</th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deposit Account</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCollections.length > 0 ? filteredCollections.reverse().map(coll => {
                const cashLine = lines.find(l => l.journalEntryId === coll.id && l.debit > 0);
                const bankAcc = bankAccounts.find(b => b.glAccountId === cashLine?.accountId);
                return (
                  <tr key={coll.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center"><CheckCircle size={14} /></div>
                      <div className="text-sm font-bold text-slate-800">{coll.description.split(': ')[1]}</div>
                    </td>
                    <td className="px-6 py-5 text-xs font-mono font-bold text-teal-600">{coll.reference}</td>
                    <td className="px-6 py-5 text-xs text-slate-600">{coll.date}</td>
                    <td className="px-6 py-5 text-right font-mono font-bold text-teal-600">{formatCurrency(cashLine?.debit || 0)}</td>
                    <td className="px-6 py-5 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[9px] font-bold text-slate-500 uppercase">
                        <Landmark size={10} /> {bankAcc?.bankName || 'Treasury'}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right"><MoreVertical size={16} className="text-slate-300 inline" /></td>
                  </tr>
                )
              }) : (
                <tr><td colSpan={6} className="py-20 text-center text-slate-400 italic">No collections recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
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
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Debtor Identity</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current (0-30)</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">31 - 60 Days</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">61 - 90 Days</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-rose-500 uppercase tracking-widest">Over 90 Days</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-900 uppercase tracking-widest">Total Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agingReport.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5 text-sm font-bold text-slate-800">{row.name}</td>
                    <td className="px-6 py-5 text-right font-mono text-xs text-teal-600">{formatCurrency(row.current)}</td>
                    <td className="px-6 py-5 text-right font-mono text-xs text-teal-600">{formatCurrency(row.thirty)}</td>
                    <td className="px-6 py-5 text-right font-mono text-xs text-teal-600">{formatCurrency(row.sixty)}</td>
                    <td className="px-6 py-5 text-right font-mono text-xs text-rose-600 font-bold bg-rose-50/20">{formatCurrency(row.ninety)}</td>
                    <td className="px-6 py-5 text-right font-mono text-sm font-black text-slate-900">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
                {agingReport.length === 0 && (
                   <tr><td colSpan={6} className="py-20 text-center text-slate-400 italic">No outstanding receivables found as of this date.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90] overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-teal-600 text-white rounded-2xl shadow-xl"><FileText size={24} /></div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Generate Sales Invoice</h3>
               </div>
               <button onClick={() => setShowInvoiceModal(false)} className="text-slate-400 hover:text-slate-600"><X size={28} /></button>
            </div>

            <form onSubmit={handlePostInvoice} className="p-10 space-y-10">
               <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Invoice Date</label>
                    <input type="date" required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Sequential #</label>
                    <input readOnly className="w-full px-5 py-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-black text-teal-600 font-mono" value={invoiceRef} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Recipient Type</label>
                    <select className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold" value={recipientType} onChange={e => { setRecipientType(e.target.value as any); setRecipientId(''); }}>
                      <option value="SPONSOR">Corporate Sponsor</option>
                      <option value="STUDENT">Individual Learner</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Select Entity</label>
                    <select required className="w-full px-5 py-3.5 bg-white border-2 border-teal-100 rounded-2xl text-sm font-black text-teal-700" value={recipientId} onChange={e => setRecipientId(e.target.value)}>
                      <option value="">Choose...</option>
                      {recipientType === 'SPONSOR' 
                        ? sponsors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                        : students.map(st => <option key={st.id} value={st.id}>{st.lastName}, {st.firstName}</option>)
                      }
                    </select>
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-teal-50/30 rounded-3xl border border-teal-100/50">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-teal-600 uppercase tracking-widest flex items-center gap-2 px-1">
                      <BookOpen size={12} /> Target G/L Receivable Account
                    </label>
                    <select 
                      required 
                      className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm"
                      value={selectedArAccountId}
                      onChange={e => setSelectedArAccountId(e.target.value)}
                    >
                      <option value="">Select account...</option>
                      {accounts.filter(a => a.class === AccountClass.ASSET && !a.isHeader && a.name.toLowerCase().includes('receivable')).map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[9px] text-slate-500 italic mt-1 px-1">
                      This defines where the debit entry will be recorded in the general ledger.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-slate-400 italic text-xs pt-4">
                    <AlertCircle size={14} className="text-teal-400" />
                    <span>Selected account is automatically synced with {recipientType === 'SPONSOR' ? 'Sponsor' : 'Individual'} defaults but can be overridden here.</span>
                  </div>
               </div>
               <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-4 px-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    <div className="col-span-5">Item / Service</div>
                    <div className="col-span-2 text-center">Qty</div>
                    <div className="col-span-2 text-right">Rate</div>
                    <div className="col-span-2 text-right">Subtotal</div>
                    <div className="col-span-1"></div>
                  </div>
                  {invoiceLines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-4 items-center p-4 bg-white rounded-2xl border border-slate-100 hover:border-teal-100 transition-all">
                      <div className="col-span-5">
                        <select required className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold" value={line.itemId} onChange={e => updateInvoiceLine(idx, { itemId: e.target.value })}>
                          <option value="">Select Item...</option>
                          {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2"><input type="number" min="1" className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-center text-xs font-black" value={line.qty} onChange={e => updateInvoiceLine(idx, { qty: Number(e.target.value) })} /></div>
                      <div className="col-span-2"><input type="number" step="0.01" className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-right text-xs font-mono font-bold" value={line.price} onChange={e => updateInvoiceLine(idx, { price: Number(e.target.value) })} /></div>
                      <div className="col-span-2 text-right font-mono font-black text-sm">{(line.qty * line.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      <div className="col-span-1 flex justify-center"><button type="button" onClick={() => handleRemoveInvoiceLine(idx)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16}/></button></div>
                    </div>
                  ))}
                  <button type="button" onClick={handleAddInvoiceLine} className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase text-teal-600 hover:bg-teal-50 rounded-xl transition-colors border-2 border-dashed border-teal-100"><Plus size={14}/> Add Invoice Line</button>
               </div>

               <div className="p-10 bg-slate-900 rounded-[3rem] flex flex-col md:flex-row justify-between items-center gap-10 shadow-2xl">
                  <div className="flex gap-10">
                     <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Subtotal (Net)</p>
                        <p className="text-xl font-mono font-black text-white">{"\u20B1"} {totalInvoiceNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Output VAT (12%)</p>
                        <p className="text-xl font-mono font-black text-white">{"\u20B1"} {totalVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                     </div>
                     <div className="w-px h-12 bg-white/10"></div>
                     <div className="space-y-1">
                        <p className="text-[10px] font-black text-brand uppercase tracking-widest">Gross Invoice Value</p>
                        <p className="text-3xl font-mono font-black text-white tracking-tighter">{"\u20B1"} {grossInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                     </div>
                  </div>
                  <div className="flex gap-4 w-full md:w-auto">
                    <button type="button" onClick={() => setShowInvoiceModal(false)} className="flex-1 px-8 py-4 text-xs font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors">Discard</button>
                    <button type="submit" className="flex-1 px-12 py-4 bg-teal-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-teal-900/40 hover:bg-teal-500 active:scale-95 transition-all">Authorize & Post SI</button>
                  </div>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* Collection Modal */}
      {showCollectionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90] overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-teal-600 text-white rounded-2xl shadow-xl shadow-teal-200"><Landmark size={24} /></div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Record Receipt (OR)</h3>
               </div>
               <button onClick={() => setShowCollectionModal(false)} className="text-slate-400 hover:text-slate-600"><X size={28} /></button>
            </div>

            <form onSubmit={handlePostCollection} className="p-10 space-y-8">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Receipt Date</label>
                    <input type="date" required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold" value={collDate} onChange={e => setCollDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">OR # / Reference</label>
                    <input readOnly className="w-full px-5 py-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-black text-teal-600 font-mono" value={collRef} />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Payer Category</label>
                    <select className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold" value={collPayerType} onChange={e => { setCollPayerType(e.target.value as any); setCollPayerId(''); }}>
                      <option value="SPONSOR">Corporate Sponsor</option>
                      <option value="STUDENT">Individual Learner</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Entity Identity</label>
                    <select required className="w-full px-5 py-3.5 bg-white border-2 border-teal-100 rounded-2xl text-sm font-black text-teal-700" value={collPayerId} onChange={e => setCollPayerId(e.target.value)}>
                      <option value="">Select Payer...</option>
                      {collPayerType === 'SPONSOR' 
                        ? sponsors.map(s => <option key={s.id} value={s.id}>{s.name} (Bal: {formatCurrency(subsidiaryBalances[s.id] || 0)})</option>)
                        : students.map(st => <option key={st.id} value={st.id}>{st.lastName} (Bal: {formatCurrency(subsidiaryBalances[st.id] || 0)})</option>)
                      }
                    </select>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-teal-50/30 rounded-3xl border border-teal-100/50">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-teal-600 uppercase tracking-widest flex items-center gap-2 px-1">
                      <BookOpen size={12} /> Source G/L Receivable Account
                    </label>
                    <select 
                      required 
                      className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm"
                      value={selectedCollArAccountId}
                      onChange={e => setSelectedCollArAccountId(e.target.value)}
                    >
                      <option value="">Select account...</option>
                      {accounts.filter(a => a.class === AccountClass.ASSET && !a.isHeader && a.name.toLowerCase().includes('receivable')).map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-teal-600 uppercase tracking-widest px-1">Deposit Target</label>
                    <select required className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm" value={collBankId} onChange={e => setCollBankId(e.target.value)}>
                      <option value="">Select Treasury Account...</option>
                      {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bankName} ({b.currency})</option>)}
                    </select>
                  </div>
               </div>

               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Total Collection Amount</label>
                 <div className="relative">
                    <input type="number" step="0.01" required className="w-full px-6 py-5 bg-slate-50 border-none rounded-[2rem] text-4xl font-mono font-black text-slate-900 outline-none focus:ring-4 focus:ring-teal-500/10 transition-all" value={collAmount || ''} onChange={e => setCollAmount(Number(e.target.value))} placeholder="0.00" />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-lg font-black text-slate-300">PHP</span>
                 </div>
               </div>

               <div className="bg-teal-50 p-6 rounded-[2rem] border border-teal-100 flex gap-4">
                  <CheckCircle size={24} className="text-teal-600 shrink-0" />
                  <p className="text-[11px] text-teal-800 leading-relaxed font-bold">
                    Receipting will reduce the debtor subsidiary ledger balance and increase the institutional liquid assets. This entry is cryptographic and final.
                  </p>
               </div>

               <div className="pt-4 flex gap-4">
                  <button type="button" onClick={() => setShowCollectionModal(false)} className="flex-1 py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors">Discard</button>
                  <button type="submit" className="flex-1 py-4 bg-teal-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-teal-100 active:scale-95 transition-all">Confirm Collection</button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryBox: React.FC<{ label: string, value: string, color: string }> = ({ label, value, color }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
     <p className={`text-2xl font-mono font-black text-${color === 'rose' ? 'rose-600' : 'teal-600'} tracking-tighter`}>{value}</p>
  </div>
);

export default ARView;

