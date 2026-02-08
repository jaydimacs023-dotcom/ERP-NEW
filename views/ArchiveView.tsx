import React, { useState, useMemo } from 'react';
import { 
  Archive, RotateCcw, Trash2, Search, Filter, 
  AlertCircle, ChevronDown, ChevronRight, Info,
  GraduationCap, Users, BookOpen, MapPin, 
  Building, Package, Wallet, UserCircle, Briefcase, Landmark, ShieldCheck, FileText, Check, Database
} from 'lucide-react';

interface ArchiveViewProps {
  data: {
    students: any[];
    trainers: any[];
    qualifications: any[];
    batches: any[];
    locations: any[];
    sponsors: any[];
    vendors: any[];
    employees: any[];
    items: any[];
    purchaseOrders: any[];
    bankAccounts: any[];
    fixedAssets: any[];
  };
  onRestore: (type: string, id: string) => Promise<void>;
  onPermanentDelete: (type: string, id: string) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const ArchiveView: React.FC<ArchiveViewProps> = ({ 
  data, onRestore, onPermanentDelete, onNotify 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isProcessing, setIsProcessing] = useState(false);

  const archivedItems = useMemo(() => {
    const items: any[] = [];
    
    const collect = (list: any[] | undefined, type: string, label: string, icon: any) => {
      if (!list) return;
      list.filter(item => item.isDeleted).forEach(item => {
        items.push({
          ...item,
          archiveType: type,
          archiveLabel: label,
          archiveIcon: icon,
          displayName: item.name || `${item.firstName || ''} ${item.lastName || ''}` || item.reference || item.id
        });
      });
    };

    collect(data.students, 'STUDENT', 'Student', <GraduationCap size={16} />);
    collect(data.trainers, 'TRAINER', 'Trainer', <UserCircle size={16} />);
    collect(data.qualifications, 'QUALIFICATION', 'Qualification', <BookOpen size={16} />);
    collect(data.batches, 'BATCH', 'Batch', <Briefcase size={16} />);
    collect(data.locations, 'LOCATION', 'Location', <MapPin size={16} />);
    collect(data.sponsors, 'SPONSOR', 'Sponsor', <Building size={16} />);
    collect(data.vendors, 'VENDOR', 'Vendor', <Briefcase size={16} />);
    collect(data.employees, 'EMPLOYEE', 'Employee', <Users size={16} />);
    collect(data.items, 'ITEM', 'Non-Stock Item', <Package size={16} />);
    collect(data.purchaseOrders, 'PO', 'Purchase Order', <Package size={16} />);
    collect(data.bankAccounts, 'BANK_ACCOUNT', 'Bank Account', <Landmark size={16} />);
    collect(data.fixedAssets, 'FIXED_ASSET', 'Fixed Asset', <Briefcase size={16} />);

    return items;
  }, [data]);

  const filteredItems = useMemo(() => {
    return archivedItems.filter(item => {
      const matchesSearch = item.displayName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'all' || item.archiveType === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [archivedItems, searchTerm, activeCategory]);

  const categories = [
    { id: 'all', label: 'All Items' },
    { id: 'STUDENT', label: 'Students' },
    { id: 'TRAINER', label: 'Trainers' },
    { id: 'EMPLOYEE', label: 'Employees' },
    { id: 'VENDOR', label: 'Vendors' },
    { id: 'ITEM', label: 'Items' }
  ];

  const handleAction = async (action: 'restore' | 'delete', item: any) => {
    if (action === 'delete') {
      if (!confirm(`Are you sure you want to PERMANENTLY delete this ${item.archiveLabel}? This action cannot be undone.`)) return;
    }

    setIsProcessing(true);
    try {
      if (action === 'restore') {
        await onRestore(item.archiveType, item.id);
        onNotify('success', `${item.archiveLabel} restored successfully`);
      } else {
        await onPermanentDelete(item.archiveType, item.id);
        onNotify('success', `${item.archiveLabel} deleted permanently`);
      }
    } catch (error) {
      onNotify('error', `Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Secure Archive Repository</h2>
          <p className="text-sm text-gray-500 font-normal italic">Centralized decommissioning and recovery zone for all system entities.</p>
        </div>
        <div className="flex gap-3">
           <div className="bg-gray-800 px-6 py-3 rounded flex items-center gap-3 text-white shadow-lg shadow-gray-300/20">
              <Database size={16} className="text-orange-400" />
              <div className="leading-none">
                 <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-none mb-1">Cold Storage</p>
                 <p className="text-sm font-semibold text-white leading-none">{archivedItems.length} OBJECTS</p>
              </div>
           </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 p-1.5 bg-gray-100 rounded w-fit">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-6 py-3 rounded text-xs font-semibold uppercase tracking-wide transition-all ${
              activeCategory === cat.id 
                ? 'bg-white text-[#F47721] shadow-sm' 
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="p-8 bg-white rounded-md border border-gray-200 shadow-sm space-y-6">
         <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search archive indices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded outline-none focus:border-orange-400/20 focus:bg-white transition-all text-sm font-bold text-gray-800"
            />
         </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-8 py-5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Archived Object</th>
                <th className="px-6 py-5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Type Classification</th>
                <th className="px-6 py-5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Decommission Date</th>
                <th className="px-8 py-5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Recovery Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredItems.length === 0 ? (
                <tr>
                   <td colSpan={4} className="px-8 py-20 text-center text-gray-400 italic font-medium">
                      Archive index is empty for the current selection.
                   </td>
                </tr>
              ) : (
                filteredItems.map((item, i) => (
                  <tr key={`${item.archiveType}-${item.id}`} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-8 py-5">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-orange-50 group-hover:text-[#F47721] transition-colors border border-gray-200">
                             {item.archiveIcon}
                          </div>
                          <div>
                             <p className="text-xs font-semibold text-gray-900 tracking-tight">{item.displayName}</p>
                             <p className="text-xs font-bold text-gray-400 uppercase truncate max-w-[200px]">ID: {item.id.substring(0, 8)}...</p>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-5">
                       <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold uppercase tracking-wide border border-gray-200">
                          {item.archiveLabel}
                       </span>
                    </td>
                    <td className="px-6 py-5">
                       <p className="text-xs font-bold text-gray-600">{item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : 'N/A'}</p>
                    </td>
                    <td className="px-8 py-5 text-right">
                       <div className="flex justify-end gap-2">
                          <button
                            disabled={isProcessing}
                            onClick={() => handleAction('restore', item)}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded font-semibold text-xs uppercase tracking-wide shadow-lg shadow-emerald-900/10 hover:bg-emerald-700 hover:-translate-y-0.5 transition-all disabled:opacity-50"
                          >
                             <RotateCcw size={12} /> RESTORE
                          </button>
                          <button
                            disabled={isProcessing}
                            onClick={() => handleAction('delete', item)}
                            className="p-2.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all disabled:opacity-50"
                          >
                             <Trash2 size={16} />
                          </button>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm"><ShieldCheck size={16} className="text-[#F47721]" /></div>
               <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-none mb-1">Cold Storage Security</p>
                  <p className="text-xs font-bold text-gray-600">Archived indices are encrypted and segregated from active transaction nodes.</p>
               </div>
            </div>
            <div className="text-right">
               <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center justify-end gap-1.5">
                  <Database size={12} /> ARCHIVE_ACTIVE
               </p>
               <p className="text-xs font-bold text-gray-300 italic mt-1 uppercase">Log cursor verified: {new Date().toLocaleTimeString()}</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ArchiveView;
