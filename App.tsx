
import React, { useState, useMemo } from 'react';
import { 
  Organization, User, Student, Qualification, Trainer, Batch, Sponsor, NonStockItem, Vendor, FixedAsset, BankAccount, Location, TrainerSchedule, Employee, PayrollRun, PayrollLine, JournalEntry, JournalEntryLine, AuditLog, Budget, BudgetLine, AccountClass, TransactionSummary, ChartOfAccount, PurchaseOrder, PurchaseOrderStatus
} from './types';
import { INITIAL_ORGS, INITIAL_USERS, INITIAL_COA, INITIAL_VENDORS, INITIAL_BANK_ACCOUNTS, INITIAL_STUDENTS, INITIAL_EMPLOYEES, INITIAL_SPONSORS, INITIAL_ITEMS, INITIAL_QUALIFICATIONS, INITIAL_TRAINERS, INITIAL_SCHEDULES, INITIAL_BATCHES, INITIAL_LOCATIONS } from './db';
import { AccountingService } from './accountingService';

// View Imports
import Dashboard from './views/Dashboard';
import Ledger from './views/Ledger';
import Reports from './views/Reports';
import ChartOfAccounts from './views/ChartOfAccounts';
import OrganizationsView from './views/OrganizationsView';
import LoginView from './views/LoginView';
import StudentsView from './views/StudentsView';
import QualificationsView from './views/QualificationsView';
import TrainersView from './views/TrainersView';
import BatchesView from './views/BatchesView';
import LocationsView from './views/LocationsView';
import SponsorsView from './views/SponsorsView';
import ItemsView from './views/ItemsView';
import BankingView from './views/BankingView';
import AssetsView from './views/AssetsView';
import APView from './views/APView';
import ARView from './views/ARView';
import VendorsView from './views/VendorsView';
import SchedulesView from './views/SchedulesView';
import PurchaseOrdersView from './views/PurchaseOrdersView';
import AuditTrail from './views/AuditTrail';
import UsersManagementView from './views/UsersManagementView';
import SchemaManualView from './views/SchemaManualView';
import TenantManagementView from './views/TenantManagementView';
import BrandingView from './views/BrandingView';
import SubscriptionView from './views/SubscriptionView';
import StudentPortalView from './views/StudentPortalView';
import TrainerPortalView from './views/TrainerPortalView';
import BudgetView from './views/BudgetView';
import EmployeesView from './views/EmployeesView';
import PayrollView from './views/PayrollView';
import JournalForm from './components/JournalForm';
import MaintenanceView from './views/MaintenanceView';

