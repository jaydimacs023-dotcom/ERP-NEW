import React, { useState } from 'react';
import { ChartOfAccount, AccountClass, JournalLine, Qualification } from '../types';
import { Plus, ChevronRight, ChevronDown, Edit2, Trash2, FolderPlus, FilePlus, AlertTriangle, ShieldCheck, X, Link, Award } from 'lucide-react';

interface ChartOfAccountsProps {
  accounts: ChartOfAccount[];
  lines: JournalLine[];
  qualifications: Qualification[];
  onAddAccount: (acc: ChartOfAccount) => void;
  onUpdateAccount: (acc: ChartOfAccount) => void;
  onDeleteAccount: (id: string) => void;
}

type ConfirmationState = {
  type: 'deactivate' | 'delete';
  account: ChartOfAccount;
  hasEntries: boolean;
  hasChildren: boolean;
} | null;

const ChartOfAccounts: React.FC<ChartOfAccountsProps> = ({ accounts, lines, qualifications, onAddAccount, onUpdateAccount, onDeleteAccount }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(accounts.filter(a => a.isHeader).map(a => a.id)));
  const [showModal, setShowModal] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState>(null);
  const [selectedParent, setSelectedParent] = useState<string | undefined>(undefined);
  
  const [formData, setFormData] = useState<Partial<ChartOfAccount>>({
    class: AccountClass.ASSET,
    isActive: true,
    isHeader: false,
    qualificationId: ''
  });

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const handleToggleClick = (acc: ChartOfAccount) => {
    if (acc.isActive) {
      setConfirmation({
        type: 'deactivate',
        account: acc,
        hasEntries: lines.some(l => l.accountId === acc.id),
        hasChildren: accounts.some(a => a.parentId === acc.id)
      });
    } else {
      onUpdateAccount({ ...acc, isActive: true });
    }
  };

  const handleDeleteClick = (acc: ChartOfAccount) => {
    setConfirmation({
      type: 'delete',
      account: acc,
      hasEntries: lines.some(l => l.accountId === acc.id),
      hasChildren: accounts.some(a => a.parentId === acc.id)
    });
  };

  const handleEditClick = (acc: ChartOfAccount) => {
    setEditingAccountId(acc.id);
    setSelectedParent(acc.parentId);
    setFormData({
      code: acc.code,
      name: acc.name,
      class: acc.class,
      parentId: acc.parentId,
      isActive: acc.isActive,
      isHeader: acc.isHeader,
      qualificationId: acc.qualificationId || ''
    });
    setShowModal(true);
  };

  const confirmAction = () => {
    if (!confirmation) return;
    if (confirmation.type === 'deactivate') {
      onUpdateAccount({ ...confirmation.account, isActive: false });
    } else {
      onDeleteAccount(confirmation.account.id);
    }
    setConfirmation(null);
  };

  const handleAddClick = (parentId?: string, isHeader: boolean = false) => {
    const parent = accounts.find(a => a.id === parentId);
    setEditingAccountId(null);
    setSelectedParent(parentId);
    setFormData({
      class: parent ? parent.class : AccountClass.ASSET,
      isActive: true,
      isHeader: isHeader,
      parentId: parentId,
      code: '',
      name: '',
      qualificationId: ''
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingAccountId) {
      const existingAccount = accounts.find(a => a.id === editingAccountId);
      if (existingAccount) {
        onUpdateAccount({
          ...existingAccount,
          code: formData.code || '',
          name: formData.name || '',
          class: formData.class as AccountClass,
          qualificationId: formData.qualificationId || undefined
        });
      }
    } else {
      const newAccount: ChartOfAccount = {
        id: `acc-${Date.now()}`,
        orgId: 'temp', 
        code: formData.code || '',
        name: formData.name || '',
        class: formData.class as AccountClass,
        parentId: formData.parentId,
        isActive: true,
        isHeader: formData.isHeader || false,
        qualificationId: formData.qualificationId || undefined
      };
      onAddAccount(newAccount);
    }
    setShowModal(false);
  };

  const getAccountPath = (accId?: string): string[] => {
    if (!accId) return [];
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return [];
    return [...getAccountPath(acc.parentId), acc.name];
  };

  const renderAccountRow = (acc: ChartOfAccount, depth: number = 0) => {
    const children = accounts.filter(a => a.parentId === acc.id);
    const isExpanded = expanded.has(acc.id);
    const hasPostings = lines.some(l => l.accountId === acc.id);
    const linkedQual = qualifications.find(q => q.id === acc.qualificationId);

    return (
      <React.Fragment key={acc.id}>
        <tr className={`hover:bg-slate-50 border-b group transition-all duration-200 ${acc.isHeader ? 'bg-slate-50/40' : 'bg-white'} ${!acc.isActive ? 'bg-slate-50/80 grayscale-[0.5]' : ''}`}>
          <td className={`px-6 py-3 whitespace-nowrap text-sm font-mono ${!acc.isActive ? 'text-slate-400' : 'text-slate-500'}`}>
            {acc.code}
          </td>
          <td className="px-6 py-3 whitespace-nowrap">
            <div className="flex items-center" style={{ paddingLeft: `${depth * 1.5}rem` }}>
              {acc.isHeader ? (
                <button onClick={() => toggleExpand(acc.id)} className="mr-2 text-slate-400 hover:text-teal-600 transition-colors">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              ) : (
                <div className="w-6 mr-2" />
              )}
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${acc.isHeader ? 'font-bold text-slate-900 uppercase tracking-tight' : acc.isActive ? 'text-slate-700 font-medium' : 'text-slate-400 line-through decoration-slate-300'}`}>
                    {acc.name}
                  </span>
                  {linkedQual && (
                    <span className="text-[9px] font-bold bg-amber-50 text-teal-700 border border-amber-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Award size={8} /> {linkedQual.code}
                    </span>
                  )}
                </div>
                {hasPostings && acc.isHeader && (
                  <span className="text-[9px] text-teal-600 font-bold uppercase tracking-tighter">* Legacy Postings Attached</span>
                )}
              </div>
            </div>
          </td>
          <td className="px-6 py-3 whitespace-nowrap">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              !acc.isActive ? 'bg-slate-200 text-slate-500' :
              acc.class === AccountClass.ASSET ? 'bg-teal-100 text-teal-700' :
              acc.class === AccountClass.LIABILITY ? 'bg-rose-100 text-rose-700' :
              acc.class === AccountClass.EQUITY ? 'bg-amber-100 text-teal-700' :
              acc.class === AccountClass.REVENUE ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-700'
            }`}>
              {acc.class}
            </span>
          </td>
          <td className="px-6 py-3 whitespace-nowrap text-center">
             <div className="flex justify-center items-center gap-3">
                <span className={`text-[10px] font-black uppercase tracking-tighter w-12 text-right ${acc.isActive ? 'text-green-600' : 'text-slate-400'}`}>
                  {acc.isActive ? 'Active' : 'Disabled'}
                </span>
                <button 
                  onClick={() => handleToggleClick(acc)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${acc.isActive ? 'bg-teal-600' : 'bg-slate-200'}`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${acc.isActive ? 'translate-x-4' : 'translate-x-0'}`}
                  />
                </button>
             </div>
          </td>
          <td className="px-6 py-3 whitespace-nowrap text-right">
            <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {!acc.isHeader && (
                 <button 
                  onClick={() => handleEditClick(acc)}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-teal-600 rounded-lg transition-colors"
                  title="Edit Account"
                >
                  <Edit2 size={16} />
                </button>
              )}
              {acc.isHeader && (
                <>
                  <button 
                    onClick={() => handleAddClick(acc.id, false)}
                    className="p-1.5 hover:bg-teal-50 text-teal-600 rounded-lg transition-colors"
                    title="Add Sub-account"
                  >
                    <FilePlus size={16} />
                  </button>
                  <button 
                    onClick={() => handleAddClick(acc.id, true)}
                    className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
                    title="Add Folder"
                  >
                    <FolderPlus size={16} />
                  </button>
                  <button 
                    onClick={() => handleEditClick(acc)}
                    className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-teal-600 rounded-lg transition-colors"
                    title="Edit Folder"
                  >
                    <Edit2 size={16} />
                  </button>
                </>
              )}
              <button 
                onClick={() => handleDeleteClick(acc)}
                className="p-1.5 hover:bg-rose-50 text-rose-400 hover:text-rose-600 rounded-lg transition-colors"
                title="Delete Account"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </td>
        </tr>
        {acc.isHeader && isExpanded && children.map(child => renderAccountRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  const topLevel = accounts.filter(a => !a.parentId);
  const parentPath = getAccountPath(selectedParent);
  const isNominal = formData.class === AccountClass.REVENUE || formData.class === AccountClass.EXPENSE;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Chart of Accounts</h2>
          <p className="text-sm text-slate-500 font-medium">Configure your financial reporting hierarchy and manage sub-account availability.</p>
        </div>
        <button 
          onClick={() => handleAddClick(undefined, true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-all shadow-lg shadow-teal-100 font-bold text-sm active:scale-95"
        >
          <Plus size={18} /> New Root Category
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Code</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Account Name</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Class</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-40">Visibility</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {topLevel.length > 0 ? topLevel.map(acc => renderAccountRow(acc)) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No accounts defined for this organization.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      {confirmation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-slate-200">
            <div className={`p-6 flex flex-col items-center text-center ${confirmation.type === 'delete' ? 'bg-rose-50/30' : 'bg-amber-50/30'}`}>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${confirmation.type === 'delete' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-teal-600'}`}>
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {confirmation.type === 'delete' ? 'Confirm Deletion' : 'Confirm Deactivation'}
              </h3>
              <p className="mt-2 text-slate-500 text-sm font-medium px-4">
                You are about to {confirmation.type} 
                <span className="text-slate-900 font-bold block mt-1">
                  [{confirmation.account.code}] {confirmation.account.name}
                </span>
              </p>
            </div>

            <div className="p-8 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className={`shrink-0 ${confirmation.hasEntries ? 'text-rose-500' : 'text-teal-500'}`}>
                    {confirmation.hasEntries ? <X size={20} /> : <ShieldCheck size={20} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-900">Journal Entries</p>
                    <p className="text-[10px] text-slate-500">
                      {confirmation.hasEntries 
                        ? 'This account has linked transactions. Use extreme caution.' 
                        : 'No transactions found for this account.'}
                    </p>
                  </div>
                </div>

                {confirmation.account.isHeader && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className={`shrink-0 ${confirmation.hasChildren ? 'text-rose-500' : 'text-teal-500'}`}>
                      {confirmation.hasChildren ? <X size={20} /> : <ShieldCheck size={20} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-900">Child Accounts</p>
                      <p className="text-[10px] text-slate-500">
                        {confirmation.hasChildren 
                          ? 'This category contains other accounts. Move them first.' 
                          : 'This category is empty.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setConfirmation(null)}
                  className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Go Back
                </button>
                <button 
                  onClick={confirmAction}
                  disabled={confirmation.type === 'delete' && (confirmation.hasEntries || confirmation.hasChildren)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition-all ${
                    confirmation.type === 'delete' 
                      ? (confirmation.hasEntries || confirmation.hasChildren ? 'bg-slate-300 shadow-none cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100') 
                      : 'bg-teal-600 hover:bg-teal-700 shadow-teal-100'
                  }`}
                >
                  {confirmation.type === 'delete' ? 'Delete Permanently' : 'Deactivate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Account Modal (Add/Edit) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-black text-slate-900 uppercase">
                {editingAccountId ? 'Edit' : 'New'} {formData.isHeader ? 'Category' : 'Sub-Account'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Link size={12} /> Hierarchical Path
                </label>
                <div className="flex flex-wrap items-center gap-1 text-[10px] font-bold text-teal-600 bg-teal-50 p-2 rounded-lg border border-teal-100">
                  <span>Root</span>
                  {parentPath.map((p, i) => (
                    <React.Fragment key={i}>
                      <ChevronRight size={10} className="text-teal-300" />
                      <span className="truncate max-w-[120px]">{p}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Account Code</label>
                  <input 
                    required 
                    placeholder="1000"
                    className="w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-teal-600 outline-none font-mono text-sm"
                    value={formData.code || ''}
                    onChange={e => setFormData({...formData, code: e.target.value})}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Name</label>
                  <input 
                    required 
                    placeholder="e.g. Savings - Main"
                    className="w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-medium"
                    value={formData.name || ''}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Financial Classification</label>
                <select 
                  className="w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-teal-600 outline-none text-sm appearance-none bg-white"
                  value={formData.class}
                  onChange={e => setFormData({...formData, class: e.target.value as AccountClass})}
                >
                  {Object.values(AccountClass).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {isNominal && !formData.isHeader && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Award size={12} /> Link to Qualification
                  </label>
                  <select 
                    className="w-full px-3 py-2.5 border border-teal-100 bg-teal-50/30 rounded-xl focus:ring-2 focus:ring-teal-600 outline-none text-sm appearance-none"
                    value={formData.qualificationId}
                    onChange={e => setFormData({...formData, qualificationId: e.target.value})}
                  >
                    <option value="">No Specific Qualification (General)</option>
                    {qualifications.map(q => (
                      <option key={q.id} value={q.id}>[{q.code}] {q.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 italic">Assigning a qualification allows for granular filtering in Profit & Loss reports.</p>
                </div>
              )}

              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Discard</button>
                <button type="submit" className="flex-1 py-3 bg-teal-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-100 active:scale-95 transition-all">
                  {editingAccountId ? 'Update Account' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartOfAccounts;
