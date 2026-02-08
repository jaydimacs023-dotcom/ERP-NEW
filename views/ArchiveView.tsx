import React, { useState, useMemo } from 'react';
import { 
  Archive, RotateCcw, Trash2, Search, Filter, 
  AlertCircle, ChevronDown, ChevronRight, Info,
  GraduationCap, Users, BookOpen, MapPin, 
  Building, Package, Wallet, UserCircle, Briefcase
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

  // Group all archived items
  const archivedItems = useMemo(() => {
    const items: any[] = [];
    
    // Helper to add archived items
    const collect = (list: any[], type: string, label: string, icon: any) => {
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

  const filteredItems = archivedItems.filter(item => {
    const matchesSearch = item.displayName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'all' || item.archiveType === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [
    { id: 'all', label: 'All Items' },
    { id: 'STUDENT', label: 'Students' },
    { id: 'TRAINER', label: 'Trainers' },
    { id: 'QUALIFICATION', label: 'Qualifications' },
    { id: 'BATCH', label: 'Batches' },
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
            <Archive className="text-teal-600" />
            Archived Records
          </h2>
          <p className="text-sm text-slate-500 font-normal italic mt-1">
            Manage soft-deleted items, restore them, or delete them permanently.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search archived items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeCategory === cat.id 
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-200' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="divide-y divide-slate-100">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <div key={`${item.archiveType}-${item.id}`} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-teal-100 group-hover:text-teal-600 transition-colors">
                    {item.archiveIcon}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{item.displayName}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-teal-500 bg-teal-50 px-2 py-0.5 rounded-full">
                        {item.archiveLabel}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Info size={10} />
                        ID: {item.id.substring(0, 8)}...
                      </span>
                      {item.deletedAt && (
                        <span className="text-[10px] text-slate-400">
                          Archived on {new Date(item.deletedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleAction('restore', item)}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-teal-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  >
                    <RotateCcw size={14} />
                    Restore
                  </button>
                  <button
                    onClick={() => handleAction('delete', item)}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                    Perm Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Archive size={32} className="text-slate-300" />
              </div>
              <h3 className="text-slate-900 font-bold">No archived items found</h3>
              <p className="text-slate-500 text-sm mt-1">Items you soft-delete will appear here for management.</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-2xl">
        <div className="flex gap-3">
          <AlertCircle size={20} className="text-amber-600 shrink-0" />
          <div className="text-sm">
            <p className="font-bold text-amber-900">Archive Policy</p>
            <p className="text-amber-700 mt-1">
              Items that are referenced in active transactions, payroll runs, or accounting entries cannot be archived. 
              Restoring an item will move it back to its original module and make it available for use.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArchiveView;

function Landmark(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="22" x2="21" y2="22" />
      <line x1="6" y1="18" x2="6" y2="11" />
      <line x1="10" y1="18" x2="10" y2="11" />
      <line x1="14" y1="18" x2="14" y2="11" />
      <line x1="18" y1="18" x2="18" y2="11" />
      <polygon points="12 2 20 7 4 7" />
    </svg>
  );
}