// Lucide Icons
import { 
  LayoutDashboard, BookText, PieChart, Landmark, Users, 
  Award, GraduationCap, Layers, MapPin, Handshake, 
  Truck, Box, CalendarClock, ShoppingCart, ShieldCheck, 
  History, UserCog, Settings, Palette, CreditCard, 
  Binary, Terminal, Receipt, Calculator, Briefcase, 
  LogOut, Menu, X, PlusCircle, Building2, Wrench,
  FileText, Tag, Wallet, Activity
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>(INITIAL_ORGS);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [currentOrgId, setCurrentOrgId] = useState<string>('org-3');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Master Data State
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [qualifications, setQualifications] = useState<Qualification[]>(INITIAL_QUALIFICATIONS);
  const [trainers, setTrainers] = useState<Trainer[]>(INITIAL_TRAINERS);
  const [batches, setBatches] = useState<Batch[]>(INITIAL_BATCHES);
  const [sponsors, setSponsors] = useState<Sponsor[]>(INITIAL_SPONSORS);
  const [items, setItems] = useState<NonStockItem[]>(INITIAL_ITEMS);
  const [vendors, setVendors] = useState<Vendor[]>(INITIAL_VENDORS);
  const [locations, setLocations] = useState<Location[]>(INITIAL_LOCATIONS);
  const [schedules, setSchedules] = useState<TrainerSchedule[]>(INITIAL_SCHEDULES);
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(INITIAL_BANK_ACCOUNTS);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>(INITIAL_COA);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  // Financial Cycle State
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalLines, setJournalLines] = useState<JournalEntryLine[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [payrollLines, setPayrollLines] = useState<PayrollLine[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Modals
  const [showJournalForm, setShowJournalForm] = useState(false);

  // Derived Accounting Context
  const currentOrg = organizations.find(o => o.id === currentOrgId);
  const brandColor = currentOrg?.primaryColor || '#4f46e5';

  const filteredAccounts = useMemo(() => accounts.filter(a => a.orgId === currentOrgId && !a.isDeleted), [accounts, currentOrgId]);
  const activeJournalEntries = useMemo(() => journalEntries.filter(e => e.orgId === currentOrgId && !e.isDeleted), [journalEntries, currentOrgId]);
  const activeEntryIds = useMemo(() => new Set(activeJournalEntries.map(e => e.id)), [activeJournalEntries]);
  const filteredLines = useMemo(() => journalLines.filter(l => activeEntryIds.has(l.journalEntryId)), [journalLines, activeEntryIds]);
  const summaries = useMemo(() => AccountingService.getLedgerSummaries(filteredAccounts, filteredLines), [filteredAccounts, filteredLines]);

  // RBAC Controls
  const isSysAdmin = currentUser?.role === 'SYSTEM_ADMIN';
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'PRESIDENT' || isSysAdmin;
  const isFinance = ['ACCOUNTANT', 'FINANCE_MANAGER', 'AR_SPECIALIST', 'AP_SPECIALIST', 'ADMIN', 'PRESIDENT'].includes(currentUser?.role || '');
  const isRegistrar = ['REGISTRAR', 'ADMIN'].includes(currentUser?.role || '');
  const isAR = ['AR_SPECIALIST', 'ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN', 'PRESIDENT'].includes(currentUser?.role || '');
  const isAP = ['AP_SPECIALIST', 'ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN', 'PRESIDENT'].includes(currentUser?.role || '');

  const handleNotify = (type: 'success' | 'error' | 'info', message: string) => {
    console.log(`[ERP Notification: ${type.toUpperCase()}]`, message);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentOrgId(user.orgId);
    if (user.role === 'STUDENT') setActiveTab('student-portal');
    else if (user.role === 'TRAINER') setActiveTab('trainer-portal');
    else setActiveTab('dashboard');
  };

  const handlePostJournal = (entry: Partial<JournalEntry>, lines: JournalEntryLine[]) => {
    const fullEntry = {
      ...entry,
      id: entry.id || `je-${Date.now()}`,
      orgId: currentOrgId,
      status: 'POSTED',
      createdBy: currentUser?.id || 'system',
      createdAt: new Date().toISOString()
    } as JournalEntry;

    setJournalEntries(prev => [...prev, fullEntry]);
    setJournalLines(prev => [...prev, ...lines]);
    
    setAuditLogs(prev => [...prev, {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: currentUser?.name || 'System',
      action: 'POST',
      entityType: 'JOURNAL_ENTRY',
      entityId: fullEntry.id,
      details: `Posted ${fullEntry.sourceType}: ${fullEntry.description}`
    }]);
  };

  const handleConvertToBill = (po: PurchaseOrder) => {
    setActiveTab('ap');
    handleNotify('info', `PO ${po.reference} converted for Bill processing.`);
  };

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} onRegister={(o, a) => { setOrganizations(p => [...p, o]); setUsers(p => [...p, a]); setCurrentUser(a); setCurrentOrgId(o.id); setActiveTab('dashboard'); }} organizations={organizations} users={users} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      <aside className={`${sidebarOpen ? 'w-80' : 'w-20'} bg-slate-950 flex flex-col transition-all duration-500 z-50 border-r border-white/5`}>
        <div className="p-8 flex items-center justify-between border-b border-white/5 bg-slate-900/50">
           {sidebarOpen ? (
             <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg overflow-hidden"
                  style={{ backgroundColor: brandColor }}
                >
                   {currentOrg?.logoUrl ? <img src={currentOrg.logoUrl} className="w-full h-full object-cover" /> : <Building2 size={20} />}
                </div>
                <div className="min-w-0">
                   <h1 className="text-sm font-black text-white uppercase tracking-tighter truncate w-32">{currentOrg?.name}</h1>
                   <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{currentUser.role.replace('_', ' ')}</p>
                </div>
             </div>
           ) : (
             <div 
               className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto text-white shadow-xl"
               style={{ backgroundColor: brandColor }}
             >
               <Terminal size={20} />
             </div>
           )}
        </div>

        <nav className="flex-1 overflow-y-auto py-8 px-4 space-y-1.5 scrollbar-hide">
           {/* Portals */}
           {currentUser.role === 'STUDENT' && (
             <div className="mb-8">
               {sidebarOpen && <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">Learner Portal</p>}
               <NavItem icon={<LayoutDashboard size={20}/>} label="Dashboard" active={activeTab === 'student-portal'} onClick={() => setActiveTab('student-portal')} compact={!sidebarOpen} brandColor={brandColor} />
             </div>
           )}

           {currentUser.role === 'TRAINER' && (
             <div className="mb-8">
               {sidebarOpen && <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">Instructor Portal</p>}
               <NavItem icon={<LayoutDashboard size={20}/>} label="Trainer Console" active={activeTab === 'trainer-portal'} onClick={() => setActiveTab('trainer-portal')} compact={!sidebarOpen} brandColor={brandColor} />
             </div>
           )}

           {/* Financial Core & Analytics */}
           {isFinance && (
             <div className="mb-8">
               {sidebarOpen && <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">Financial Core</p>}
               <NavItem icon={<LayoutDashboard size={20}/>} label="Executive Console" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<BookText size={20}/>} label="General Ledger" active={activeTab === 'ledger'} onClick={() => setActiveTab('ledger')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<PieChart size={20}/>} label="Reporting Hub" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Landmark size={20}/>} label="Treasury" active={activeTab === 'banking'} onClick={() => setActiveTab('banking')} compact={!sidebarOpen} brandColor={brandColor} />
               {isAR && <NavItem icon={<Receipt size={20}/>} label="Receivables (AR)" active={activeTab === 'ar'} onClick={() => setActiveTab('ar')} compact={!sidebarOpen} brandColor={brandColor} />}
               {isAP && <NavItem icon={<CreditCard size={20}/>} label="Payables (AP)" active={activeTab === 'ap'} onClick={() => setActiveTab('ap')} compact={!sidebarOpen} brandColor={brandColor} />}
               {isAP && <NavItem icon={<ShoppingCart size={20}/>} label="Procurement (PO)" active={activeTab === 'po'} onClick={() => setActiveTab('po')} compact={!sidebarOpen} brandColor={brandColor} />}
               <NavItem icon={<Briefcase size={20}/>} label="Payroll Engine" active={activeTab === 'payroll'} onClick={() => setActiveTab('payroll')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Calculator size={20}/>} label="Budgets" active={activeTab === 'budgets'} onClick={() => setActiveTab('budgets')} compact={!sidebarOpen} brandColor={brandColor} />
             </div>
           )}

           {/* Operations */}
           {isRegistrar && (
             <div className="mb-8">
               {sidebarOpen && <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">Operations</p>}
               <NavItem icon={<Users size={20}/>} label="Learners" active={activeTab === 'students'} onClick={() => setActiveTab('students')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<GraduationCap size={20}/>} label="Trainers" active={activeTab === 'trainers'} onClick={() => setActiveTab('trainers')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Layers size={20}/>} label="Training Batches" active={activeTab === 'batches'} onClick={() => setActiveTab('batches')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<MapPin size={20}/>} label="Locations" active={activeTab === 'locations'} onClick={() => setActiveTab('locations')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<CalendarClock size={20}/>} label="Scheduling" active={activeTab === 'schedules'} onClick={() => setActiveTab('schedules')} compact={!sidebarOpen} brandColor={brandColor} />
             </div>
           )}

           {/* Registries */}
           {isFinance && (
             <div className="mb-8">
               {sidebarOpen && <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">Registries</p>}
               <NavItem icon={<Handshake size={20}/>} label="Sponsors" active={activeTab === 'sponsors'} onClick={() => setActiveTab('sponsors')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Truck size={20}/>} label="Vendors" active={activeTab === 'vendors'} onClick={() => setActiveTab('vendors')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Tag size={20}/>} label="Item Catalog" active={activeTab === 'items'} onClick={() => setActiveTab('items')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Box size={20}/>} label="Fixed Assets" active={activeTab === 'assets'} onClick={() => setActiveTab('assets')} compact={!sidebarOpen} brandColor={brandColor} />
             </div>
           )}

           {/* Administration */}
           {isAdmin && (
             <div className="mb-8">
               {sidebarOpen && <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">Administration</p>}
               <NavItem icon={<Settings size={20}/>} label="G/L Setup (COA)" active={activeTab === 'coa'} onClick={() => setActiveTab('coa')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Palette size={20}/>} label="Branding & Motif" active={activeTab === 'branding'} onClick={() => setActiveTab('branding')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Wallet size={20}/>} label="Subscription" active={activeTab === 'subscription'} onClick={() => setActiveTab('subscription')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<UserCog size={20}/>} label="Security/RBAC" active={activeTab === 'users'} onClick={() => setActiveTab('users')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<History size={20}/>} label="Audit Trail" active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Wrench size={20}/>} label="Maintenance" active={activeTab === 'maintenance'} onClick={() => setActiveTab('maintenance')} compact={!sidebarOpen} brandColor={brandColor} />
             </div>
           )}

           {/* System Level */}
           {isSysAdmin && (
             <div className="mb-8">
               {sidebarOpen && <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">Platform Host</p>}
               <NavItem icon={<Terminal size={20}/>} label="Tenant Mgmt" active={activeTab === 'tenant-mgmt'} onClick={() => setActiveTab('tenant-mgmt')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Binary size={20}/>} label="Data Schema" active={activeTab === 'schema'} onClick={() => setActiveTab('schema')} compact={!sidebarOpen} brandColor={brandColor} />
             </div>
           )}
        </nav>

        <div className="p-6 mt-auto border-t border-white/5">
           <button onClick={() => setCurrentUser(null)} className="w-full flex items-center gap-3 p-3 text-slate-500 hover:text-white transition-colors rounded-xl hover:bg-white/5">
              <LogOut size={20} />
              {sidebarOpen && <span className="text-xs font-black uppercase tracking-widest">Logout</span>}
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between z-40">
           <div className="flex items-center gap-4">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)} 
                className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-all border border-slate-100"
              >
                 {sidebarOpen ? <X size={20}/> : <Menu size={20}/>}
              </button>
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] ml-4">{activeTab.replace('-', ' ')}</h2>
           </div>
           <div className="flex items-center gap-6">
              {isFinance && (
                <button 
                  onClick={() => setShowJournalForm(true)} 
                  className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95"
                  style={{ backgroundColor: brandColor }}
                >
                   <PlusCircle size={18} /> Manual Post
                </button>
              )}
              <div className="h-10 w-px bg-slate-100 mx-2" />
              <div className="flex items-center gap-3">
                 <div className="text-right">
                    <p className="text-xs font-black text-slate-800 leading-none">{currentUser.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{currentUser.role.replace('_', ' ')}</p>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-black border-2 border-white shadow-xl uppercase">
                    {currentUser.name.substring(0,2)}
                 </div>
              </div>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-10 scrollbar-hide">
          {activeTab === 'student-portal' && currentUser.studentId && (
            <StudentPortalView 
              student={students.find(s => s.id === currentUser.studentId)!}
              batches={batches.filter(b => b.orgId === currentOrgId && !b.isDeleted)}
              qualifications={qualifications.filter(q => q.orgId === currentOrgId && !q.isDeleted)}
              trainers={trainers.filter(t => t.orgId === currentOrgId && !t.isDeleted)}
              locations={locations.filter(l => l.orgId === currentOrgId && !l.isDeleted)}
              schedules={schedules.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              entries={activeJournalEntries}
              lines={journalLines}
              onUpdateStudent={s => setStudents(prev => prev.map(x => x.id === s.id ? s : x))}
            />
          )}

          {activeTab === 'trainer-portal' && currentUser.trainerId && (
            <TrainerPortalView 
              trainer={trainers.find(t => t.id === currentUser.trainerId)!}
              batches={batches.filter(b => b.orgId === currentOrgId && !b.isDeleted)}
              qualifications={qualifications.filter(q => q.orgId === currentOrgId && !q.isDeleted)}
              locations={locations.filter(l => l.orgId === currentOrgId && !l.isDeleted)}
              schedules={schedules.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              onUpdateTrainer={t => setTrainers(prev => prev.map(x => x.id === t.id ? t : x))}
            />
          )}

          {activeTab === 'dashboard' && <Dashboard summaries={summaries} currency={currentOrg?.currency} lines={filteredLines} accounts={filteredAccounts} />}
          {activeTab === 'ledger' && <Ledger accounts={filteredAccounts} entries={activeJournalEntries} lines={filteredLines} />}
          {activeTab === 'reports' && <Reports summaries={summaries} accounts={filteredAccounts} entries={activeJournalEntries} lines={filteredLines} qualifications={qualifications} batches={batches} orgName={currentOrg?.name} currency={currentOrg?.currency} logoUrl={currentOrg?.logoUrl} />}
          
          {activeTab === 'ar' && <ARView entries={activeJournalEntries} lines={filteredLines} students={students} sponsors={sponsors} items={items} accounts={filteredAccounts} bankAccounts={bankAccounts} onPostInvoice={handlePostJournal} onNotify={handleNotify} />}
          {activeTab === 'ap' && <APView vendors={vendors} entries={activeJournalEntries} lines={filteredLines} items={items} accounts={filteredAccounts} bankAccounts={bankAccounts} onPostBill={handlePostJournal} onNotify={handleNotify} />}
          {activeTab === 'po' && <PurchaseOrdersView purchaseOrders={purchaseOrders} vendors={vendors} items={items} onCreatePO={po => setPurchaseOrders(p => [...p, po])} onUpdateStatus={(id, s) => setPurchaseOrders(p => p.map(x => x.id === id ? {...x, status: s} : x))} onConvertToBill={handleConvertToBill} />}
          
          {activeTab === 'coa' && <ChartOfAccounts accounts={filteredAccounts} lines={filteredLines} qualifications={qualifications} onAddAccount={a => setAccounts(p => [...p, a])} onUpdateAccount={a => setAccounts(p => p.map(x => x.id === a.id ? a : x))} onDeleteAccount={id => setAccounts(p => p.filter(x => x.id !== id))} />}
          {activeTab === 'items' && <ItemsView items={items} accounts={filteredAccounts} onAddItem={i => setItems(p => [...p, i])} onUpdateItem={i => setItems(p => p.map(x => x.id === i.id ? i : x))} onDeleteItem={id => setItems(p => p.filter(x => x.id !== id))} />}
          {activeTab === 'sponsors' && <SponsorsView sponsors={sponsors} accounts={filteredAccounts} lines={filteredLines} onAddSponsor={s => setSponsors(p => [...p, s])} onUpdateSponsor={s => setSponsors(p => p.map(x => x.id === s.id ? s : x))} onDeleteSponsor={id => setSponsors(p => p.filter(x => x.id !== id))} />}
          {activeTab === 'vendors' && <VendorsView vendors={vendors} accounts={filteredAccounts} lines={filteredLines} onAddVendor={v => setVendors(p => [...p, v])} onUpdateVendor={v => setVendors(p => p.map(x => x.id === v.id ? v : x))} onDeleteVendor={id => setVendors(p => p.filter(x => x.id !== id))} />}
          {activeTab === 'assets' && <AssetsView assets={[]} accounts={filteredAccounts} lines={filteredLines} entries={activeJournalEntries} onDepreciate={() => {}} onAddAsset={() => {}} />}
          {activeTab === 'banking' && <BankingView bankAccounts={bankAccounts.filter(b => b.orgId === currentOrgId && !b.isDeleted)} summaries={summaries} accounts={filteredAccounts} entries={activeJournalEntries} lines={filteredLines} onAddBankAccount={b => setBankAccounts(prev => [...prev, {...b, orgId: currentOrgId} as BankAccount])} onPostTransfer={handlePostJournal} onToggleClearLine={id => setJournalLines(prev => prev.map(l => l.id === id ? {...l, isCleared: !l.isCleared} : l))} onNotify={handleNotify} />}
          
          {activeTab === 'branding' && currentOrg && <BrandingView organization={currentOrg} onUpdate={o => setOrganizations(p => p.map(x => x.id === o.id ? o : x))} />}
          {activeTab === 'subscription' && currentOrg && <SubscriptionView organization={currentOrg} onUpdate={o => setOrganizations(p => p.map(x => x.id === o.id ? o : x))} />}
          
          {activeTab === 'payroll' && <PayrollView employees={employees.filter(e => e.orgId === currentOrgId && !e.isDeleted)} payrollRuns={payrollRuns} payrollLines={payrollLines} accounts={filteredAccounts} bankAccounts={bankAccounts} entries={activeJournalEntries} orgName={currentOrg?.name} onPostPayroll={(r, l, e, el) => { setPayrollRuns(prev => [...prev, r as PayrollRun]); setPayrollLines(prev => [...prev, ...l as PayrollLine[]]); handlePostJournal(e, el); }} />}
          {activeTab === 'students' && <StudentsView students={students.filter(s => s.orgId === currentOrgId && !s.isDeleted)} onAddStudent={s => setStudents(p => [...p, s])} onUpdateStudent={s => setStudents(p => p.map(x => x.id === s.id ? s : x))} onDeleteStudent={id => setStudents(p => p.filter(x => x.id !== id))} onBatchAddStudents={s => setStudents(p => [...p, ...s])} />}
          {activeTab === 'trainers' && <TrainersView trainers={trainers.filter(t => t.orgId === currentOrgId && !t.isDeleted)} qualifications={qualifications} onAddTrainer={t => setTrainers(p => [...p, t])} onUpdateTrainer={t => setTrainers(p => p.map(x => x.id === t.id ? t : x))} onDeleteTrainer={id => setTrainers(p => p.filter(x => x.id !== id))} />}
          {activeTab === 'batches' && <BatchesView batches={batches.filter(b => b.orgId === currentOrgId && !b.isDeleted)} qualifications={qualifications} trainers={trainers} students={students} sponsors={sponsors} schedules={schedules} locations={locations} onAddBatch={b => setBatches(p => [...p, b])} onUpdateBatch={b => setBatches(p => p.map(x => x.id === b.id ? b : x))} onDeleteBatch={id => setBatches(p => p.filter(x => x.id !== id))} />}
          {activeTab === 'locations' && <LocationsView locations={locations.filter(l => l.orgId === currentOrgId && !l.isDeleted)} onAddLocation={l => setLocations(p => [...p, l])} onUpdateLocation={l => setLocations(p => p.map(x => x.id === l.id ? l : x))} onDeleteLocation={id => setLocations(p => p.filter(x => x.id !== id))} />}
          {activeTab === 'schedules' && <SchedulesView schedules={schedules.filter(s => s.orgId === currentOrgId && !s.isDeleted)} trainers={trainers.filter(t => t.orgId === currentOrgId && !t.isDeleted)} locations={locations.filter(l => l.orgId === currentOrgId && !l.isDeleted)} onAddSchedule={s => setSchedules(p => [...p, s])} onUpdateSchedule={s => setSchedules(p => p.map(x => x.id === s.id ? s : x))} onDeleteSchedule={id => setSchedules(p => p.filter(x => x.id !== id))} />}
          {activeTab === 'budgets' && <BudgetView accounts={filteredAccounts} summaries={summaries} budgets={[]} budgetLines={[]} onSaveBudget={() => {}} />}
          
          {activeTab === 'users' && <UsersManagementView users={users.filter(u => u.orgId === currentOrgId)} onAddUser={u => setUsers(p => [...p, u])} onDeleteUser={id => setUsers(p => p.filter(x => x.id !== id))} />}
          {activeTab === 'audit' && <AuditTrail logs={auditLogs} />}
          {activeTab === 'maintenance' && <MaintenanceView logs={auditLogs} onExport={() => {}} onImport={() => {}} />}
          {activeTab === 'tenant-mgmt' && <TenantManagementView organizations={organizations} onAddTenant={o => setOrganizations(p => [...p, o])} onUpdateTenant={o => setOrganizations(p => p.map(x => x.id === o.id ? o : x))} />}
          {activeTab === 'schema' && <SchemaManualView />}
        </div>
      </main>

      {showJournalForm && (
        <JournalForm 
          accounts={filteredAccounts}
          students={students.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
          trainers={trainers.filter(t => t.orgId === currentOrgId && !t.isDeleted)}
          sponsors={sponsors.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
          batches={batches.filter(b => b.orgId === currentOrgId && !b.isDeleted)}
          items={items.filter(i => i.orgId === currentOrgId && !i.isDeleted)}
          entries={activeJournalEntries}
          onClose={() => setShowJournalForm(false)}
          onSubmit={(entry, lines) => { handlePostJournal(entry, lines); setShowJournalForm(false); }}
        />
      )}
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  compact: boolean;
  brandColor: string;
}

function NavItem({ icon, label, active, onClick, compact, brandColor }: NavItemProps) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all group ${active ? 'text-white shadow-xl' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
      style={active ? { backgroundColor: brandColor, boxShadow: `0 20px 25px -5px ${brandColor}66` } : {}}
    >
      <div className={`shrink-0 transition-transform duration-500 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</div>
      {!compact && <span className="text-[11px] font-black uppercase tracking-widest truncate">{label}</span>}
    </button>
  );
}
