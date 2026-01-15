
import React, { useState, useMemo } from 'react';
import { Sponsor, Student, JournalEntry, JournalEntryLine, NonStockItem, ChartOfAccount, AccountClass, TaxCategory, WHTCategory, BankAccount } from '../types';
import { 
  FileText, Plus, Search, Filter, Mail, CheckCircle, Clock, 
  MoreVertical, CreditCard, ChevronRight, X, User, Handshake, 
  Trash2, AlertCircle, Save, CheckCircle2, Link as LinkIcon,
  BookOpen, Calculator, Percent, History, Calendar, BarChart3,
  Download, Printer, Landmark, Wallet, Receipt
} from 'lucide-react';

interface ARViewProps {
  entries: JournalEntry[];
  lines: JournalEntryLine[];
  students: Student[];
  sponsors: Sponsor[];
  items: NonStockItem[];
  accounts: ChartOfAccount[];
  bankAccounts: BankAccount[];
  onPostInvoice: (entry: Partial<JournalEntry>, lines: JournalEntryLine[]) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

type ARTab = 'invoices' | 'collections' | 'aging';

const ARView: React.FC<ARViewProps> = ({ 
  entries, lines, students, sponsors, items, accounts, bankAccounts, onPostInvoice, onNotify 
}) => {
  const [activeTab, setActiveTab] = useState<ARTab>('invoices');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [agingAsOf, setAgingAsOf] = useState(new Date().toISOString().split('T')[0]);

  // Invoice Form State
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceRef, setInvoiceRef] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [recipientType, setRecipientType] = useState<'STUDENT' | 'SPONSOR'>('SPONSOR');
  const [recipientId, setRecipientId] = useState('');
  const [invoiceLines, setInvoiceLines] = useState<{ itemId: string, qty: number, price: number }[]>([
    { itemId: '', qty: 1, price: 0 }
  ]);

  // Collection Form State
  const [collDate, setCollDate] = useState(new Date().toISOString().split('T')[0]);
  const [collRef, setCollRef] = useState(`OR-${Date.now().toString().slice(-6)}`);
  const [collPayerType, setCollPayerType] = useState<'STUDENT' | 'SPONSOR'>('SPONSOR');
  const [collPayerId, setCollPayerId] = useState('');
  const [collAmount, setCollAmount] = useState<number>(0);
  const [collBankId, setCollBankId] = useState('');

  const arInvoices = entries.filter(e => e.sourceType === 'INVOICE' && e.status !== 'REVERSED');
  const arCollections = entries.filter(e => e.sourceType === 'COLLECTION' && e.status !== 'REVERSED');
  
