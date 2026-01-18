
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Organization, User, Student, Qualification, Trainer, Batch, Sponsor, NonStockItem, Vendor, FixedAsset, BankAccount, Location, TrainerSchedule, Employee, PayrollRun, PayrollLine, JournalEntry, JournalEntryLine, AuditLog, Budget, BudgetLine, AccountClass, TransactionSummary, ChartOfAccount, PurchaseOrder, PurchaseOrderStatus, PaymentHistory
} from './types';
import { AccountingService } from './accountingService';
import { DataServiceFactory } from './services/DataServiceFactory';
import { authService } from './services/AuthService';
import { config } from './config/app';

// View Imports
import Dashboard from './views/Dashboard';
import Ledger from './views/Ledger';
import Reports from './views/Reports';
import ChartOfAccounts from './views/ChartOfAccounts';
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
import PaymentHistoryView from './views/PaymentHistoryView';
import PaymentMonitoringView from './views/PaymentMonitoringView';
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
  FileText, Tag, Wallet, Activity, Loader2, Database,
  Cloud, BarChart2
} from 'lucide-react';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Data service reference for CRUD operations
  const [dataService] = useState(() => DataServiceFactory.getService());

  // Check for existing session on mount
  useEffect(() => {
    const session = authService.getSession();
    if (session) {
      setCurrentUser(session.user);
      setCurrentOrgId(session.user.orgId);
      console.info('[App] Restored user session:', session.user.email);
    }
  }, []);

  // Logout handler
  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setCurrentOrgId('');
    console.info('[App] User logged out');
  };

  // Master Data State
  const [students, setStudents] = useState<Student[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [items, setItems] = useState<NonStockItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [schedules, setSchedules] = useState<TrainerSchedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);

  // Financial Cycle State
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalLines, setJournalLines] = useState<JournalEntryLine[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [payrollLines, setPayrollLines] = useState<PayrollLine[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Modals
  const [showJournalForm, setShowJournalForm] = useState(false);

  // Data Loading Logic
  useEffect(() => {
    async function loadData() {
      try {
        console.log("📊 App: Starting data load...");
        console.log("🔧 Config:", { useMockData: config.useMockData, supabaseConfigured: !!(config.supabase?.url && config.supabase?.anonKey) });
        
        const service = DataServiceFactory.getService();
        console.log(`📦 Using service: ${config.useMockData ? 'MOCK' : 'SUPABASE'}`);
        
        const data = await service.getInitialData();
        console.log("✅ Data loaded:", { 
          organizations: data.organizations.length,
          users: data.users.length,
          students: data.students.length,
          accounts: data.accounts.length
        });
        
        setOrganizations(data.organizations);
        setUsers(data.users);
        setStudents(data.students);
        setQualifications(data.qualifications);
        setTrainers(data.trainers);
        setBatches(data.batches);
        setSponsors(data.sponsors);
        setItems(data.items);
        setVendors(data.vendors);
        setLocations(data.locations);
        setSchedules(data.schedules);
        setEmployees(data.employees);
        setBankAccounts(data.bankAccounts);
        setAccounts(data.accounts);
        setJournalEntries(data.journalEntries);
        setJournalLines(data.journalLines);
        setPayrollRuns(data.payrollRuns);
        setPayrollLines(data.payrollLines);
        setAuditLogs(data.auditLogs);
        setPurchaseOrders(data.purchaseOrders);
        setPayments(data.paymentHistories);
        setFixedAssets(data.fixedAssets);
        
        if (data.organizations.length > 0) {
          // Get the restored session to check user's orgId
          const restoredSession = authService.getSession();
          const restoredUser = restoredSession?.user;
          const userOrgId = restoredUser?.orgId;
          const userOrgExists = data.organizations.some(o => o.id === userOrgId && !o.isDeleted);
          const isSystemAdmin = restoredUser?.role === 'SYSTEM_ADMIN';
          
          console.log('[App] Organization selection:', { userOrgId, userOrgExists, isSystemAdmin, user: restoredUser?.email });
          
          // Validate: User must have an organization OR be a SYSTEM_ADMIN
          if (restoredUser && !userOrgExists && !isSystemAdmin) {
            console.error('[App] ❌ Validation failed: User has no valid organization and is not SYSTEM_ADMIN');
            authService.logout();
            setCurrentUser(null);
            setCurrentOrgId('');
            handleNotify('error', 'Access Denied: Your organization is no longer available. Please contact your system administrator.');
            setIsLoading(false);
            return;
          }
          
          if (userOrgId && userOrgExists) {
            // User belongs to this org - use it
            setCurrentOrgId(userOrgId);
            console.log('[App] ✅ Set organization from user record:', userOrgId);
          } else if (isSystemAdmin && data.organizations.length > 0) {
            // SYSTEM_ADMIN: use first available organization
            setCurrentOrgId(data.organizations[0].id);
            console.log('[App] SYSTEM_ADMIN: Set organization to first available:', data.organizations[0].id);
          } else if (data.organizations.length > 0 && !restoredUser) {
            // No user logged in: use first organization for initial context
            setCurrentOrgId(data.organizations[0].id);
            console.log('[App] No logged-in user: Set organization to first available:', data.organizations[0].id);
          }
        }
        console.log("✅ State updated, data load complete");
      } catch (error) {
        console.error("❌ Critical Data Load Error:", error);
      } finally {
        console.log("🏁 Setting isLoading to false");
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Derived Accounting Context
  const currentOrg = useMemo(() => organizations.find(o => o.id === currentOrgId), [organizations, currentOrgId]);
  const brandColor = currentOrg?.primaryColor || '#4f46e5';

  const filteredAccounts = useMemo(() => accounts.filter(a => a.orgId === currentOrgId && !a.isDeleted), [accounts, currentOrgId]);
  const activeJournalEntries = useMemo(() => journalEntries.filter(e => e.orgId === currentOrgId && !e.isDeleted), [journalEntries, currentOrgId]);
  const activeEntryIds = useMemo(() => new Set(activeJournalEntries.map(e => e.id)), [activeJournalEntries]);
  const filteredLines = useMemo(() => journalLines.filter(l => activeEntryIds.has(l.journalEntryId)), [journalLines, activeEntryIds]);
  const summaries = useMemo(() => AccountingService.getLedgerSummaries(filteredAccounts, filteredLines), [filteredAccounts, filteredLines]);

  // RBAC Controls
  const isSysAdmin = currentUser?.role === 'SYSTEM_ADMIN';
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'PRESIDENT' || isSysAdmin;
  const isTenantAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'PRESIDENT'; // Excludes SYSTEM_ADMIN

  // ============================================================================
  // PAYMENT DUE NOTIFICATION FOR TENANT ADMIN (5 days before due)
  // ============================================================================
  const paymentsDueSoon = useMemo(() => {
    if (!isTenantAdmin) return [];
    
    const today = new Date();
    const fiveDaysFromNow = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);
    
    return payments.filter(p => {
      const dueDate = new Date(p.dueDate);
      return p.orgId === currentOrgId && 
             p.status === 'PENDING' && 
             dueDate >= today && 
             dueDate <= fiveDaysFromNow;
    });
  }, [payments, currentOrgId, isTenantAdmin]);
  const isFinance = ['ACCOUNTANT', 'FINANCE_MANAGER', 'AR_SPECIALIST', 'AP_SPECIALIST', 'ADMIN', 'PRESIDENT'].includes(currentUser?.role || '');
  const isRegistrar = ['REGISTRAR', 'ADMIN'].includes(currentUser?.role || '');
  const isAR = ['AR_SPECIALIST', 'ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN', 'PRESIDENT'].includes(currentUser?.role || '');
  const isAP = ['AP_SPECIALIST', 'ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN', 'PRESIDENT'].includes(currentUser?.role || '');

  const handleNotify = (type: 'success' | 'error' | 'info', message: string) => {
    console.log(`[ERP Notification: ${type.toUpperCase()}]`, message);
  };

  const handleLogin = (user: User) => {
    // Validate that user has an organization, OR is a SYSTEM_ADMIN
    const userHasOrg = user.orgId && organizations.some(o => o.id === user.orgId && !o.isDeleted);
    const isSystemAdmin = user.role === 'SYSTEM_ADMIN';
    
    if (!userHasOrg && !isSystemAdmin) {
      handleNotify('error', 'Access Denied: User must belong to an organization to login. Contact your system administrator.');
      console.warn('[App] Login denied: User has no valid organization and is not SYSTEM_ADMIN', user.email);
      return;
    }

    setCurrentUser(user);
    setCurrentOrgId(user.orgId || ''); // Empty string for system admin if no org
    // Store session for persistence
    const session = { user, token: btoa(JSON.stringify({ userId: user.id, email: user.email, iat: Date.now() })) };
    localStorage.setItem('at_erp_session', JSON.stringify(session));
    console.info('[App] User session stored:', user.email);
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

  // ============================================================================
  // ORGANIZATION & USER HANDLERS WITH SUPABASE PERSISTENCE
  // ============================================================================

  const handleAddOrganization = async (org: Organization) => {
    try {
      console.info('[App] Creating organization:', org.name);
      const savedOrg = await dataService.createOrganization(org);
      setOrganizations(prev => [...prev, savedOrg]);
      handleNotify('success', `Organization "${org.name}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating organization:', error);
      handleNotify('error', 'Failed to create organization. Falling back to memory storage.');
      // Fallback to memory storage if Supabase fails
      setOrganizations(prev => [...prev, org]);
    }
  };

  const handleUpdateOrganization = async (id: string, updates: Partial<Organization>) => {
    try {
      console.info('[App] Updating organization:', id);
      const updated = await dataService.updateOrganization(id, updates);
      setOrganizations(prev => prev.map(o => o.id === id ? { ...o, ...updated } : o));
      handleNotify('success', 'Organization updated successfully');
    } catch (error) {
      console.error('[App] Error updating organization:', error);
      handleNotify('error', 'Failed to update organization. Falling back to memory storage.');
      // Fallback to memory storage
      setOrganizations(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
    }
  };

  const handleDeleteOrganization = async (id: string) => {
    try {
      console.info('[App] Deleting organization:', id);
      await dataService.deleteOrganization(id);
      setOrganizations(prev => prev.filter(o => o.id !== id));
      handleNotify('success', 'Organization deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting organization:', error);
      handleNotify('error', 'Failed to delete organization. Falling back to memory storage.');
      // Fallback to memory storage
      setOrganizations(prev => prev.filter(o => o.id !== id));
    }
  };

  // ============================================================================
  // USER CRUD HANDLERS WITH SUPABASE PERSISTENCE
  // ============================================================================

  const handleAddUser = async (user: User) => {
    try {
      console.info('[App] Creating user:', user.email);
      // Ensure user has orgId set
      const userWithOrg = { ...user, orgId: currentOrgId };
      const savedUser = await dataService.createUser(userWithOrg);
      setUsers(prev => [...prev, savedUser]);
      handleNotify('success', `User "${user.name}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating user:', error);
      handleNotify('error', 'Failed to create user. Falling back to memory storage.');
      // Fallback to memory storage
      const userWithOrg = { ...user, orgId: currentOrgId };
      setUsers(prev => [...prev, userWithOrg]);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      console.info('[App] Deleting user:', id);
      await dataService.deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      handleNotify('success', 'User deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting user:', error);
      handleNotify('error', 'Failed to delete user. Falling back to memory storage.');
      // Fallback to memory storage
      setUsers(prev => prev.filter(u => u.id !== id));
    }
  };

  const handleRegisterWithPersistence = async (org: Organization, admin: User) => {
    try {
      console.info('[App] Registering new organization and admin user');
      
      // Create organization
      const savedOrg = await dataService.createOrganization(org);
      setOrganizations(p => [...p, savedOrg]);
      
      // Create admin user
      const savedAdmin = await dataService.createUser(admin);
      setUsers(p => [...p, savedAdmin]);
      
      setCurrentUser(savedAdmin);
      setCurrentOrgId(savedOrg.id);
      setActiveTab('dashboard');
      
      handleNotify('success', `Welcome! Organization "${org.name}" registered successfully`);
      console.info('[App] Registration complete');
    } catch (error) {
      console.error('[App] Error during registration:', error);
      handleNotify('error', 'Registration failed. Falling back to memory storage.');
      // Fallback to memory storage
      setOrganizations(p => [...p, org]);
      setUsers(p => [...p, admin]);
      setCurrentUser(admin);
      setCurrentOrgId(org.id);
      setActiveTab('dashboard');
    }
  };

  // ============================================================================
  // STUDENT CRUD HANDLERS WITH SUPABASE PERSISTENCE & REFERENTIAL INTEGRITY
  // ============================================================================

  const handleAddStudent = async (student: Student) => {
    try {
      console.info('[App] Creating student:', student.uli);
      const studentWithOrg = { ...student, orgId: currentOrgId };
      const savedStudent = await dataService.createStudent(studentWithOrg);
      setStudents(prev => [...prev, savedStudent]);
      handleNotify('success', `Student "${student.firstName} ${student.lastName}" registered successfully`);
    } catch (error) {
      console.error('[App] Error creating student:', error);
      handleNotify('error', 'Failed to create student. Falling back to memory storage.');
      const studentWithOrg = { ...student, orgId: currentOrgId };
      setStudents(prev => [...prev, studentWithOrg]);
    }
  };

  const handleUpdateStudent = async (student: Student) => {
    try {
      console.info('[App] Updating student:', student.id);
      const updated = await dataService.updateStudent(student.id, student);
      setStudents(prev => prev.map(s => s.id === student.id ? updated : s));
      handleNotify('success', 'Student record updated successfully');
    } catch (error) {
      console.error('[App] Error updating student:', error);
      handleNotify('error', 'Failed to update student. Falling back to memory storage.');
      setStudents(prev => prev.map(s => s.id === student.id ? student : s));
    }
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      console.info('[App] Checking student usage before deletion:', id);
      
      // Check if student is used in other modules
      const usage = await dataService.checkStudentUsage(id);
      if (usage.isUsed) {
        const message = `Cannot delete student. Referenced in: ${usage.usedIn.join(', ')}`;
        handleNotify('error', message);
        return false; // Return false to indicate deletion failed
      }

      // Proceed with hard delete (Supabase table doesn't support soft delete)
      console.info('[App] Deleting student:', id);
      await dataService.deleteStudent(id);
      setStudents(prev => prev.filter(s => s.id !== id));
      handleNotify('success', 'Student record deleted successfully');
      return true; // Return true to indicate successful deletion
    } catch (error) {
      console.error('[App] Error deleting student:', error);
      handleNotify('error', 'Failed to delete student. Falling back to memory storage.');
      // Fallback to hard delete in memory
      setStudents(prev => prev.filter(s => s.id !== id));
      return true;
    }
  };

  const handleBatchAddStudents = async (newStudents: Student[]) => {
    try {
      console.info('[App] Batch adding students:', newStudents.length);
      const studentsWithOrg = newStudents.map(s => ({ ...s, orgId: currentOrgId }));
      
      // Create each student
      const savedStudents = await Promise.all(
        studentsWithOrg.map(s => dataService.createStudent(s))
      );
      
      setStudents(prev => [...prev, ...savedStudents]);
      handleNotify('success', `${newStudents.length} students imported successfully`);
    } catch (error) {
      console.error('[App] Error batch adding students:', error);
      handleNotify('error', 'Failed to import students. Falling back to memory storage.');
      // Fallback to memory storage
      const studentsWithOrg = newStudents.map(s => ({ ...s, orgId: currentOrgId }));
      setStudents(prev => [...prev, ...studentsWithOrg]);
    }
  };

  // ============================================================================
  // TRAINER CRUD HANDLERS WITH SUPABASE PERSISTENCE & REFERENTIAL INTEGRITY
  // ============================================================================

  const handleAddTrainer = async (trainer: Trainer) => {
    try {
      console.info('[App] Creating trainer:', `${trainer.firstName} ${trainer.lastName}`);
      const trainerWithOrg = { ...trainer, orgId: currentOrgId };
      const savedTrainer = await dataService.createTrainer(trainerWithOrg);
      setTrainers(prev => [...prev, savedTrainer]);
      handleNotify('success', `Trainer "${trainer.firstName} ${trainer.lastName}" registered successfully`);
    } catch (error) {
      console.error('[App] Error creating trainer:', error);
      handleNotify('error', 'Failed to create trainer. Falling back to memory storage.');
      const trainerWithOrg = { ...trainer, orgId: currentOrgId };
      setTrainers(prev => [...prev, trainerWithOrg]);
    }
  };

  const handleUpdateTrainer = async (trainer: Trainer) => {
    try {
      console.info('[App] Updating trainer:', trainer.id);
      const updated = await dataService.updateTrainer(trainer.id, trainer);
      setTrainers(prev => prev.map(t => t.id === trainer.id ? updated : t));
      handleNotify('success', 'Trainer record updated successfully');
    } catch (error) {
      console.error('[App] Error updating trainer:', error);
      handleNotify('error', 'Failed to update trainer. Falling back to memory storage.');
      setTrainers(prev => prev.map(t => t.id === trainer.id ? trainer : t));
    }
  };

  const handleDeleteTrainer = async (id: string) => {
    try {
      console.info('[App] Checking trainer usage before deletion:', id);
      
      // Check if trainer is used in other modules
      const usage = await dataService.checkTrainerUsage(id);
      if (usage.isUsed) {
        const message = `Cannot delete trainer. Referenced in: ${usage.usedIn.join(', ')}`;
        handleNotify('error', message);
        return false; // Return false to indicate deletion failed
      }

      // Proceed with hard delete
      console.info('[App] Deleting trainer:', id);
      await dataService.deleteTrainer(id);
      setTrainers(prev => prev.filter(t => t.id !== id));
      handleNotify('success', 'Trainer record deleted successfully');
      return true; // Return true to indicate successful deletion
    } catch (error) {
      console.error('[App] Error deleting trainer:', error);
      handleNotify('error', 'Failed to delete trainer. Falling back to memory storage.');
      // Fallback to hard delete in memory
      setTrainers(prev => prev.filter(t => t.id !== id));
      return true;
    }
  };

  // ============================================================================
  // QUALIFICATION CRUD HANDLERS WITH SUPABASE PERSISTENCE & REFERENTIAL INTEGRITY
  // ============================================================================

  const handleAddQualification = async (qualification: Qualification) => {
    try {
      console.info('[App] Creating qualification:', qualification.code);
      const qualWithOrg = { ...qualification, orgId: currentOrgId };
      const savedQual = await dataService.createQualification(qualWithOrg);
      setQualifications(prev => [...prev, savedQual]);
      handleNotify('success', `Qualification "${qualification.name}" registered successfully`);
    } catch (error) {
      console.error('[App] Error creating qualification:', error);
      handleNotify('error', 'Failed to create qualification. Falling back to memory storage.');
      const qualWithOrg = { ...qualification, orgId: currentOrgId };
      setQualifications(prev => [...prev, qualWithOrg]);
    }
  };

  const handleUpdateQualification = async (qualification: Qualification) => {
    try {
      console.info('[App] Updating qualification:', qualification.id);
      const updated = await dataService.updateQualification(qualification.id, qualification);
      setQualifications(prev => prev.map(q => q.id === qualification.id ? updated : q));
      handleNotify('success', 'Qualification record updated successfully');
    } catch (error) {
      console.error('[App] Error updating qualification:', error);
      handleNotify('error', 'Failed to update qualification. Falling back to memory storage.');
      setQualifications(prev => prev.map(q => q.id === qualification.id ? qualification : q));
    }
  };

  const handleDeleteQualification = async (id: string) => {
    try {
      console.info('[App] Checking qualification usage before deletion:', id);
      
      // Check if qualification is used in other modules
      const usage = await dataService.checkQualificationUsage(id);
      if (usage.isUsed) {
        const message = `Cannot delete qualification. Referenced in: ${usage.usedIn.join(', ')}`;
        handleNotify('error', message);
        return false;
      }

      // Proceed with hard delete
      console.info('[App] Deleting qualification:', id);
      await dataService.deleteQualification(id);
      setQualifications(prev => prev.filter(q => q.id !== id));
      handleNotify('success', 'Qualification record deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting qualification:', error);
      handleNotify('error', 'Failed to delete qualification. Falling back to memory storage.');
      setQualifications(prev => prev.filter(q => q.id !== id));
      return true;
    }
  };

  // ======================== LOCATION CRUD HANDLERS ========================

  const handleAddLocation = async (location: Location) => {
    try {
      console.info('[App] Creating new location:', location);
      // Ensure orgId is set
      location.orgId = currentOrgId;
      
      const created = await dataService.createLocation(location);
      console.info('[App] Location created successfully:', created);
      setLocations(prev => [...prev, created]);
      handleNotify('success', 'Location registered successfully');
    } catch (error) {
      console.error('[App] Error creating location:', error);
      handleNotify('error', 'Failed to save location. Falling back to memory storage.');
      // Fallback to local state
      location.orgId = currentOrgId;
      setLocations(prev => [...prev, location]);
    }
  };

  const handleUpdateLocation = async (location: Location) => {
    try {
      console.info('[App] Updating location:', location);
      const updated = await dataService.updateLocation(location.id, location);
      console.info('[App] Location updated successfully:', updated);
      setLocations(prev => prev.map(l => l.id === location.id ? location : l));
      handleNotify('success', 'Location updated successfully');
    } catch (error) {
      console.error('[App] Error updating location:', error);
      handleNotify('error', 'Failed to update location. Falling back to memory storage.');
      setLocations(prev => prev.map(l => l.id === location.id ? location : l));
    }
  };

  const handleDeleteLocation = async (id: string) => {
    try {
      console.info('[App] Checking location usage before deletion:', id);
      
      // Check if location is used in other modules
      const usage = await dataService.checkLocationUsage(id);
      if (usage.isUsed) {
        const message = `Cannot delete location. Referenced in: ${usage.usedIn.join(', ')}`;
        handleNotify('error', message);
        return false;
      }

      // Proceed with hard delete
      console.info('[App] Deleting location:', id);
      await dataService.deleteLocation(id);
      setLocations(prev => prev.filter(l => l.id !== id));
      handleNotify('success', 'Location deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting location:', error);
      handleNotify('error', 'Failed to delete location. Falling back to memory storage.');
      setLocations(prev => prev.filter(l => l.id !== id));
      return true;
    }
  };

  // ======================== SCHEDULE CRUD HANDLERS ========================

  const handleAddSchedule = async (schedule: TrainerSchedule) => {
    try {
      console.info('[App] Creating new schedule:', schedule);
      // Ensure orgId is set
      schedule.orgId = currentOrgId;
      
      const created = await dataService.createSchedule(schedule);
      console.info('[App] Schedule created successfully:', created);
      setSchedules(prev => [...prev, created]);
      handleNotify('success', 'Schedule registered successfully');
    } catch (error) {
      console.error('[App] Error creating schedule:', error);
      handleNotify('error', 'Failed to save schedule. Falling back to memory storage.');
      // Fallback to local state
      schedule.orgId = currentOrgId;
      setSchedules(prev => [...prev, schedule]);
    }
  };

  const handleUpdateSchedule = async (schedule: TrainerSchedule) => {
    try {
      console.info('[App] Updating schedule:', schedule);
      const updated = await dataService.updateSchedule(schedule.id, schedule);
      console.info('[App] Schedule updated successfully:', updated);
      setSchedules(prev => prev.map(s => s.id === schedule.id ? schedule : s));
      handleNotify('success', 'Schedule updated successfully');
    } catch (error) {
      console.error('[App] Error updating schedule:', error);
      handleNotify('error', 'Failed to update schedule. Falling back to memory storage.');
      setSchedules(prev => prev.map(s => s.id === schedule.id ? schedule : s));
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      console.info('[App] Checking schedule usage before deletion:', id);
      
      // Check if schedule is used in other modules
      const usage = await dataService.checkScheduleUsage(id);
      if (usage.isUsed) {
        const message = `Cannot delete schedule. Referenced in: ${usage.usedIn.join(', ')}`;
        handleNotify('error', message);
        return false;
      }

      // Proceed with hard delete
      console.info('[App] Deleting schedule:', id);
      await dataService.deleteSchedule(id);
      setSchedules(prev => prev.filter(s => s.id !== id));
      handleNotify('success', 'Schedule deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting schedule:', error);
      handleNotify('error', 'Failed to delete schedule. Falling back to memory storage.');
      setSchedules(prev => prev.filter(s => s.id !== id));
      return true;
    }
  };

  // ============================================================================
  // BATCH CRUD Handlers
  // ============================================================================

  const handleAddBatch = async (batch: Batch) => {
    try {
      const batchWithOrg = { ...batch, orgId: currentOrgId };
      console.info('[App] Creating batch:', batchWithOrg);
      const created = await dataService.createBatch(batchWithOrg);
      console.info('[App] Batch created successfully:', created);
      setBatches(prev => [...prev, created]);
      handleNotify('success', 'Batch created successfully');
    } catch (error) {
      console.error('[App] Error creating batch:', error);
      handleNotify('error', 'Failed to save batch. Falling back to memory storage.');
      batch.orgId = currentOrgId;
      setBatches(prev => [...prev, batch]);
    }
  };

  const handleUpdateBatch = async (batch: Batch) => {
    try {
      console.info('[App] Updating batch:', batch);
      const updated = await dataService.updateBatch(batch.id, batch);
      console.info('[App] Batch updated successfully:', updated);
      setBatches(prev => prev.map(b => b.id === batch.id ? batch : b));
      handleNotify('success', 'Batch updated successfully');
    } catch (error) {
      console.error('[App] Error updating batch:', error);
      handleNotify('error', 'Failed to update batch. Falling back to memory storage.');
      setBatches(prev => prev.map(b => b.id === batch.id ? batch : b));
    }
  };

  const handleDeleteBatch = async (id: string) => {
    try {
      console.info('[App] Deleting batch:', id);
      await dataService.deleteBatch(id);
      setBatches(prev => prev.filter(b => b.id !== id));
      handleNotify('success', 'Batch deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting batch:', error);
      handleNotify('error', 'Failed to delete batch. Falling back to memory storage.');
      setBatches(prev => prev.filter(b => b.id !== id));
      return true;
    }
  };

  // ============================================================================
  // SPONSOR CRUD Handlers
  // ============================================================================

  const handleAddSponsor = async (sponsor: Sponsor) => {
    try {
      const sponsorWithOrg = { ...sponsor, orgId: currentOrgId };
      console.info('[App] Creating sponsor:', sponsorWithOrg);
      const created = await dataService.createSponsor(sponsorWithOrg);
      setSponsors(prev => [...prev, created]);
      handleNotify('success', `Sponsor "${created.name}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating sponsor:', error);
      handleNotify('error', 'Failed to create sponsor. Falling back to memory storage.');
      setSponsors(prev => [...prev, { ...sponsor, orgId: currentOrgId }]);
    }
  };

  const handleUpdateSponsor = async (sponsor: Sponsor) => {
    try {
      console.info('[App] Updating sponsor:', sponsor);
      const updated = await dataService.updateSponsor(sponsor.id, sponsor);
      setSponsors(prev => prev.map(s => s.id === sponsor.id ? updated : s));
      handleNotify('success', `Sponsor "${updated.name}" updated successfully`);
    } catch (error) {
      console.error('[App] Error updating sponsor:', error);
      handleNotify('error', 'Failed to update sponsor. Falling back to memory storage.');
      setSponsors(prev => prev.map(s => s.id === sponsor.id ? sponsor : s));
    }
  };

  const handleDeleteSponsor = async (id: string) => {
    try {
      console.info('[App] Checking sponsor usage before deletion:', id);
      
      // Check if sponsor is used in other modules
      const usage = await dataService.checkSponsorUsage(id);
      if (usage.isUsed) {
        const message = `Cannot delete sponsor. Referenced in: ${usage.usedIn.join(', ')}`;
        handleNotify('error', message);
        return false;
      }

      // Proceed with hard delete
      console.info('[App] Deleting sponsor:', id);
      await dataService.deleteSponsor(id);
      setSponsors(prev => prev.filter(s => s.id !== id));
      handleNotify('success', 'Sponsor deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting sponsor:', error);
      handleNotify('error', 'Failed to delete sponsor. Falling back to memory storage.');
      setSponsors(prev => prev.filter(s => s.id !== id));
      return true;
    }
  };

  // ============================================================================
  // FIXED ASSET CRUD HANDLERS
  // ============================================================================

  const handleAddFixedAsset = async (asset: FixedAsset) => {
    try {
      console.info('[App] Creating fixed asset:', asset.name);
      const assetWithOrg = { ...asset, orgId: currentOrgId };
      const savedAsset = await dataService.createFixedAsset(assetWithOrg);
      setFixedAssets(prev => [...prev, savedAsset]);
      handleNotify('success', `Fixed asset "${asset.name}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating fixed asset:', error);
      handleNotify('error', 'Failed to create fixed asset. Falling back to memory storage.');
      const assetWithOrg = { ...asset, orgId: currentOrgId };
      setFixedAssets(prev => [...prev, assetWithOrg]);
    }
  };

  const handleUpdateFixedAsset = async (id: string, updates: Partial<FixedAsset>) => {
    try {
      console.info('[App] Updating fixed asset:', id);
      const updated = await dataService.updateFixedAsset(id, updates);
      setFixedAssets(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a));
      handleNotify('success', 'Fixed asset updated successfully');
    } catch (error) {
      console.error('[App] Error updating fixed asset:', error);
      handleNotify('error', 'Failed to update fixed asset. Falling back to memory storage.');
      setFixedAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    }
  };

  const handleDeleteFixedAsset = async (id: string) => {
    try {
      console.info('[App] Deleting fixed asset:', id);
      await dataService.deleteFixedAsset(id);
      setFixedAssets(prev => prev.filter(a => a.id !== id));
      handleNotify('success', 'Fixed asset deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting fixed asset:', error);
      handleNotify('error', 'Failed to delete fixed asset. Falling back to memory storage.');
      setFixedAssets(prev => prev.filter(a => a.id !== id));
    }
  };

  const handleDepreciate = async (assetId: string) => {
    try {
      const asset = fixedAssets.find(a => a.id === assetId);
      if (!asset) {
        handleNotify('error', 'Asset not found');
        return;
      }

      // Calculate monthly depreciation: Purchase Cost / (Useful Life Years * 12)
      const monthlyDepreciation = asset.purchaseCost / (asset.usefulLifeYears * 12);
      
      // Generate entry ID
      const entryId = `depr-${Date.now()}`;

      // Create depreciation lines with proper journalEntryId reference
      const deprLines: JournalEntryLine[] = [
        {
          id: `line-${Date.now()}-debit`,
          journalEntryId: entryId,
          accountId: '', // Depreciation expense account - will use blank for now
          debit: monthlyDepreciation,
          credit: 0,
          description: `Depreciation expense - ${asset.name}`,
          assetId: assetId
        },
        {
          id: `line-${Date.now()}-credit`,
          journalEntryId: entryId,
          accountId: asset.glAccountId, // Fixed Asset account
          debit: 0,
          credit: monthlyDepreciation,
          description: `Accumulated depreciation - ${asset.name}`,
          assetId: assetId
        }
      ];

      // Create depreciation journal entry with double-entry accounting
      const newEntry: JournalEntry = {
        id: entryId,
        orgId: currentOrgId,
        entryDate: new Date().toISOString().split('T')[0],
        referenceNumber: `DEP-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
        description: `Monthly depreciation for ${asset.name}`,
        sourceType: 'DEPRECIATION',
        isPosted: true,
        lines: deprLines,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDeleted: false
      };

      // Add to journal entries and lines
      setJournalEntries(prev => [...prev, newEntry]);
      setJournalEntryLines(prev => [...prev, ...deprLines]);

      // Update accumulated depreciation on the asset
      const newAccumulated = (asset.accumulatedDepreciation || 0) + monthlyDepreciation;
      await handleUpdateFixedAsset(assetId, { accumulatedDepreciation: newAccumulated });

      handleNotify('success', `Depreciation of ${monthlyDepreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })} recorded successfully`);
    } catch (error) {
      console.error('[App] Error recording depreciation:', error);
      handleNotify('error', 'Failed to record depreciation');
    }
  };

  // Item Catalog Handlers
  const handleAddItem = async (item: NonStockItem) => {
    try {
      console.info('[App] Creating item:', item.name);
      const itemWithOrg = { ...item, orgId: currentOrgId };
      const savedItem = await dataService.createItem(itemWithOrg);
      setItems(prev => [...prev, savedItem]);
      handleNotify('success', `Item "${item.name}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating item:', error);
      handleNotify('error', 'Failed to create item. Falling back to memory storage.');
      const itemWithOrg = { ...item, orgId: currentOrgId };
      setItems(prev => [...prev, itemWithOrg]);
    }
  };

  const handleUpdateItem = async (id: string, updates: Partial<NonStockItem>) => {
    try {
      console.info('[App] Updating item:', id);
      const updated = await dataService.updateItem(id, updates);
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));
      handleNotify('success', 'Item updated successfully');
    } catch (error) {
      console.error('[App] Error updating item:', error);
      handleNotify('error', 'Failed to update item. Falling back to memory storage.');
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      console.info('[App] Deleting item:', id);
      await dataService.deleteItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
      handleNotify('success', 'Item deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting item:', error);
      handleNotify('error', 'Failed to delete item. Falling back to memory storage.');
      setItems(prev => prev.filter(i => i.id !== id));
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white gap-6">
        <div className="p-5 bg-indigo-600 rounded-[2rem] shadow-2xl shadow-indigo-500/20 animate-pulse">
           <Building2 size={40} />
        </div>
        <div className="flex items-center gap-3">
           <Loader2 className="animate-spin text-indigo-400" size={24} />
           <span className="text-sm font-black uppercase tracking-[0.3em]">Initializing Ledger Architecture</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} onRegister={handleRegisterWithPersistence} organizations={organizations} users={users} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      <aside className={`${sidebarOpen ? 'w-80' : 'w-20'} bg-slate-950 flex flex-col transition-all duration-500 z-50 border-r border-white/5`}>
        <div className="p-8 flex items-center justify-between border-b border-white/5 bg-slate-900/50">
           {sidebarOpen ? (
             <div className="flex items-center gap-3 flex-1 min-w-0">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg overflow-hidden shrink-0"
                  style={{ backgroundColor: brandColor }}
                >
                   {currentOrg?.logoUrl ? <img src={currentOrg.logoUrl} className="w-full h-full object-cover" /> : <Building2 size={20} />}
                </div>
                <div className="min-w-0 flex-1">
                   <h1 className="text-sm font-black text-white uppercase tracking-tighter truncate">{currentOrg?.name || 'No Organization'}</h1>
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
           {/* Navigation Items (unchanged logic) */}
           {currentUser.role === 'STUDENT' && (
             <div className="mb-8">
               {sidebarOpen && <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">Learner Portal</p>}
               <NavItem icon={<LayoutDashboard size={20}/>} label="Dashboard" active={activeTab === 'student-portal'} onClick={() => setActiveTab('student-portal')} compact={!sidebarOpen} brandColor={brandColor} />
             </div>
           )}

           {currentUser.role === 'TRAINER' && (
             <div className="mb-8">
               {sidebarOpen && <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">Instructor Portal</p>}
               <NavItem icon={<LayoutDashboard size={20}/>} label="Trainer Console" active={activeTab === 'trainer-portal'} onClick={() => setActiveTab('trainer-portal')} compact={!sidebarOpen} brandColor={brandColor} />
             </div>
           )}

           {isFinance && (
             <div className="mb-8">
               {sidebarOpen && <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">Financial Core</p>}
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

           {isRegistrar && (
             <div className="mb-8">
               {sidebarOpen && <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">Operations</p>}
               <NavItem icon={<Users size={20}/>} label="Learners" active={activeTab === 'students'} onClick={() => setActiveTab('students')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<GraduationCap size={20}/>} label="Trainers" active={activeTab === 'trainers'} onClick={() => setActiveTab('trainers')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Award size={20}/>} label="Qualifications" active={activeTab === 'qualifications'} onClick={() => setActiveTab('qualifications')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Layers size={20}/>} label="Training Batches" active={activeTab === 'batches'} onClick={() => setActiveTab('batches')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<MapPin size={20}/>} label="Locations" active={activeTab === 'locations'} onClick={() => setActiveTab('locations')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<CalendarClock size={20}/>} label="Scheduling" active={activeTab === 'schedules'} onClick={() => setActiveTab('schedules')} compact={!sidebarOpen} brandColor={brandColor} />
             </div>
           )}

           {isFinance && (
             <div className="mb-8">
               {sidebarOpen && <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">Registries</p>}
               <NavItem icon={<Handshake size={20}/>} label="Sponsors" active={activeTab === 'sponsors'} onClick={() => setActiveTab('sponsors')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Truck size={20}/>} label="Vendors" active={activeTab === 'vendors'} onClick={() => setActiveTab('vendors')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Tag size={20}/>} label="Item Catalog (Non-Stock)" active={activeTab === 'items'} onClick={() => setActiveTab('items')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Box size={20}/>} label="Fixed Assets" active={activeTab === 'assets'} onClick={() => setActiveTab('assets')} compact={!sidebarOpen} brandColor={brandColor} />
             </div>
           )}

           {isTenantAdmin && (
             <div className="mb-8">
               {sidebarOpen && <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">Administration</p>}
               <NavItem icon={<Users size={20}/>} label="Employees" active={activeTab === 'employees'} onClick={() => setActiveTab('employees')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Settings size={20}/>} label="G/L Setup (COA)" active={activeTab === 'coa'} onClick={() => setActiveTab('coa')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Palette size={20}/>} label="Branding & Motif" active={activeTab === 'branding'} onClick={() => setActiveTab('branding')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Wallet size={20}/>} label="Subscription" active={activeTab === 'subscription'} onClick={() => setActiveTab('subscription')} compact={!sidebarOpen} brandColor={brandColor} />
               <div className="relative">
                 <NavItem icon={<CreditCard size={20}/>} label="Payment History" active={activeTab === 'payment-history'} onClick={() => setActiveTab('payment-history')} compact={!sidebarOpen} brandColor={brandColor} />
                 {paymentsDueSoon.length > 0 && (
                   <div className="absolute top-2 right-2 bg-rose-500 text-white text-[9px] font-black px-2 py-1 rounded-full">
                     {paymentsDueSoon.length}
                   </div>
                 )}
               </div>
               <NavItem icon={<UserCog size={20}/>} label="Security/RBAC" active={activeTab === 'users'} onClick={() => setActiveTab('users')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<History size={20}/>} label="Audit Trail" active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} compact={!sidebarOpen} brandColor={brandColor} />
             </div>
           )}

           {isSysAdmin && (
             <div className="mb-8">
               {sidebarOpen && <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">System Administration</p>}
               <NavItem icon={<Wrench size={20}/>} label="Maintenance" active={activeTab === 'maintenance'} onClick={() => setActiveTab('maintenance')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Terminal size={20}/>} label="Tenant Mgmt" active={activeTab === 'tenant-mgmt'} onClick={() => setActiveTab('tenant-mgmt')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Binary size={20}/>} label="Data Schema" active={activeTab === 'schema'} onClick={() => setActiveTab('schema')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<BarChart2 size={20}/>} label="Payment Monitoring" active={activeTab === 'payment-monitoring'} onClick={() => setActiveTab('payment-monitoring')} compact={!sidebarOpen} brandColor={brandColor} />
             </div>
           )}
        </nav>

        {/* System Data Engine Status Badge - SYSTEM_ADMIN only */}
        {sidebarOpen && isSysAdmin && (
          <div className="px-8 mb-4">
             <div className={`p-3 rounded-2xl border flex items-center gap-3 transition-all ${config.useMockData ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                {config.useMockData ? <Database size={16} /> : <Cloud size={16} />}
                <div className="min-w-0">
                   <p className="text-[8px] uppercase tracking-widest leading-none mb-1">Engine Active</p>
                   <p className="text-[10px] uppercase truncate">{config.useMockData ? 'MOCK_LOCAL' : 'SUPABASE_CLOUD'}</p>
                </div>
             </div>
          </div>
        )}

        <div className="p-6 mt-auto border-t border-white/5">
           <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 text-slate-500 hover:text-white transition-colors rounded-xl hover:bg-white/5">
              <LogOut size={20} />
              {sidebarOpen && <span className="text-xs font-black uppercase tracking-widest">Logout</span>}
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header and Content Area (unchanged) */}
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
              {isFinance && !['PRESIDENT', 'REGISTRAR', 'TRAINER', 'STUDENT'].includes(currentUser?.role || '') && (
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
          {/* View Router (unchanged) */}
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
              brandColor={brandColor}
              onUpdateTrainer={handleUpdateTrainer}
            />
          )}

          {activeTab === 'dashboard' && <Dashboard summaries={summaries} currency={currentOrg?.currency} lines={filteredLines} accounts={filteredAccounts} />}
          {activeTab === 'ledger' && <Ledger accounts={filteredAccounts} entries={activeJournalEntries} lines={filteredLines} />}
          {activeTab === 'reports' && <Reports summaries={summaries} accounts={filteredAccounts} entries={activeJournalEntries} lines={filteredLines} qualifications={qualifications} batches={batches} orgName={currentOrg?.name} currency={currentOrg?.currency} logoUrl={currentOrg?.logoUrl} />}
          
          {activeTab === 'ar' && <ARView entries={activeJournalEntries} lines={filteredLines} students={students} sponsors={sponsors} items={items} accounts={filteredAccounts} bankAccounts={bankAccounts} onPostInvoice={handlePostJournal} onNotify={handleNotify} />}
          {activeTab === 'ap' && <APView vendors={vendors} entries={activeJournalEntries} lines={filteredLines} items={items} accounts={filteredAccounts} bankAccounts={bankAccounts} onPostBill={handlePostJournal} onNotify={handleNotify} />}
          {activeTab === 'po' && <PurchaseOrdersView purchaseOrders={purchaseOrders} vendors={vendors} items={items} onCreatePO={po => setPurchaseOrders(p => [...p, po])} onUpdateStatus={(id, s) => setPurchaseOrders(p => p.map(x => x.id === id ? {...x, status: s} : x))} onConvertToBill={handleConvertToBill} />}
          
          {activeTab === 'coa' && <ChartOfAccounts accounts={filteredAccounts} lines={filteredLines} qualifications={qualifications} onAddAccount={a => setAccounts(p => [...p, a])} onUpdateAccount={a => setAccounts(p => p.map(x => x.id === a.id ? a : x))} onDeleteAccount={id => setAccounts(p => p.filter(x => x.id !== id))} />}
          {activeTab === 'items' && <ItemsView items={items.filter(i => i.orgId === currentOrgId && !i.isDeleted)} accounts={filteredAccounts} onAddItem={handleAddItem} onUpdateItem={handleUpdateItem} onDeleteItem={handleDeleteItem} />}
          {activeTab === 'sponsors' && <SponsorsView sponsors={sponsors.filter(s => s.orgId === currentOrgId && !s.isDeleted)} onAddSponsor={handleAddSponsor} onUpdateSponsor={handleUpdateSponsor} onDeleteSponsor={handleDeleteSponsor} />}
          {activeTab === 'vendors' && <VendorsView vendors={vendors} accounts={filteredAccounts} lines={filteredLines} onAddVendor={v => setVendors(p => [...p, v])} onUpdateVendor={v => setVendors(p => p.map(x => x.id === v.id ? v : x))} onDeleteVendor={id => setVendors(p => p.filter(x => x.id !== id))} />}
          {activeTab === 'assets' && <AssetsView assets={fixedAssets.filter(a => a.orgId === currentOrgId && !a.isDeleted)} accounts={filteredAccounts} lines={filteredLines} entries={activeJournalEntries} onDepreciate={handleDepreciate} onAddAsset={handleAddFixedAsset} onUpdateAsset={handleUpdateFixedAsset} onDeleteAsset={handleDeleteFixedAsset} onNotify={handleNotify} />}
          {activeTab === 'banking' && <BankingView bankAccounts={bankAccounts.filter(b => b.orgId === currentOrgId && !b.isDeleted)} summaries={summaries} accounts={filteredAccounts} entries={activeJournalEntries} lines={filteredLines} onAddBankAccount={b => setBankAccounts(prev => [...prev, {...b, orgId: currentOrgId} as BankAccount])} onPostTransfer={handlePostJournal} onToggleClearLine={id => setJournalLines(prev => prev.map(l => l.id === id ? {...l, isCleared: !l.isCleared} : l))} onNotify={handleNotify} />}
          
          {activeTab === 'branding' && currentOrg && <BrandingView organization={currentOrg} onUpdate={o => handleUpdateOrganization(o.id, o)} />}
          {activeTab === 'subscription' && currentOrg && <SubscriptionView organization={currentOrg} onUpdate={o => handleUpdateOrganization(o.id, o)} />}
          {activeTab === 'payment-history' && currentOrg && <PaymentHistoryView payments={payments.filter(p => p.orgId === currentOrgId)} currency={currentOrg.currency} />}
          
          {activeTab === 'payroll' && <PayrollView employees={employees.filter(e => e.orgId === currentOrgId && !e.isDeleted)} payrollRuns={payrollRuns} payrollLines={payrollLines} accounts={filteredAccounts} bankAccounts={bankAccounts} entries={activeJournalEntries} orgName={currentOrg?.name} onPostPayroll={(r, l, e, el) => { setPayrollRuns(prev => [...prev, r as PayrollRun]); setPayrollLines(prev => [...prev, ...l as PayrollLine[]]); handlePostJournal(e, el); }} />}
          {activeTab === 'students' && <StudentsView students={students.filter(s => s.orgId === currentOrgId)} onAddStudent={handleAddStudent} onUpdateStudent={handleUpdateStudent} onDeleteStudent={handleDeleteStudent} onBatchAddStudents={handleBatchAddStudents} />}
          {activeTab === 'trainers' && <TrainersView trainers={trainers.filter(t => t.orgId === currentOrgId && !t.isDeleted)} qualifications={qualifications} onAddTrainer={handleAddTrainer} onUpdateTrainer={handleUpdateTrainer} onDeleteTrainer={handleDeleteTrainer} />}
          {activeTab === 'qualifications' && <QualificationsView qualifications={qualifications.filter(q => q.orgId === currentOrgId && !q.isDeleted)} onAddQualification={handleAddQualification} onUpdateQualification={handleUpdateQualification} onDeleteQualification={handleDeleteQualification} />}
          {activeTab === 'batches' && <BatchesView batches={batches.filter(b => b.orgId === currentOrgId && !b.isDeleted)} qualifications={qualifications} trainers={trainers} students={students} sponsors={sponsors} schedules={schedules} locations={locations} onAddBatch={handleAddBatch} onUpdateBatch={handleUpdateBatch} onDeleteBatch={handleDeleteBatch} onNotify={handleNotify} />}
          {activeTab === 'locations' && <LocationsView locations={locations.filter(l => l.orgId === currentOrgId && !l.isDeleted)} onAddLocation={handleAddLocation} onUpdateLocation={handleUpdateLocation} onDeleteLocation={handleDeleteLocation} />}
          {activeTab === 'schedules' && <SchedulesView schedules={schedules.filter(s => s.orgId === currentOrgId && !s.isDeleted)} trainers={trainers.filter(t => t.orgId === currentOrgId && !t.isDeleted)} locations={locations.filter(l => l.orgId === currentOrgId && !l.isDeleted)} onAddSchedule={handleAddSchedule} onUpdateSchedule={handleUpdateSchedule} onDeleteSchedule={handleDeleteSchedule} />}
          {activeTab === 'budgets' && <BudgetView accounts={filteredAccounts} summaries={summaries} budgets={[]} budgetLines={[]} onSaveBudget={() => {}} />}
          
          {activeTab === 'employees' && <EmployeesView 
            employees={employees.filter(e => e.orgId === currentOrgId && !e.isDeleted)} 
            onAddEmployee={(emp) => { emp.orgId = currentOrgId; setEmployees(p => [...p, emp]); }} 
            onUpdateEmployee={(emp) => setEmployees(p => p.map(x => x.id === emp.id ? emp : x))} 
            onDeleteEmployee={(id) => setEmployees(p => p.map(x => x.id === id ? { ...x, isDeleted: true, deletedAt: new Date().toISOString() } : x))} 
          />}
          {activeTab === 'users' && <UsersManagementView users={users.filter(u => u.orgId === currentOrgId)} onAddUser={handleAddUser} onDeleteUser={handleDeleteUser} />}
          {activeTab === 'audit' && <AuditTrail logs={auditLogs} />}
          {activeTab === 'maintenance' && <MaintenanceView logs={auditLogs} onExport={() => {}} onImport={() => {}} />}
          {activeTab === 'tenant-mgmt' && <TenantManagementView organizations={organizations} onAddTenant={handleAddOrganization} onUpdateTenant={o => handleUpdateOrganization(o.id, o)} />}
          {activeTab === 'schema' && <SchemaManualView />}
          {activeTab === 'payment-monitoring' && <PaymentMonitoringView payments={payments} organizations={organizations} />}
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
      {!compact && <span className="text-[11px] uppercase tracking-widest truncate">{label}</span>}
    </button>
  );
}
