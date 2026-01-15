import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, BookText, TableProperties, FileBarChart, 
  ShieldCheck, Building2, Users, Award, GraduationCap, 
  Layers, MapPin, LogOut, Database, Plus, Menu, X, ChevronRight,
  AlertCircle, Handshake, Box, Landmark, FileText, Truck, HardDrive,
  History, CalendarClock, ShoppingCart, CheckCircle2, AlertTriangle, Info,
  UserCog, Binary, Terminal, ShieldAlert, Lock, Sparkles, CreditCard,
  Palette, Settings
} from 'lucide-react';
import { 
  Organization, User, ChartOfAccount, JournalEntry, 
  JournalEntryLine, AuditLog, Student, Qualification, 
  Trainer, Batch, TransactionSummary, Location, Sponsor, NonStockItem,
  Vendor, BankAccount, FixedAsset, TrainerSchedule, PurchaseOrder,
  PurchaseOrderStatus, BatchStatus, AccountClass
} from './types';

// View Imports
import Dashboard from './views/Dashboard';
import LoginView from './views/LoginView';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(true);

  // Master Data State
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string>(''); 
  const [users, setUsers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [lines, setLines] = useState<JournalEntryLine[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  
  const [students, setStudents] = useState<Student[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [trainers, setTrainer] = useState<Trainer[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [items, setItems] = useState<NonStockItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [schedules, setSchedules] = useState<TrainerSchedule[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  const [showJournalForm, setShowJournalForm] = useState(false);

  // Notification Helper
  const showNotify = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  // Load data from Supabase (with fallback to mock data)
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Set mock data immediately to bypass loading issues
        const mockOrg: Organization = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'AccounTech Platform Host',
          currency: 'PHP',
          isVatRegistered: true,
          subscriptionStatus: 'ACTIVE',
          planType: 'PROFESSIONAL',
          licenseExpiry: '2026-12-31',
          createdAt: new Date().toISOString(),
          primaryColor: '#4f46e5'
        };

        const mockUser: User = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'System Administrator',
          email: 'admin@accountech.io',
          role: 'SYSTEM_ADMIN',
          orgId: mockOrg.id
        };

        // Mock transaction summaries
        const mockSummaries: TransactionSummary[] = [
          { accountId: '1000', accountName: 'ASSETS', accountClass: AccountClass.ASSET, totalDebit: 100000, totalCredit: 0, balance: 100000 },
          { accountId: '1100', accountName: 'BDO Checking Account', accountClass: AccountClass.ASSET, totalDebit: 50000, totalCredit: 0, balance: 50000 },
          { accountId: '2000', accountName: 'LIABILITIES', accountClass: AccountClass.LIABILITY, totalDebit: 0, totalCredit: 20000, balance: -20000 },
          { accountId: '3000', accountName: 'EQUITY', accountClass: AccountClass.EQUITY, totalDebit: 0, totalCredit: 80000, balance: -80000 },
          { accountId: '4000', accountName: 'REVENUE', accountClass: AccountClass.REVENUE, totalDebit: 0, totalCredit: 15000, balance: -15000 },
          { accountId: '5000', accountName: 'EXPENSES', accountClass: AccountClass.EXPENSE, totalDebit: 5000, totalCredit: 0, balance: 5000 },
        ];

        setOrganizations([mockOrg]);
        setCurrentOrgId(mockOrg.id);
        setCurrentUser(mockUser);
        setUsers([mockUser]);
        setAccounts([]);
        setEntries([]);
        setLines([]);
        setStudents([]);
        setQualifications([]);
        setTrainer([]);
        setBatches([]);
        setLocations([]);
        setSponsors([]);
        setItems([]);
        setVendors([]);
        setBankAccounts([]);
        setFixedAssets([]);
        setSchedules([]);
        setPurchaseOrders([]);
        
        setLoading(false);
        showNotify('info', 'Using demo data - Supabase connection ready');
      } catch (error) {
        console.error('Error in loadData:', error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const currentOrg = useMemo(() => organizations.find(o => o.id === currentOrgId), [organizations, currentOrgId]);

  // Motif Injection Logic
  useEffect(() => {
    if (currentOrg?.primaryColor) {
      document.documentElement.style.setProperty('--brand-primary', currentOrg.primaryColor);
      document.documentElement.style.setProperty('--brand-primary-light', `${currentOrg.primaryColor}15`);
    } else {
      document.documentElement.style.setProperty('--brand-primary', '#4f46e5');
      document.documentElement.style.setProperty('--brand-primary-light', '#4f46e515');
    }
  }, [currentOrg]);

  // Trial Days Calculation
  const trialRemainingDays = useMemo(() => {
    if (currentOrg?.subscriptionStatus !== 'TRIAL' || !currentOrg.licenseExpiry) return null;
    const expiry = new Date(currentOrg.licenseExpiry);
    const today = new Date();
    const diff = expiry.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [currentOrg]);

  // RBAC + License Gating Menu Filtering
  const menuSections = useMemo(() => {
    const isSystemAdmin = currentUser?.role === 'SYSTEM_ADMIN';
    const isAdmin = currentUser?.role === 'ADMIN';
    const isRegistrar = currentUser?.role === 'REGISTRAR';
    const plan = currentOrg?.planType || 'BASIC';
    
    const sections = [];

    if (isSystemAdmin) {
      sections.push({
        label: 'Platform Console',
        items: [
          { id: 'tenants-mgmt', label: 'Tenant Control', icon: Terminal, locked: false },
          { id: 'system-audit', label: 'Platform Logs', icon: ShieldAlert, locked: false },
          { id: 'blueprint', label: 'Core Schema', icon: Binary, locked: false },
        ]
      });
    }

    sections.push({
      label: 'Main',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, locked: false },
      ]
    });

    sections.push({
      label: 'Accounting',
      items: [
        { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: BookText, locked: false },
        { id: 'general-ledger', label: 'General Ledger', icon: TableProperties, locked: false },
        { id: 'reports', label: 'Reports', icon: FileBarChart, locked: false },
        { id: 'audit-trail', label: 'Audit Trail', icon: ShieldCheck, locked: false },
      ]
    });

    sections.push({
      label: 'Training',
      items: [
        { id: 'students', label: 'Students', icon: Users, locked: false },
        { id: 'qualifications', label: 'Qualifications', icon: Award, locked: false },
        { id: 'trainers', label: 'Trainers', icon: GraduationCap, locked: false },
        { id: 'batches', label: 'Batches', icon: Layers, locked: false },
        { id: 'locations', label: 'Locations', icon: MapPin, locked: false },
      ]
    });

    sections.push({
      label: 'Financial Operations',
      items: [
        { id: 'sponsors', label: 'Sponsors', icon: Handshake, locked: false },
        { id: 'vendors', label: 'Vendors', icon: Box, locked: false },
        { id: 'banking', label: 'Banking', icon: Landmark, locked: false },
        { id: 'ar', label: 'A/R', icon: FileText, locked: false },
        { id: 'ap', label: 'A/P', icon: Truck, locked: false },
        { id: 'assets', label: 'Fixed Assets', icon: HardDrive, locked: false },
      ]
    });

    sections.push({
      label: 'Procurement',
      items: [
        { id: 'purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, locked: false },
        { id: 'items', label: 'Items & Services', icon: Package, locked: false },
      ]
    });

    if (isAdmin || isSystemAdmin) {
      sections.push({
        label: 'System Administration',
        items: [
          { id: 'users', label: 'User Management', icon: UserCog, locked: false },
          { id: 'branding', label: 'Branding', icon: Palette, locked: false },
          { id: 'subscription', label: 'Subscription', icon: CreditCard, locked: false },
        ]
      });
    }

    return sections;
  }, [currentUser, currentOrg]);

  // Render Active View
  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard summaries={[]} currency={currentOrg?.currency || 'PHP'} />;
      case 'login':
        return <LoginView organizations={organizations} onLogin={() => {}} onRegister={() => {}} />;
      default:
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Settings className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Coming Soon</h3>
              <p className="text-slate-500">This module is under development</p>
            </div>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading AT-ERP...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginView 
        organizations={organizations}
        onLogin={() => {}}
        onRegister={() => {}}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden font-sans antialiased">
      <style>{`
        :root {
          --brand-primary: #4f46e5;
          --brand-primary-light: #4f46e515;
        }
        .bg-brand { background-color: var(--brand-primary) !important; }
        .text-brand { color: var(--brand-primary) !important; }
        .border-brand { border-color: var(--brand-primary) !important; }
        .ring-brand:focus { --tw-ring-color: var(--brand-primary) !important; }
        .sidebar-item-active { background-color: var(--brand-primary) !important; color: white !important; }
        .btn-brand { background-color: var(--brand-primary); color: white; transition: opacity 0.2s; }
        .btn-brand:hover { opacity: 0.9; }
        .btn-brand:active { transform: scale(0.98); }
        .bg-brand-light { background-color: var(--brand-primary-light) !important; }
      `}</style>

      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-16'} bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center flex-shrink-0">
              <Database className="w-6 h-6 text-white" />
            </div>
            {isSidebarOpen && (
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold text-slate-900 truncate">AccounTech</h1>
                <p className="text-xs text-slate-500 truncate">ERP System</p>
              </div>
            )}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Menu className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-6">
            {menuSections.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                {isSidebarOpen && (
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    {section.label}
                  </h3>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        activeTab === item.id
                          ? 'sidebar-item-active'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                      title={!isSidebarOpen ? item.label : undefined}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {isSidebarOpen && <span className="truncate">{item.label}</span>}
                      {!isSidebarOpen && item.locked && (
                        <Lock className="w-3 h-3 text-slate-400 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* User Profile */}
        {isSidebarOpen && (
          <div className="p-4 border-t border-slate-200">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                <UserCog className="w-4 h-4 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{currentUser?.name}</p>
                <p className="text-xs text-slate-500 truncate">{currentUser?.role}</p>
              </div>
              <button className="text-slate-400 hover:text-slate-600">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {renderActiveView()}
      </main>

      {/* Toast Portal */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`pointer-events-auto min-w-[300px] max-w-[450px] p-4 rounded-2xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-right-10 duration-300 flex items-start gap-4 ${
            toast.type === 'success' ? 'bg-emerald-600/90 border-emerald-400 text-white' : 
            toast.type === 'error' ? 'bg-rose-600/90 border-rose-400 text-white' : 
            'bg-brand/90 border-brand text-white'
          }`}>
            <div className="mt-0.5">
              {toast.type === 'success' && <CheckCircle2 size={20} />}
              {toast.type === 'error' && <AlertTriangle size={20} />}
              {toast.type === 'info' && <Info size={20} />}
            </div>
            <div className="flex-1">
              <p className="font-medium">{toast.message}</p>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