  const subsidiaryBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    const arAccounts = new Set(accounts.filter(a => a.class === AccountClass.ASSET && a.name.toLowerCase().includes('receivable')).map(a => a.id));
    lines.forEach(l => {
      if (l.contactId && arAccounts.has(l.accountId)) {
        balances[l.contactId] = (balances[l.contactId] || 0) + (l.debit - l.credit);
      }
    });
    return balances;
  }, [lines, accounts]);

  const totalReceivables = (Object.values(subsidiaryBalances) as number[]).reduce((s, b) => s + b, 0);

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
    const targetEntries = entries.filter(e => e.date <= agingAsOf && e.status !== 'REVERSED');
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

  const vatableSales = useMemo(() => invoiceLines.reduce((sum, l) => {
    const item = items.find(i => i.id === l.itemId);
    return (item?.taxCategory === TaxCategory.VAT) ? sum + (l.qty * l.price) : sum;
  }, 0), [invoiceLines, items]);
  const totalVat = vatableSales * 0.12;
  const grossInvoiceAmount = invoiceLines.reduce((sum, l) => sum + (l.qty * l.price), 0) + totalVat;

  const handlePostInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId) return onNotify('error', 'Validation Error: Learner or Sponsor recipient must be defined.');
    if (grossInvoiceAmount <= 0) return onNotify('error', 'Validation Error: Invoice amount must be greater than zero.');
    
    const entryId = `je-inv-${Date.now()}`;
    const arAccountId = recipientType === 'SPONSOR' ? sponsors.find(s => s.id === recipientId)?.arAccountId : accounts.find(a => a.code === '1200')?.id;
    const vatPayableId = accounts.find(a => a.code === '2200')?.id;
    
    if (!arAccountId || !vatPayableId) return onNotify('error', 'Accounting Framework Error: Targeted G/L accounts for Receivables or VAT Payable are missing.');

    const finalizedLines: JournalEntryLine[] = [];
    finalizedLines.push({ id: `l-ar-${Date.now()}`, journalEntryId: entryId, accountId: arAccountId, debit: grossInvoiceAmount, credit: 0, contactId: recipientId, contactType: recipientType });
    invoiceLines.forEach((il, idx) => {
      const item = items.find(i => i.id === il.itemId);
      if (item) finalizedLines.push({ id: `l-rev-${idx}-${Date.now()}`, journalEntryId: entryId, accountId: item.defaultAccountId, debit: 0, credit: il.qty * il.price, contactId: recipientId, contactType: recipientType, itemId: il.itemId });
    });
    if (totalVat > 0) finalizedLines.push({ id: `l-vat-${Date.now()}`, journalEntryId: entryId, accountId: vatPayableId, debit: 0, credit: totalVat, contactId: recipientId, contactType: recipientType });

    onPostInvoice({ id: entryId, date: invoiceDate, reference: invoiceRef, description: `Sales Invoice: ${recipientType === 'SPONSOR' ? sponsors.find(s => s.id === recipientId)?.name : students.find(s => s.id === recipientId)?.lastName}`, sourceType: 'INVOICE', status: 'POSTED' }, finalizedLines);
    setShowInvoiceModal(false);
  };

  const handlePostCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collPayerId) return onNotify('error', 'Validation Error: Payer entity selection is required.');
    if (collAmount <= 0) return onNotify('error', 'Validation Error: Collection amount must exceed zero.');
    if (!collBankId) return onNotify('error', 'Configuration Error: Specify the deposit destination account.');
    
    const entryId = `je-coll-${Date.now()}`;
    const bank = bankAccounts.find(b => b.id === collBankId);
    const arAccountId = collPayerType === 'SPONSOR' ? sponsors.find(s => s.id === collPayerId)?.arAccountId : accounts.find(a => a.code === '1200')?.id;
    
    if (!bank || !arAccountId) return onNotify('error', "Accounting Resolution Error: G/L accounts for treasury or receivables not found.");
    const payerName = collPayerType === 'SPONSOR' ? sponsors.find(s => s.id === collPayerId)?.name : `${students.find(s => s.id === collPayerId)?.lastName}, ${students.find(s => s.id === collPayerId)?.firstName}`;

    const finalizedLines: JournalEntryLine[] = [
      { id: `l-cash-${Date.now()}`, journalEntryId: entryId, accountId: bank.glAccountId, debit: collAmount, credit: 0, memo: `Collection ${collRef} from ${payerName}`, contactId: collPayerId, contactType: collPayerType },
      { id: `l-ar-cr-${Date.now()}`, journalEntryId: entryId, accountId: arAccountId, debit: 0, credit: collAmount, memo: `Collection ${collRef} from ${payerName}`, contactId: collPayerId, contactType: collPayerType }
    ];

    onPostInvoice({ id: entryId, date: collDate, reference: collRef, description: `Collection Payment: ${payerName}`, sourceType: 'COLLECTION', status: 'POSTED' }, finalizedLines);
    setShowCollectionModal(false);
    setCollAmount(0);
    setCollRef(`OR-${Date.now().toString().slice(-6)}`);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Receivables & Revenue Cycle</h2>
          <p className="text-sm text-slate-500 font-normal italic">Monitor institutional cash inflows and analyzed aging debt buckets.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
           <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
             <button onClick={() => setActiveTab('invoices')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'invoices' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <FileText size={14} className="inline mr-1.5" /> Invoices
             </button>
             <button onClick={() => setActiveTab('collections')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'collections' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <Receipt size={14} className="inline mr-1.5" /> Collections
             </button>
             <button onClick={() => setActiveTab('aging')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'aging' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <BarChart3 size={14} className="inline mr-1.5" /> Aging Report
             </button>
           </div>
           <button onClick={() => { setCollRef(`OR-${Date.now().toString().slice(-6)}`); setShowCollectionModal(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-md font-bold text-sm active:scale-95"><Landmark size={18} /> Collect Payment</button>
           <button onClick={() => { setInvoiceRef(`INV-${Date.now().toString().slice(-6)}`); setShowInvoiceModal(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md font-bold text-sm active:scale-95"><Plus size={18} /> New Invoice</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryBox label="Gross Receivables" value={formatCurrency(totalReceivables)} color="indigo" />
        <SummaryBox label="Collections (MTD)" value={formatCurrency(arCollections.filter(c => c.date.startsWith(new Date().toISOString().slice(0, 7))).reduce((s: number, c) => {
          const l = lines.find(line => line.journalEntryId === c.id && line.debit > 0);
          return s + (l?.debit || 0);
        }, 0))} color="emerald" />
        <SummaryBox label="Output VAT Due" value="0.00" color="amber" />
        <SummaryBox label="Collection Efficiency" value="84%" color="slate" />
      </div>

      {activeTab === 'invoices' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input placeholder="Find invoice by ref or customer..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none w-72 focus:ring-1 focus:ring-indigo-600" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                    <td className="px-6 py-5 text-xs font-mono font-bold text-indigo-600">{inv.reference}</td>
                    <td className="px-6 py-5 text-xs text-slate-600">{inv.date}</td>
                    <td className="px-6 py-5 text-right font-mono font-bold text-slate-900">{formatCurrency(arLine?.debit || 0)}</td>
                    <td className="px-6 py-5 text-center"><span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-bold uppercase rounded-full border border-blue-100">Issued</span></td>
                    <td className="px-6 py-5 text-right"><button className="p-2 hover:bg-slate-100 rounded-lg text-slate-300 transition-colors"><MoreVertical size={16} /></button></td>
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
              <input placeholder="Find by OR# or Payer..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none w-72 focus:ring-1 focus:ring-indigo-600" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle size={14} /></div>
                      <div className="text-sm font-bold text-slate-800">{coll.description.split(': ')[1]}</div>
                    </td>
                    <td className="px-6 py-5 text-xs font-mono font-bold text-indigo-600">{coll.reference}</td>
                    <td className="px-6 py-5 text-xs text-slate-600">{coll.date}</td>
                    <td className="px-6 py-5 text-right font-mono font-bold text-emerald-600">{formatCurrency(cashLine?.debit || 0)}</td>
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
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Calendar size={20} /></div>
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
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-6 py-5 text-sm font-bold text-slate-800">{row.name}</td>
                    <td className="px-6 py-5 text-right font-mono text-xs text-emerald-600">{formatCurrency(row.current)}</td>
                    <td className="px-6 py-5 text-right font-mono text-xs text-amber-600">{formatCurrency(row.thirty)}</td>
                    <td className="px-6 py-5 text-right font-mono text-xs text-orange-600">{formatCurrency(row.sixty)}</td>
                    <td className="px-6 py-5 text-right font-mono text-xs text-rose-600 font-bold">{formatCurrency(row.ninety)}</td>
                    <td className="px-6 py-5 text-right font-mono text-sm text-slate-900 font-black">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Collection Modal */}
      {showCollectionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90] overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-md"><Receipt size={20} /></div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Record Official Collection</h3>
              </div>
              <button onClick={() => setShowCollectionModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            <form onSubmit={handlePostCollection} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Collection Date</label><input type="date" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" value={collDate} onChange={e => setCollDate(e.target.value)} /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">OR # / Ref Code</label><input required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-black text-indigo-600" value={collRef} onChange={e => setCollRef(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payer Type</label><select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" value={collPayerType} onChange={e => { setCollPayerType(e.target.value as any); setCollPayerId(''); }}><option value="SPONSOR">Sponsor</option><option value="STUDENT">Student</option></select></div>
                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Payer</label><select required className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-indigo-700" value={collPayerId} onChange={e => setCollPayerId(e.target.value)}><option value="">Choose Payer...</option>{collPayerType === 'SPONSOR' ? sponsors.map(s => <option key={s.id} value={s.id}>{s.name} (Bal: {formatCurrency(subsidiaryBalances[s.id] || 0)})</option>) : students.map(s => <option key={s.id} value={s.id}>{s.lastName}, {s.firstName} (Bal: {formatCurrency(subsidiaryBalances[s.id] || 0)})</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deposit To</label><select required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" value={collBankId} onChange={e => setCollBankId(e.target.value)}><option value="">Select Account...</option>{bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bankName}</option>)}</select></div>
                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount Received</label><input type="number" step="0.01" required className="w-full px-4 py-2.5 bg-white border border-emerald-200 rounded-xl text-lg font-mono font-black text-emerald-600 outline-none" value={collAmount || ''} onChange={e => setCollAmount(Number(e.target.value))} placeholder="0.00" /></div>
              </div>
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3"><AlertCircle className="text-amber-600 shrink-0" size={20} /><p className="text-[11px] text-amber-800 leading-relaxed font-medium">This collection will reduce the outstanding Accounts Receivable for the selected entity and increase the Book Balance of the selected cash/bank account.</p></div>
              <div className="pt-6 flex gap-3"><button type="button" onClick={() => setShowCollectionModal(false)} className="flex-1 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-2xl">Discard</button><button type="submit" disabled={collAmount <= 0 || !collPayerId || !collBankId} className="flex-1 py-3.5 bg-emerald-600 text-white rounded-2xl text-sm font-black shadow-lg">Post Official Receipt</button></div>
            </form>
          </div>
        </div>
      )}

      {/* New Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90] overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md"><FileText size={20} /></div>
                <h3 className="text-xl font-semibold text-slate-800 uppercase tracking-tight">Generate PH-Compliant Invoice</h3>
              </div>
              <button onClick={() => setShowInvoiceModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handlePostInvoice} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="space-y-1.5"><label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Invoice Date</label><input type="date" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Reference #</label><input required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold" value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Type</label><select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={recipientType} onChange={e => { setRecipientType(e.target.value as any); setRecipientId(''); }}><option value="SPONSOR">Sponsor</option><option value="STUDENT">Learner</option></select></div>
                <div className="space-y-1.5"><label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Select Customer</label><select required className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-indigo-700 appearance-none" value={recipientId} onChange={e => setRecipientId(e.target.value)}><option value="">Choose...</option>{recipientType === 'SPONSOR' ? sponsors.map(s => <option key={s.id} value={s.id}>{s.name}</option>) : students.map(s => <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>)}</select></div>
              </div>
              <div className="space-y-4 mb-8">
                {invoiceLines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-center p-3 bg-white rounded-2xl border border-slate-100">
                    <div className="col-span-5"><select required className="w-full px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold" value={line.itemId} onChange={e => updateInvoiceLine(idx, { itemId: e.target.value })}><option value="">Select Item...</option>{items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
                    <div className="col-span-2"><input type="number" min="1" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm font-bold" value={line.qty} onChange={e => updateInvoiceLine(idx, { qty: Number(e.target.value) })} /></div>
                    <div className="col-span-2"><input type="number" step="0.01" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-right text-xs font-mono" value={line.price} onChange={e => updateInvoiceLine(idx, { price: Number(e.target.value) })} /></div>
                    <div className="col-span-2 text-right font-mono text-sm font-bold">{formatCurrency(line.qty * line.price)}</div>
                    <div className="col-span-1 text-center"><button type="button" onClick={() => handleRemoveInvoiceLine(idx)}><Trash2 size={16} className="text-slate-300" /></button></div>
                  </div>
                ))}
                <button type="button" onClick={handleAddInvoiceLine} className="text-xs font-bold text-indigo-600">+ Add Row</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8 bg-slate-50 rounded-3xl border border-slate-200">
                <div className="space-y-2"><SummaryRow label="VAT (12%)" value={totalVat} isHighlighted /><SummaryRow label="Gross Amount" value={grossInvoiceAmount} isBig /></div>
                <div className="flex flex-col justify-end gap-3 md:col-start-3"><button type="button" onClick={() => setShowInvoiceModal(false)} className="py-3 text-sm font-bold text-slate-500">Discard</button><button type="submit" className="py-3 bg-indigo-600 text-white rounded-2xl text-sm font-black shadow-lg">Post Invoice</button></div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryRow: React.FC<{ label: string, value: number, isHighlighted?: boolean, isBig?: boolean }> = ({ label, value, isHighlighted, isBig }) => (
  <div className="flex justify-between items-center">
     <span className={`text-[11px] font-medium ${isHighlighted ? 'text-indigo-700' : 'text-slate-500'}`}>{label}</span>
     <span className={`font-mono font-bold ${isBig ? 'text-lg text-slate-900' : isHighlighted ? 'text-indigo-700 text-xs' : 'text-slate-700 text-xs'}`}>
        {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}
     </span>
  </div>
);

const SummaryBox: React.FC<{ label: string, value: string, color: string }> = ({ label, value, color }) => (
  <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
     <p className={`text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1`}>{label}</p>
     <p className={`text-xl font-mono font-bold text-${color === 'emerald' ? 'emerald-600' : color === 'rose' ? 'rose-600' : color === 'indigo' ? 'indigo-600' : 'amber-600'}`}>{value}</p>
  </div>
);

export default ARView;
