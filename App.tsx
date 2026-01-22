
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Organization, User, Student, Qualification, Trainer, Batch, Sponsor, NonStockItem, Vendor, FixedAsset, BankAccount, Location, TrainerSchedule, Employee, PayrollRun, PayrollLine, JournalEntry, JournalEntryLine, AuditLog, Budget, BudgetLine, AccountClass, TransactionSummary, ChartOfAccount, PurchaseOrder, PurchaseOrderStatus, PaymentHistory, Payable, AccountingPeriod, CheckVoucher, EFTBatch, GoodsReceipt, BankReconciliation, WarehouseLocation, StockItem, InventoryLevel, InventoryTransaction, StockAdjustment, ReorderPoint
} from './types';
import { AccountingService } from './accountingService';
import { DataServiceFactory } from './services/DataServiceFactory';
import { authService } from './services/AuthService';
import { AuditService } from './services/AuditService';
import { config } from './config/app';
import { useNotifications } from './components/NotificationContext';

// View Imports
import Dashboard from './views/Dashboard';
import Ledger from './views/Ledger';
import Reports from './views/Reports';
import ChartOfAccounts from './views/ChartOfAccounts';
import LoginView from './views/LoginView';
import PasswordResetView from './views/PasswordResetView';
import StudentsView from './views/StudentsView';
import QualificationsView from './views/QualificationsView';
import TrainersView from './views/TrainersView';
import BatchesView from './views/BatchesView';
import LocationsView from './views/LocationsView';
import SponsorsView from './views/SponsorsView';
import ItemsView from './views/ItemsView';
import BankingView from './views/BankingView';
import AssetsView from './views/AssetsView';
import ARView from './views/ARView';
import PayablesView from './views/PayablesView';
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
import PeriodClosingView from './views/PeriodClosingView';
import CheckPrintingView from './views/CheckPrintingView';
import EFTBatchView from './views/EFTBatchView';
import GoodsReceiptView from './views/GoodsReceiptView';
import WarehouseLocationsView from './views/WarehouseLocationsView';
import StockItemsView from './views/StockItemsView';
import InventoryView from './views/InventoryView';
import StockAdjustmentsView from './views/StockAdjustmentsView';
import ReorderView from './views/ReorderView';
import InventoryTransactionsView from './views/InventoryTransactionsView';
import AdvancedInventoryReports from './views/AdvancedInventoryReports';

// Lucide Icons
import { 
  LayoutDashboard, BookText, PieChart, Landmark, Users, 
  Award, GraduationCap, Layers, MapPin, Handshake, 
  Truck, Box, CalendarClock, ShoppingCart, ShieldCheck, 
  History, UserCog, Settings, Palette, CreditCard, 
  Binary, Terminal, Receipt, Calculator, Briefcase, 
  LogOut, Menu, X, PlusCircle, Building2, Wrench,
  FileText, Tag, Wallet, Activity, Loader2, Database,
  Cloud, BarChart2, CalendarCheck, Printer, Zap, Package,
  CheckCircle2, AlertCircle
} from 'lucide-react';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Password Reset State
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  
  // Data service reference for CRUD operations
  const [dataService] = useState(() => DataServiceFactory.getService());


  // Check for password reset or email verification token in URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('reset_token');
    if (resetToken) {
      setResetToken(resetToken);
      setShowPasswordReset(true);
      console.info('[App] Password reset token detected in URL');
      return;
    }
    const verifyToken = urlParams.get('verify_email_token');
    if (verifyToken) {
      handleVerifyEmailToken(verifyToken);
    }
  }, []);

  // Email verification handler
  const handleVerifyEmailToken = async (token: string) => {
    const { emailVerificationService } = await import('./services/EmailVerificationService');
    const entry = emailVerificationService.validateToken(token);
    if (entry) {
      emailVerificationService.markTokenUsed(token);
      // Mark user as verified in users state and persist
      setUsers(prev => prev.map(u => u.id === entry.userId ? { ...u, isEmailVerified: true } : u));
      await dataService.updateUser(entry.userId, { isEmailVerified: true });
      handleNotify('success', 'Email verified successfully! You may now log in.');
    } else {
      handleNotify('error', 'Invalid or expired verification link.');
    }
  };

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
  const handleLogout = async () => {
    // Audit: Logout event (log before clearing user)
    if (currentUser) {
      AuditService.logout(currentOrgId, currentUser.id, currentUser.name);
    }
    
    await authService.logout();
    setCurrentUser(null);
    setCurrentOrgId('');
    console.info('[App] User logged out - JWT tokens revoked');
  };

  // Master Data State
  const [students, setStudents] = useState<Student[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [items, setItems] = useState<NonStockItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorTaxSettings, setVendorTaxSettings] = useState<any[]>([]);
  const [atcCategories, setAtcCategories] = useState<any[]>([]);
  const [atcItems, setAtcItems] = useState<any[]>([]);
  const [atcRates, setAtcRates] = useState<any[]>([]);
  const [exchangeRates, setExchangeRates] = useState<any[]>([]);
  const [accountingPeriods, setAccountingPeriods] = useState<any[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [schedules, setSchedules] = useState<TrainerSchedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankReconciliations, setBankReconciliations] = useState<any[]>([]);
  const [recurringJournalEntries, setRecurringJournalEntries] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);

  // Inventory Management State
  const [warehouseLocations, setWarehouseLocations] = useState<WarehouseLocation[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [inventoryLevels, setInventoryLevels] = useState<InventoryLevel[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([]);
  const [reorderPoints, setReorderPoints] = useState<ReorderPoint[]>([]);

  // Advanced AP Features State
  const [checkVouchers, setCheckVouchers] = useState<CheckVoucher[]>([]);
  const [eftBatches, setEftBatches] = useState<EFTBatch[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);

  // Financial Cycle State
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalLines, setJournalLines] = useState<JournalEntryLine[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [payrollLines, setPayrollLines] = useState<PayrollLine[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Initialize AuditService callback to add logs to state
  useEffect(() => {
    AuditService.setCallback((log: AuditLog) => {
      setAuditLogs(prev => [...prev, log]);
    });
  }, []);

  // Modals
  const [showJournalForm, setShowJournalForm] = useState(false);

  // Toast Notification State
  const [toasts, setToasts] = useState<Array<{id: number; type: 'success' | 'error' | 'info'; message: string}>>([]);
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
        setBankReconciliations(data.bankReconciliations);
        setRecurringJournalEntries(data.recurringJournalEntries || []);
        setAccounts(data.accounts);
        setJournalEntries(data.journalEntries);
        setJournalLines(data.journalLines);
        setPayrollRuns(data.payrollRuns);
        setPayrollLines(data.payrollLines);
        setAuditLogs(data.auditLogs);
        setPurchaseOrders(data.purchaseOrders);
        setPayments(data.paymentHistories);
        setFixedAssets(data.fixedAssets);
        setPayables(data.payables || []);
        setVendorTaxSettings(data.vendorTaxSettings || []);
        setAtcCategories(data.atcCategories || []);
        setAtcItems(data.atcItems || []);
        setAtcRates(data.atcRates || []);
        
        // Load Inventory Data
        setWarehouseLocations(data.warehouseLocations || []);
        setStockItems(data.stockItems || []);
        setInventoryLevels(data.inventoryLevels || []);
        setInventoryTransactions(data.inventoryTransactions || []);
        setStockAdjustments(data.stockAdjustments || []);
        setReorderPoints(data.reorderPoints || []);
        
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

  // Fetch Accounting Periods when organization changes
  useEffect(() => {
    if (!currentOrgId) {
      setAccountingPeriods([]);
      return;
    }

    async function loadPeriods() {
      try {
        console.log('[App] Fetching accounting periods for org:', currentOrgId);
        const service = DataServiceFactory.getService();
        const periods = await service.getAccountingPeriodsByOrg(currentOrgId);
        console.log('[App] Loaded periods:', periods.length);
        setAccountingPeriods(periods);
      } catch (error) {
        console.error('[App] Error loading periods:', error);
        setAccountingPeriods([]);
      }
    }

    loadPeriods();
  }, [currentOrgId]);

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

  // Persistent notification handler
  const { addNotification } = useNotifications();
  const handleNotify = (type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    addNotification(type, message);
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
    
    // Audit: User login
    AuditService.login(user.orgId || '', user.id, user.name);
    
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
    
    // Audit: Journal entry posted
    AuditService.post(
      currentOrgId,
      currentUser?.id || 'system',
      currentUser?.name || 'System',
      'JOURNAL_ENTRY',
      fullEntry.id,
      fullEntry.id,
      `Posted ${fullEntry.sourceType}: ${fullEntry.description} (${lines.length} lines)`
    );
  };

  const handleConvertToBill = (po: PurchaseOrder) => {
    setActiveTab('payables');
    handleNotify('info', `PO ${po.reference} converted for Bill processing.`);
  };

  const handleAddPayable = async (payable: Payable) => {
    try {
      const fullPayable = {
        ...payable,
        orgId: currentOrgId,
        createdBy: currentUser?.id || 'system'
      } as Payable;
      const savedPayable = await dataService.createPayable(fullPayable);
      setPayables(prev => [...prev, savedPayable]);
      
      // Audit: Payable created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'PAYABLE', savedPayable.id, payable.payableNumber);
      
      handleNotify('success', `Payable ${payable.payableNumber} created successfully`);
    } catch (error) {
      console.error('[App] Error creating payable:', error);
      handleNotify('error', 'Failed to create payable. Falling back to memory storage.');
      // Fallback to memory storage if Supabase fails
      const fullPayable = {
        ...payable,
        orgId: currentOrgId,
        createdBy: currentUser?.id || 'system'
      } as Payable;
      setPayables(prev => [...prev, fullPayable]);
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'PAYABLE', fullPayable.id, payable.payableNumber);
    }
  };

  const handleUpdatePayable = async (id: string, updates: Partial<Payable>) => {
    try {
      console.info('[App] Updating payable:', id);
      const existing = payables.find(p => p.id === id);
      const updated = await dataService.updatePayable(id, updates);
      setPayables(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
      
      // Audit: Payable updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'PAYABLE', id, existing?.payableNumber, existing, { ...existing, ...updates });
      
      handleNotify('success', 'Payable updated successfully');
    } catch (error) {
      console.error('[App] Error updating payable:', error);
      handleNotify('error', 'Failed to update payable. Falling back to memory storage.');
      // Fallback to memory storage
      setPayables(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    }
  };

  const handleDeletePayable = async (id: string) => {
    try {
      console.info('[App] Deleting payable:', id);
      const existing = payables.find(p => p.id === id);
      await dataService.deletePayable(id);
      setPayables(prev => prev.filter(p => p.id !== id));
      
      // Audit: Payable deleted
      AuditService.delete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'PAYABLE', id, existing?.payableNumber);
      
      handleNotify('success', 'Payable deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting payable:', error);
      handleNotify('error', 'Failed to delete payable. Falling back to memory storage.');
      // Fallback to memory storage (soft delete)
      setPayables(prev => prev.map(p => p.id === id ? { ...p, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: currentUser?.id } : p));
    }
  };

  // ============================================================================
  // ORGANIZATION & USER HANDLERS WITH SUPABASE PERSISTENCE
  // ============================================================================

  const handleAddOrganization = async (org: Organization) => {
    try {
      console.info('[App] Creating organization:', org.name);
      const savedOrg = await dataService.createOrganization(org);
      setOrganizations(prev => [...prev, savedOrg]);
      
      // Audit: Organization created
      AuditService.create(savedOrg.id, currentUser?.id || 'system', currentUser?.name || 'System', 'ORGANIZATION', savedOrg.id, org.name);
      
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
      const existing = organizations.find(o => o.id === id);
      const updated = await dataService.updateOrganization(id, updates);
      setOrganizations(prev => prev.map(o => o.id === id ? { ...o, ...updated } : o));
      
      // Audit: Organization updated
      AuditService.update(id, currentUser?.id || 'system', currentUser?.name || 'System', 'ORGANIZATION', id, existing?.name, existing, { ...existing, ...updates });
      
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
      const existing = organizations.find(o => o.id === id);
      await dataService.deleteOrganization(id);
      setOrganizations(prev => prev.filter(o => o.id !== id));
      
      // Audit: Organization deleted
      AuditService.hardDelete(id, currentUser?.id || 'system', currentUser?.name || 'System', 'ORGANIZATION', id, existing?.name);
      
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
    // Require authenticated Supabase session
    const session = authService.getSession();
    if (!session || !session.user) {
      handleNotify('error', 'You must be logged in with a valid Supabase account to create users.');
      return;
    }
    // RBAC: SYSTEM_ADMIN can create for any org, ADMIN only for their own org, others denied
    const isSysAdmin = session.user.role === 'SYSTEM_ADMIN';
    const isAdmin = session.user.role === 'ADMIN';
    const creatingForOwnOrg = user.orgId === session.user.orgId || !user.orgId || user.orgId === currentOrgId;
    if (!isSysAdmin && !(isAdmin && creatingForOwnOrg)) {
      handleNotify('error', 'You do not have permission to create users for this organization.');
      return;
    }
    // Use session user for audit
    const auditUserId = session.user.id;
    const auditUserName = session.user.name;
    try {
      console.info('[App] Creating user:', user.email);
      // SYSTEM_ADMIN can set any orgId, ADMIN is forced to their own org
      const userWithOrg = isSysAdmin ? { ...user } : { ...user, orgId: session.user.orgId };
      const savedUser = await dataService.createUser(userWithOrg);
      setUsers(prev => [...prev, savedUser]);
      // Audit: User created
      AuditService.create(currentOrgId, auditUserId, auditUserName, 'USER', savedUser.id, user.name);
      // Email Verification: Send verification email if not verified
      if (!savedUser.isEmailVerified) {
        const { emailVerificationService } = await import('./services/EmailVerificationService');
        const { emailSenderService } = await import('./services/EmailSenderService');
        const tokenEntry = emailVerificationService.generateToken(savedUser.id, savedUser.email);
        await emailSenderService.sendVerificationEmail(savedUser.email, tokenEntry.token);
        handleNotify('info', `Verification email sent to ${savedUser.email}`);
      }
      handleNotify('success', `User "${user.name}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating user:', error);
      handleNotify('error', 'Failed to create user. Falling back to memory storage.');
      // Fallback to memory storage
      const userWithOrg = isSysAdmin ? { ...user } : { ...user, orgId: session.user.orgId };
      setUsers(prev => [...prev, userWithOrg]);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      console.info('[App] Deleting user:', id);
      const existing = users.find(u => u.id === id);
      await dataService.deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      
      // Audit: User deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'USER', id, existing?.name);
      
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
      
      // Audit: New organization registered
      AuditService.log({
        orgId: savedOrg.id,
        userId: savedAdmin.id,
        userName: savedAdmin.name,
        action: 'CREATE',
        entityType: 'ORGANIZATION',
        entityId: savedOrg.id,
        entityName: savedOrg.name,
        details: `New organization registered with admin user: ${savedAdmin.name}`
      });
      
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
      
      // Audit: Student created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'STUDENT', savedStudent.id, `${student.firstName} ${student.lastName}`);
      
      handleNotify('success', `Student "${student.firstName} ${student.lastName}" registered successfully`);
    } catch (error) {
      console.error('[App] Error creating student:', error);
      handleNotify('error', 'Failed to create student. Falling back to memory storage.');
      const studentWithOrg = { ...student, orgId: currentOrgId };
      setStudents(prev => [...prev, studentWithOrg]);
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'STUDENT', student.id, `${student.firstName} ${student.lastName}`);
    }
  };

  const handleUpdateStudent = async (student: Student) => {
    try {
      console.info('[App] Updating student:', student.id);
      const existing = students.find(s => s.id === student.id);
      const updated = await dataService.updateStudent(student.id, student);
      setStudents(prev => prev.map(s => s.id === student.id ? updated : s));
      
      // Audit: Student updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'STUDENT', student.id, `${student.firstName} ${student.lastName}`, existing, student);
      
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
      const existing = students.find(s => s.id === id);
      
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
      
      // Audit: Student deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'STUDENT', id, existing ? `${existing.firstName} ${existing.lastName}` : undefined);
      
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
      
      // Audit: Trainer created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'TRAINER', savedTrainer.id, `${trainer.firstName} ${trainer.lastName}`);
      
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
      const existing = trainers.find(t => t.id === trainer.id);
      const updated = await dataService.updateTrainer(trainer.id, trainer);
      setTrainers(prev => prev.map(t => t.id === trainer.id ? updated : t));
      
      // Audit: Trainer updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'TRAINER', trainer.id, `${trainer.firstName} ${trainer.lastName}`, existing, trainer);
      
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
      const existing = trainers.find(t => t.id === id);
      
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
      
      // Audit: Trainer deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'TRAINER', id, existing ? `${existing.firstName} ${existing.lastName}` : undefined);
      
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
      
      // Audit: Qualification created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'QUALIFICATION', savedQual.id, qualification.name);
      
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
      const existing = qualifications.find(q => q.id === qualification.id);
      const updated = await dataService.updateQualification(qualification.id, qualification);
      setQualifications(prev => prev.map(q => q.id === qualification.id ? updated : q));
      
      // Audit: Qualification updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'QUALIFICATION', qualification.id, qualification.name, existing, qualification);
      
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
      const existing = qualifications.find(q => q.id === id);
      
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
      
      // Audit: Qualification deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'QUALIFICATION', id, existing?.name);
      
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
      
      // Audit: Location created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'LOCATION', created.id, location.name);
      
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
      const existing = locations.find(l => l.id === location.id);
      const updated = await dataService.updateLocation(location.id, location);
      console.info('[App] Location updated successfully:', updated);
      setLocations(prev => prev.map(l => l.id === location.id ? location : l));
      
      // Audit: Location updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'LOCATION', location.id, location.name, existing, location);
      
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
      const existing = locations.find(l => l.id === id);
      
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
      
      // Audit: Location deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'LOCATION', id, existing?.name);
      
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
      
      // Audit: Schedule created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'SCHEDULE', created.id);
      
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
      const existing = schedules.find(s => s.id === schedule.id);
      const updated = await dataService.updateSchedule(schedule.id, schedule);
      console.info('[App] Schedule updated successfully:', updated);
      setSchedules(prev => prev.map(s => s.id === schedule.id ? schedule : s));
      
      // Audit: Schedule updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'SCHEDULE', schedule.id, undefined, existing, schedule);
      
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
      
      // Audit: Schedule deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'SCHEDULE', id);
      
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
      
      // Audit: Batch created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BATCH', created.id, batch.name || batch.batchCode);
      
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
      const existing = batches.find(b => b.id === batch.id);
      const updated = await dataService.updateBatch(batch.id, batch);
      console.info('[App] Batch updated successfully:', updated);
      setBatches(prev => prev.map(b => b.id === batch.id ? batch : b));
      
      // Audit: Batch updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BATCH', batch.id, batch.name || batch.batchCode, existing, batch);
      
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
      const existing = batches.find(b => b.id === id);
      await dataService.deleteBatch(id);
      setBatches(prev => prev.filter(b => b.id !== id));
      
      // Audit: Batch deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BATCH', id, existing?.name || existing?.batchCode);
      
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
      
      // Audit: Sponsor created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'SPONSOR', created.id, sponsor.name);
      
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
      const existing = sponsors.find(s => s.id === sponsor.id);
      const updated = await dataService.updateSponsor(sponsor.id, sponsor);
      setSponsors(prev => prev.map(s => s.id === sponsor.id ? updated : s));
      
      // Audit: Sponsor updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'SPONSOR', sponsor.id, sponsor.name, existing, sponsor);
      
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
      const existing = sponsors.find(s => s.id === id);
      
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
      
      // Audit: Sponsor deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'SPONSOR', id, existing?.name);
      
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
  // BANK ACCOUNT CRUD HANDLERS
  // ============================================================================

  const handleAddBankAccount = async (bank: Partial<BankAccount>) => {
    try {
      console.info('[App] Creating bank account:', bank.bankName);
      const bankWithOrg = { ...bank, orgId: currentOrgId } as BankAccount;
      const created = await dataService.createBankAccount(bankWithOrg);
      setBankAccounts(prev => [...prev, created]);
      
      // Audit: Bank account created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BANK_ACCOUNT', created.id, `${bank.bankName} - ${bank.accountNumber}`);
      
      handleNotify('success', `Bank account "${created.bankName}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating bank account:', error);
      handleNotify('error', `Failed to create bank account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleUpdateBankAccount = async (id: string, updates: Partial<BankAccount>) => {
    try {
      console.info('[App] Updating bank account:', id, updates);
      const existing = bankAccounts.find(b => b.id === id);
      const updated = await dataService.updateBankAccount(id, updates);
      setBankAccounts(prev => prev.map(b => b.id === id ? updated : b));
      
      // Audit: Bank account updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BANK_ACCOUNT', id, existing?.bankName, existing, { ...existing, ...updates });
      
      handleNotify('success', 'Bank account updated successfully');
    } catch (error) {
      console.error('[App] Error updating bank account:', error);
      handleNotify('error', `Failed to update bank account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteBankAccount = async (id: string) => {
    try {
      console.info('[App] Deleting bank account:', id);
      const existing = bankAccounts.find(b => b.id === id);
      await dataService.deleteBankAccount(id);
      setBankAccounts(prev => prev.filter(b => b.id !== id));
      
      // Audit: Bank account deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BANK_ACCOUNT', id, existing?.bankName);
      
      handleNotify('success', 'Bank account deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting bank account:', error);
      handleNotify('error', `Failed to delete bank account: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  // Bank Reconciliation CRUD Handlers
  const handleAddBankReconciliation = async (reconciliation: any) => {
    try {
      console.info('[App] Creating bank reconciliation:', reconciliation.bankAccountId, reconciliation.asOfDate);
      const reconciliationWithOrg = { ...reconciliation, orgId: currentOrgId };
      const created = await dataService.createBankReconciliation(reconciliationWithOrg);
      setBankReconciliations(prev => [...prev, created]);
      
      // Audit: Bank reconciliation created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BANK_RECONCILIATION', created.id, `Reconciliation as of ${created.asOfDate}`);
      
      handleNotify('success', 'Bank reconciliation saved successfully');
    } catch (error) {
      console.error('[App] Error creating bank reconciliation:', error);
      handleNotify('error', `Failed to save reconciliation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleUpdateBankReconciliation = async (id: string, updates: any) => {
    try {
      console.info('[App] Updating bank reconciliation:', id, updates);
      const existing = bankReconciliations.find(r => r.id === id);
      const updated = await dataService.updateBankReconciliation(id, updates);
      setBankReconciliations(prev => prev.map(r => r.id === id ? updated : r));
      
      // Audit: Bank reconciliation updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BANK_RECONCILIATION', id, existing?.asOfDate, existing, { ...existing, ...updates });
      
      handleNotify('success', 'Bank reconciliation updated successfully');
    } catch (error) {
      console.error('[App] Error updating bank reconciliation:', error);
      handleNotify('error', `Failed to update reconciliation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteBankReconciliation = async (id: string) => {
    try {
      console.info('[App] Deleting bank reconciliation:', id);
      const existing = bankReconciliations.find(r => r.id === id);
      await dataService.deleteBankReconciliation(id);
      setBankReconciliations(prev => prev.filter(r => r.id !== id));
      
      // Audit: Bank reconciliation deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BANK_RECONCILIATION', id, existing?.asOfDate);
      
      handleNotify('success', 'Bank reconciliation deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting bank reconciliation:', error);
      handleNotify('error', `Failed to delete reconciliation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Recurring Journal Entry CRUD Handlers
  const handleAddRecurringJournalEntry = async (entry: any) => {
    try {
      console.info('[App] Creating recurring journal entry:', entry.name);
      const entryWithOrg = { ...entry, orgId: currentOrgId };
      const created = await dataService.createRecurringJournalEntry(entryWithOrg);
      setRecurringJournalEntries(prev => [...prev, created]);
      
      // Audit: Recurring journal entry created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'RECURRING_JOURNAL_ENTRY', created.id, `Recurring entry: ${created.name}`);
      
      handleNotify('success', 'Recurring journal entry created successfully');
    } catch (error) {
      console.error('[App] Error creating recurring journal entry:', error);
      handleNotify('error', `Failed to create recurring entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleUpdateRecurringJournalEntry = async (id: string, updates: any) => {
    try {
      console.info('[App] Updating recurring journal entry:', id);
      const existing = recurringJournalEntries.find(e => e.id === id);
      const updated = await dataService.updateRecurringJournalEntry(id, updates);
      setRecurringJournalEntries(prev => prev.map(e => e.id === id ? updated : e));
      
      // Audit: Recurring journal entry updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'RECURRING_JOURNAL_ENTRY', id, existing?.name, existing, { ...existing, ...updates });
      
      handleNotify('success', 'Recurring journal entry updated successfully');
    } catch (error) {
      console.error('[App] Error updating recurring journal entry:', error);
      handleNotify('error', `Failed to update recurring entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteRecurringJournalEntry = async (id: string) => {
    try {
      console.info('[App] Deleting recurring journal entry:', id);
      const existing = recurringJournalEntries.find(e => e.id === id);
      await dataService.deleteRecurringJournalEntry(id);
      setRecurringJournalEntries(prev => prev.filter(e => e.id !== id));
      
      // Audit: Recurring journal entry deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'RECURRING_JOURNAL_ENTRY', id, existing?.name);
      
      handleNotify('success', 'Recurring journal entry deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting recurring journal entry:', error);
      handleNotify('error', `Failed to delete recurring entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRunRecurringEntry = async (id: string) => {
    try {
      console.info('[App] Running recurring journal entry:', id);
      const entry = recurringJournalEntries.find(e => e.id === id);
      if (!entry) {
        handleNotify('error', 'Recurring entry not found');
        return;
      }

      // Import RecurringJournalEntryService to use its logic
      const { RecurringJournalEntryService } = await import('./services/RecurringJournalEntryService');
      
      // Check if entry is due
      if (!RecurringJournalEntryService.isDueToRun(entry)) {
        handleNotify('warning', 'This recurring entry is not due to run yet');
        return;
      }

      // Generate journal entry from template
      const entryDate = new Date().toISOString().split('T')[0];
      const generatedId = crypto.randomUUID();
      const { entry: journalEntryData, lines: journalLineData } = RecurringJournalEntryService.generateEntryFromTemplate(
        entry,
        entryDate,
        generatedId
      );
      
      // Create journal entry with lines
      const newJournalEntry: Partial<JournalEntry> = {
        ...journalEntryData,
        orgId: currentOrgId,
        createdBy: currentUser?.id || 'system',
        createdAt: new Date().toISOString()
      };
      
      const created = await dataService.createJournalEntry(newJournalEntry as JournalEntry);
      setJournalEntries(prev => [...prev, created]);

      // Update the recurring entry with execution info
      const updatedEntry = RecurringJournalEntryService.updateAfterExecution(entry, created.id);
      const updated = await dataService.updateRecurringJournalEntry(id, updatedEntry);
      setRecurringJournalEntries(prev => prev.map(e => e.id === id ? updated : e));

      // Audit
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'JOURNAL_ENTRY', created.id, `Auto-generated from recurring entry: ${entry.name}`);
      
      handleNotify('success', 'Recurring journal entry executed and posted successfully');
    } catch (error) {
      console.error('[App] Error running recurring journal entry:', error);
      handleNotify('error', `Failed to execute recurring entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Check Voucher CRUD Handlers
  const handleAddCheckVoucher = async (check: Partial<CheckVoucher>) => {
    try {
      console.info('[App] Creating check voucher:', check.checkNumber);
      const checkWithOrg = { ...check, orgId: currentOrgId } as CheckVoucher;
      const created = await dataService.createCheckVoucher(checkWithOrg);
      setCheckVouchers(prev => [...prev, created]);
      
      // Audit: Check voucher created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'CHECK_VOUCHER', created.id, `Check #${check.checkNumber}`);
      
      handleNotify('success', `Check #${created.checkNumber} created successfully`);
      return created;
    } catch (error) {
      console.error('[App] Error creating check voucher:', error);
      handleNotify('error', `Failed to create check: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  };

  const handleUpdateCheckVoucher = async (id: string, updates: Partial<CheckVoucher>) => {
    try {
      console.info('[App] Updating check voucher:', id, updates);
      const existing = checkVouchers.find(c => c.id === id);
      const updated = await dataService.updateCheckVoucher(id, updates);
      setCheckVouchers(prev => prev.map(c => c.id === id ? updated : c));
      
      // Audit: Check voucher updated (include status changes)
      const statusChange = updates.status && existing?.status !== updates.status 
        ? `Status: ${existing?.status} → ${updates.status}` 
        : undefined;
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'CHECK_VOUCHER', id, `Check #${existing?.checkNumber}`, existing, { ...existing, ...updates });
      
      handleNotify('success', 'Check voucher updated successfully');
      return updated;
    } catch (error) {
      console.error('[App] Error updating check voucher:', error);
      handleNotify('error', `Failed to update check: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  };

  const handleDeleteCheckVoucher = async (id: string) => {
    try {
      console.info('[App] Deleting check voucher:', id);
      const existing = checkVouchers.find(c => c.id === id);
      await dataService.deleteCheckVoucher(id);
      setCheckVouchers(prev => prev.filter(c => c.id !== id));
      
      // Audit: Check voucher deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'CHECK_VOUCHER', id, `Check #${existing?.checkNumber}`);
      
      handleNotify('success', 'Check voucher deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting check voucher:', error);
      handleNotify('error', `Failed to delete check: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  const handleAddVendor = async (vendor: Partial<Vendor>) => {
    try {
      console.info('[App] Creating vendor:', vendor.name);
      const vendorWithOrg = { ...vendor, orgId: currentOrgId } as Vendor;
      const created = await dataService.createVendor(vendorWithOrg);
      setVendors(prev => [...prev, created]);
      
      // Audit: Vendor created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'VENDOR', created.id, vendor.name);
      
      handleNotify('success', `Vendor "${created.name}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating vendor:', error);
      handleNotify('error', 'Failed to create vendor. Falling back to memory storage.');
      setVendors(prev => [...prev, { ...vendor, orgId: currentOrgId, id: `ven-${Date.now()}` } as Vendor]);
    }
  };

  const handleUpdateVendor = async (id: string, updates: Partial<Vendor>) => {
    try {
      console.info('[App] Updating vendor:', id, updates);
      const existing = vendors.find(v => v.id === id);
      const updated = await dataService.updateVendor(id, updates);
      setVendors(prev => prev.map(v => v.id === id ? updated : v));
      
      // Audit: Vendor updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'VENDOR', id, existing?.name, existing, { ...existing, ...updates });
      
      handleNotify('success', 'Vendor updated successfully');
    } catch (error) {
      console.error('[App] Error updating vendor:', error);
      handleNotify('error', 'Failed to update vendor. Falling back to memory storage.');
      setVendors(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
    }
  };

  const handleDeleteVendor = async (id: string) => {
    try {
      console.info('[App] Deleting vendor:', id);
      const existing = vendors.find(v => v.id === id);
      await dataService.deleteVendor(id);
      setVendors(prev => prev.filter(v => v.id !== id));
      
      // Audit: Vendor deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'VENDOR', id, existing?.name);
      
      handleNotify('success', 'Vendor deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting vendor:', error);
      handleNotify('error', 'Failed to delete vendor. Falling back to memory storage.');
      setVendors(prev => prev.filter(v => v.id !== id));
      return true;
    }
  };

  // ============================================================================
  // INVENTORY MANAGEMENT CRUD HANDLERS
  // ============================================================================

  // Warehouse Locations CRUD
  const handleAddWarehouseLocation = async (location: Omit<WarehouseLocation, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      console.info('[App] Creating warehouse location:', location.name);
      const newLocation = await dataService.createWarehouseLocation({ ...location, orgId: currentOrgId } as WarehouseLocation);
      setWarehouseLocations([...warehouseLocations, newLocation]);
      handleNotify('success', `Location "${location.name}" created successfully`);
    } catch (error) {
      console.error('[App] Error adding warehouse location:', error);
      handleNotify('error', 'Failed to create location. Falling back to memory storage.');
      const locWithId: WarehouseLocation = { ...location, orgId: currentOrgId, id: `loc-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isDeleted: false } as any;
      setWarehouseLocations([...warehouseLocations, locWithId]);
    }
  };

  const handleUpdateWarehouseLocation = async (id: string, updates: Partial<WarehouseLocation>) => {
    try {
      console.info('[App] Updating warehouse location:', id);
      const updated = await dataService.updateWarehouseLocation(id, updates);
      setWarehouseLocations(warehouseLocations.map(l => l.id === id ? updated : l));
      handleNotify('success', 'Location updated successfully');
    } catch (error) {
      console.error('[App] Error updating warehouse location:', error);
      handleNotify('error', 'Failed to update location. Falling back to memory storage.');
      setWarehouseLocations(warehouseLocations.map(l => l.id === id ? { ...l, ...updates } : l));
    }
  };

  const handleDeleteWarehouseLocation = async (id: string) => {
    try {
      console.info('[App] Deleting warehouse location:', id);
      await dataService.deleteWarehouseLocation(id);
      setWarehouseLocations(warehouseLocations.map(l => l.id === id ? { ...l, isDeleted: true } : l));
      handleNotify('success', 'Location deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting warehouse location:', error);
      handleNotify('error', 'Failed to delete location. Falling back to memory storage.');
      setWarehouseLocations(warehouseLocations.map(l => l.id === id ? { ...l, isDeleted: true } : l));
    }
  };

  // Stock Items CRUD
  const handleAddStockItem = async (item: Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      console.info('[App] Creating stock item:', item.name);
      const newItem = await dataService.createStockItem({ ...item, orgId: currentOrgId } as StockItem);
      setStockItems([...stockItems, newItem]);
      handleNotify('success', `Item "${item.name}" created successfully`);
    } catch (error) {
      console.error('[App] Error adding stock item:', error);
      handleNotify('error', 'Failed to create item. Falling back to memory storage.');
      const itemWithId: StockItem = { ...item, orgId: currentOrgId, id: `item-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isDeleted: false } as any;
      setStockItems([...stockItems, itemWithId]);
    }
  };

  const handleUpdateStockItem = async (id: string, updates: Partial<StockItem>) => {
    try {
      console.info('[App] Updating stock item:', id);
      const updated = await dataService.updateStockItem(id, updates);
      setStockItems(stockItems.map(i => i.id === id ? updated : i));
      handleNotify('success', 'Item updated successfully');
    } catch (error) {
      console.error('[App] Error updating stock item:', error);
      handleNotify('error', 'Failed to update item. Falling back to memory storage.');
      setStockItems(stockItems.map(i => i.id === id ? { ...i, ...updates } : i));
    }
  };

  const handleDeleteStockItem = async (id: string) => {
    try {
      console.info('[App] Deleting stock item:', id);
      await dataService.deleteStockItem(id);
      setStockItems(stockItems.map(i => i.id === id ? { ...i, isDeleted: true } : i));
      handleNotify('success', 'Item deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting stock item:', error);
      handleNotify('error', 'Failed to delete item. Falling back to memory storage.');
      setStockItems(stockItems.map(i => i.id === id ? { ...i, isDeleted: true } : i));
    }
  };

  // Inventory Levels CRUD
  const handleAddInventoryLevel = async (level: Omit<InventoryLevel, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      console.info('[App] Creating inventory level');
      const newLevel = await dataService.createInventoryLevel({ ...level, orgId: currentOrgId } as InventoryLevel);
      setInventoryLevels([...inventoryLevels, newLevel]);
      handleNotify('success', 'Inventory level created successfully');
    } catch (error) {
      console.error('[App] Error adding inventory level:', error);
      handleNotify('error', 'Failed to create inventory level. Falling back to memory storage.');
      const levelWithId: InventoryLevel = { ...level, orgId: currentOrgId, id: `level-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isDeleted: false } as any;
      setInventoryLevels([...inventoryLevels, levelWithId]);
    }
  };

  const handleUpdateInventoryLevel = async (id: string, updates: Partial<InventoryLevel>) => {
    try {
      console.info('[App] Updating inventory level:', id);
      const updated = await dataService.updateInventoryLevel(id, updates);
      setInventoryLevels(inventoryLevels.map(l => l.id === id ? updated : l));
      handleNotify('success', 'Inventory level updated successfully');
    } catch (error) {
      console.error('[App] Error updating inventory level:', error);
      handleNotify('error', 'Failed to update inventory level. Falling back to memory storage.');
      setInventoryLevels(inventoryLevels.map(l => l.id === id ? { ...l, ...updates } : l));
    }
  };

  const handleDeleteInventoryLevel = async (id: string) => {
    try {
      console.info('[App] Deleting inventory level:', id);
      await dataService.deleteInventoryLevel(id);
      setInventoryLevels(inventoryLevels.map(l => l.id === id ? { ...l, isDeleted: true } : l));
      handleNotify('success', 'Inventory level deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting inventory level:', error);
      handleNotify('error', 'Failed to delete inventory level. Falling back to memory storage.');
      setInventoryLevels(inventoryLevels.map(l => l.id === id ? { ...l, isDeleted: true } : l));
    }
  };

  // Stock Adjustments CRUD
  const handleAddStockAdjustment = async (adjustment: Omit<StockAdjustment, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      console.info('[App] Creating stock adjustment');
      const newAdjustment = await dataService.createStockAdjustment({ ...adjustment, orgId: currentOrgId } as StockAdjustment);
      setStockAdjustments([...stockAdjustments, newAdjustment]);
      handleNotify('success', 'Stock adjustment created successfully');
    } catch (error) {
      console.error('[App] Error adding stock adjustment:', error);
      handleNotify('error', 'Failed to create adjustment. Falling back to memory storage.');
      const adjWithId: StockAdjustment = { ...adjustment, orgId: currentOrgId, id: `adj-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isDeleted: false } as any;
      setStockAdjustments([...stockAdjustments, adjWithId]);
    }
  };

  const handleUpdateStockAdjustment = async (id: string, updates: Partial<StockAdjustment>) => {
    try {
      console.info('[App] Updating stock adjustment:', id);
      const updated = await dataService.updateStockAdjustment(id, updates);
      setStockAdjustments(stockAdjustments.map(a => a.id === id ? updated : a));
      handleNotify('success', 'Stock adjustment updated successfully');
    } catch (error) {
      console.error('[App] Error updating stock adjustment:', error);
      handleNotify('error', 'Failed to update adjustment. Falling back to memory storage.');
      setStockAdjustments(stockAdjustments.map(a => a.id === id ? { ...a, ...updates } : a));
    }
  };

  const handleDeleteStockAdjustment = async (id: string) => {
    try {
      console.info('[App] Deleting stock adjustment:', id);
      await dataService.deleteStockAdjustment(id);
      setStockAdjustments(stockAdjustments.map(a => a.id === id ? { ...a, isDeleted: true } : a));
      handleNotify('success', 'Stock adjustment deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting stock adjustment:', error);
      handleNotify('error', 'Failed to delete adjustment. Falling back to memory storage.');
      setStockAdjustments(stockAdjustments.map(a => a.id === id ? { ...a, isDeleted: true } : a));
    }
  };

  // Reorder Points CRUD
  const handleAddReorderPoint = async (point: Omit<ReorderPoint, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      console.info('[App] Creating reorder point');
      const newPoint = await dataService.createReorderPoint({ ...point, orgId: currentOrgId } as ReorderPoint);
      setReorderPoints([...reorderPoints, newPoint]);
      handleNotify('success', 'Reorder point created successfully');
    } catch (error) {
      console.error('[App] Error adding reorder point:', error);
      handleNotify('error', 'Failed to create reorder point. Falling back to memory storage.');
      const pointWithId: ReorderPoint = { ...point, orgId: currentOrgId, id: `reorder-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isDeleted: false } as any;
      setReorderPoints([...reorderPoints, pointWithId]);
    }
  };

  const handleUpdateReorderPoint = async (id: string, updates: Partial<ReorderPoint>) => {
    try {
      console.info('[App] Updating reorder point:', id);
      const updated = await dataService.updateReorderPoint(id, updates);
      setReorderPoints(reorderPoints.map(p => p.id === id ? updated : p));
      handleNotify('success', 'Reorder point updated successfully');
    } catch (error) {
      console.error('[App] Error updating reorder point:', error);
      handleNotify('error', 'Failed to update reorder point. Falling back to memory storage.');
      setReorderPoints(reorderPoints.map(p => p.id === id ? { ...p, ...updates } : p));
    }
  };

  const handleDeleteReorderPoint = async (id: string) => {
    try {
      console.info('[App] Deleting reorder point:', id);
      await dataService.deleteReorderPoint(id);
      setReorderPoints(reorderPoints.map(p => p.id === id ? { ...p, isDeleted: true } : p));
      handleNotify('success', 'Reorder point deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting reorder point:', error);
      handleNotify('error', 'Failed to delete reorder point. Falling back to memory storage.');
      setReorderPoints(reorderPoints.map(p => p.id === id ? { ...p, isDeleted: true } : p));
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
      
      // Audit: Fixed asset created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'FIXED_ASSET', savedAsset.id, `${asset.code} - ${asset.name}`);
      
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
      const existing = fixedAssets.find(a => a.id === id);
      const updated = await dataService.updateFixedAsset(id, updates);
      setFixedAssets(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a));
      
      // Audit: Fixed asset updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'FIXED_ASSET', id, existing?.name, existing, { ...existing, ...updates });
      
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
      const existing = fixedAssets.find(a => a.id === id);
      await dataService.deleteFixedAsset(id);
      setFixedAssets(prev => prev.filter(a => a.id !== id));
      
      // Audit: Fixed asset deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'FIXED_ASSET', id, existing?.name);
      
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
        periodId: '', // Will need period context
        date: new Date().toISOString().split('T')[0],
        description: `Monthly depreciation for ${asset.name}`,
        reference: `DEP-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
        status: 'POSTED',
        createdBy: currentUser?.id || 'system',
        sourceType: 'DEPRECIATION',
        createdAt: new Date().toISOString(),
        isDeleted: false
      };

      // Add journal entry lines separately
      const newLines: JournalEntryLine[] = deprLines.map(line => ({
        ...line,
        journalEntryId: entryId
      }));

      // Add to journal entries and lines
      setJournalEntries(prev => [...prev, newEntry]);
      setJournalLines(prev => [...prev, ...newLines]);

      // Update accumulated depreciation on the asset
      const newAccumulated = (asset.accumulatedDepreciation || 0) + monthlyDepreciation;
      await handleUpdateFixedAsset(assetId, { accumulatedDepreciation: newAccumulated });
      
      // Audit: Depreciation recorded
      AuditService.log({
        orgId: currentOrgId,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        action: 'POST',
        entityType: 'FIXED_ASSET',
        entityId: assetId,
        entityName: asset.name,
        details: `Depreciation: ${monthlyDepreciation.toFixed(2)} | New Accumulated: ${newAccumulated.toFixed(2)}`
      });

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
      
      // Audit: Item created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ITEM', savedItem.id, `${item.code} - ${item.name}`);
      
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
      const existing = items.find(i => i.id === id);
      const updated = await dataService.updateItem(id, updates);
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));
      
      // Audit: Item updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ITEM', id, existing?.name, existing, { ...existing, ...updates });
      
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
      const existing = items.find(i => i.id === id);
      await dataService.deleteItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
      
      // Audit: Item deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ITEM', id, existing?.name);
      
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

  // Show Password Reset View
  if (showPasswordReset) {
    return (
      <PasswordResetView 
        onBackToLogin={() => {
          setShowPasswordReset(false);
          setResetToken(null);
          // Clear URL parameter
          window.history.replaceState({}, '', window.location.pathname);
        }}
        resetToken={resetToken}
      />
    );
  }

  if (!currentUser) {
    return (
      <LoginView 
        onLogin={handleLogin} 
        onRegister={handleRegisterWithPersistence} 
        onForgotPassword={() => setShowPasswordReset(true)}
        organizations={organizations} 
        users={users} 
      />
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-right duration-300 flex items-center gap-3 ${
              toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />}
            {toast.type === 'error' && <AlertCircle size={18} className="text-red-500 shrink-0" />}
            {toast.type === 'info' && <AlertCircle size={18} className="text-blue-500 shrink-0" />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="ml-auto text-current opacity-50 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <aside className={`${sidebarOpen ? 'w-80' : 'w-20'} bg-slate-950 flex flex-col transition-all duration-500 z-50 border-r border-white/5`}>
        <div className="p-6 flex items-center justify-center border-b border-white/5 bg-slate-900/50">
           {sidebarOpen ? (
             <div className="flex flex-col items-center gap-3 w-full">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg overflow-hidden shrink-0"
                  style={{ backgroundColor: brandColor }}
                >
                   {currentOrg?.logoUrl ? <img src={currentOrg.logoUrl} className="w-full h-full object-cover" /> : <Building2 size={24} />}
                </div>
                <div className="w-full text-center">
                   <h1 className="text-sm font-black text-white uppercase tracking-tight">{currentOrg?.name || 'No Organization'}</h1>
                   <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">{currentUser.role.replace('_', ' ')}</p>
                </div>
             </div>
           ) : (
             <div 
               className="w-10 h-10 rounded-full flex items-center justify-center mx-auto text-white shadow-xl"
               style={{ backgroundColor: brandColor }}
             >
               <Building2 size={20} />
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
               <NavItem icon={<Printer size={20}/>} label="Check Printing" active={activeTab === 'checks'} onClick={() => setActiveTab('checks')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Zap size={20}/>} label="EFT Batches" active={activeTab === 'eft'} onClick={() => setActiveTab('eft')} compact={!sidebarOpen} brandColor={brandColor} />
               {isAR && <NavItem icon={<Receipt size={20}/>} label="Receivables (AR)" active={activeTab === 'ar'} onClick={() => setActiveTab('ar')} compact={!sidebarOpen} brandColor={brandColor} />}
               {isAP && <NavItem icon={<CreditCard size={20}/>} label="Payables (AP)" active={activeTab === 'payables'} onClick={() => setActiveTab('payables')} compact={!sidebarOpen} brandColor={brandColor} />}
               {isAP && <NavItem icon={<ShoppingCart size={20}/>} label="Procurement (PO)" active={activeTab === 'po'} onClick={() => setActiveTab('po')} compact={!sidebarOpen} brandColor={brandColor} />}
               {isAP && <NavItem icon={<Package size={20}/>} label="Goods Receipt (GR)" active={activeTab === 'goods-receipt'} onClick={() => setActiveTab('goods-receipt')} compact={!sidebarOpen} brandColor={brandColor} />}
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

           {isFinance && (
             <div className="mb-8">
               {sidebarOpen && <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">Inventory Management</p>}
               <NavItem icon={<Package size={20}/>} label="Stock Dashboard" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<MapPin size={20}/>} label="Warehouse Locations" active={activeTab === 'warehouse-locations'} onClick={() => setActiveTab('warehouse-locations')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Box size={20}/>} label="Stock Items" active={activeTab === 'stock-items'} onClick={() => setActiveTab('stock-items')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Layers size={20}/>} label="Stock Levels" active={activeTab === 'stock-levels'} onClick={() => setActiveTab('stock-levels')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<AlertCircle size={20}/>} label="Stock Adjustments" active={activeTab === 'stock-adjustments'} onClick={() => setActiveTab('stock-adjustments')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Zap size={20}/>} label="Reorder Points" active={activeTab === 'reorder-points'} onClick={() => setActiveTab('reorder-points')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<History size={20}/>} label="Transactions" active={activeTab === 'inventory-transactions'} onClick={() => setActiveTab('inventory-transactions')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<TrendingUp size={20}/>} label="Analytics" active={activeTab === 'inventory-reports'} onClick={() => setActiveTab('inventory-reports')} compact={!sidebarOpen} brandColor={brandColor} />
             </div>
           )}

           {isTenantAdmin && (
             <div className="mb-8">
               {sidebarOpen && <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">Administration</p>}
               <NavItem icon={<Users size={20}/>} label="Employees" active={activeTab === 'employees'} onClick={() => setActiveTab('employees')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<Settings size={20}/>} label="G/L Setup (COA)" active={activeTab === 'coa'} onClick={() => setActiveTab('coa')} compact={!sidebarOpen} brandColor={brandColor} />
               <NavItem icon={<CalendarCheck size={20}/>} label="Period Closing" active={activeTab === 'periods'} onClick={() => setActiveTab('periods')} compact={!sidebarOpen} brandColor={brandColor} />
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
          {activeTab === 'ledger' && <Ledger accounts={filteredAccounts} entries={activeJournalEntries} lines={filteredLines} students={students} sponsors={sponsors} trainers={trainers} batches={batches} items={items} onPostEntry={handlePostJournal} />}
          {activeTab === 'reports' && <Reports summaries={summaries} accounts={filteredAccounts} entries={activeJournalEntries} lines={filteredLines} qualifications={qualifications} batches={batches} orgName={currentOrg?.name} currency={currentOrg?.currency} logoUrl={currentOrg?.logoUrl} />}
          
          {activeTab === 'ar' && <ARView entries={activeJournalEntries} lines={filteredLines} students={students} sponsors={sponsors} items={items} accounts={filteredAccounts} bankAccounts={bankAccounts} onPostInvoice={handlePostJournal} onNotify={handleNotify} />}
          {activeTab === 'payables' && <PayablesView orgId={currentOrgId} payables={payables} vendors={vendors} accounts={filteredAccounts} entries={activeJournalEntries} vendorTaxSettings={vendorTaxSettings} atcCategories={atcCategories} atcItems={atcItems} atcRates={atcRates} currentUserId={currentUser?.id} onCreatePayable={handleAddPayable} onUpdatePayable={handleUpdatePayable} onDeletePayable={handleDeletePayable} onPostJournal={handlePostJournal} onNotify={handleNotify} />}
          {activeTab === 'po' && <PurchaseOrdersView purchaseOrders={purchaseOrders} vendors={vendors} items={items} onCreatePO={po => setPurchaseOrders(p => [...p, po])} onUpdateStatus={(id, s) => setPurchaseOrders(p => p.map(x => x.id === id ? {...x, status: s} : x))} onConvertToBill={handleConvertToBill} />}
          {activeTab === 'goods-receipt' && <GoodsReceiptView orgId={currentOrgId} goodsReceipts={goodsReceipts} purchaseOrders={purchaseOrders.filter(po => po.orgId === currentOrgId)} vendors={vendors} accounts={filteredAccounts} currentUserId={currentUser?.id} onCreateGoodsReceipt={gr => setGoodsReceipts(p => [...p, gr])} onUpdateGoodsReceipt={(id, u) => setGoodsReceipts(p => p.map(g => g.id === id ? {...g, ...u} : g))} onDeleteGoodsReceipt={id => setGoodsReceipts(p => p.filter(g => g.id !== id))} onPostJournal={handlePostJournal} onNotify={handleNotify} />}
          
          {activeTab === 'coa' && <ChartOfAccounts accounts={filteredAccounts} lines={filteredLines} qualifications={qualifications} onAddAccount={a => setAccounts(p => [...p, a])} onUpdateAccount={a => setAccounts(p => p.map(x => x.id === a.id ? a : x))} onDeleteAccount={id => setAccounts(p => p.filter(x => x.id !== id))} />}
          {activeTab === 'periods' && <PeriodClosingView orgId={currentOrgId} periods={accountingPeriods} payables={payables} entries={activeJournalEntries} accounts={filteredAccounts} currentUserId={currentUser?.id} onCreatePeriod={async (p) => { try { const service = DataServiceFactory.getService(); const periodWithOrgAndUser = { ...p, orgId: currentOrgId, createdBy: currentUser?.id }; const created = await service.createAccountingPeriod(periodWithOrgAndUser); setAccountingPeriods(prev => [...prev, created]); handleNotify('success', 'Period created successfully'); } catch (error) { console.error('Error creating period:', error); handleNotify('error', 'Failed to create period'); } }} onUpdatePeriod={async (id, u) => { try { const service = DataServiceFactory.getService(); const updated = await service.updateAccountingPeriod(id, u); setAccountingPeriods(prev => prev.map(p => p.id === id ? {...p, ...updated} : p)); handleNotify('success', 'Period updated successfully'); } catch (error) { console.error('Error updating period:', error); handleNotify('error', 'Failed to update period'); } }} onPostJournal={handlePostJournal} onNotify={handleNotify} />}
          {activeTab === 'items' && <ItemsView items={items.filter(i => i.orgId === currentOrgId && !i.isDeleted)} accounts={filteredAccounts} onAddItem={handleAddItem} onUpdateItem={handleUpdateItem} onDeleteItem={handleDeleteItem} />}
          {activeTab === 'sponsors' && <SponsorsView sponsors={sponsors.filter(s => s.orgId === currentOrgId && !s.isDeleted)} onAddSponsor={handleAddSponsor} onUpdateSponsor={handleUpdateSponsor} onDeleteSponsor={handleDeleteSponsor} />}
          {activeTab === 'vendors' && <VendorsView vendors={vendors.filter(v => v.orgId === currentOrgId && !v.isDeleted)} accounts={filteredAccounts} lines={filteredLines} onAddVendor={handleAddVendor} onUpdateVendor={handleUpdateVendor} onDeleteVendor={handleDeleteVendor} onNotify={handleNotify} />}
          {activeTab === 'assets' && <AssetsView assets={fixedAssets.filter(a => a.orgId === currentOrgId && !a.isDeleted)} accounts={filteredAccounts} lines={filteredLines} entries={activeJournalEntries} onDepreciate={handleDepreciate} onAddAsset={handleAddFixedAsset} onUpdateAsset={handleUpdateFixedAsset} onDeleteAsset={handleDeleteFixedAsset} onNotify={handleNotify} />}

          {/* Inventory Management Views */}
          {activeTab === 'inventory' && <InventoryView items={stockItems.filter(i => !i.isDeleted)} levels={inventoryLevels.filter(l => !l.isDeleted)} reorderPoints={reorderPoints.filter(r => !r.isDeleted)} currency={currentOrg?.currency || 'USD'} onSelectItem={(itemId) => setActiveTab('stock-items')} />}
          {activeTab === 'warehouse-locations' && <WarehouseLocationsView locations={warehouseLocations.filter(l => !l.isDeleted)} onAdd={handleAddWarehouseLocation} onUpdate={handleUpdateWarehouseLocation} onDelete={handleDeleteWarehouseLocation} currency={currentOrg?.currency || 'USD'} isLoading={isLoading} />}
          {activeTab === 'stock-items' && <StockItemsView items={stockItems.filter(i => !i.isDeleted)} accounts={filteredAccounts} onAdd={handleAddStockItem} onUpdate={handleUpdateStockItem} onDelete={handleDeleteStockItem} currency={currentOrg?.currency || 'USD'} isLoading={isLoading} />}
          {activeTab === 'stock-levels' && <InventoryView items={stockItems.filter(i => !i.isDeleted)} levels={inventoryLevels.filter(l => !l.isDeleted)} reorderPoints={reorderPoints.filter(r => !r.isDeleted)} currency={currentOrg?.currency || 'USD'} />}
          {activeTab === 'stock-adjustments' && <StockAdjustmentsView adjustments={stockAdjustments.filter(a => !a.isDeleted)} items={stockItems.filter(i => !i.isDeleted)} levels={inventoryLevels.filter(l => !l.isDeleted)} locations={warehouseLocations.filter(l => !l.isDeleted)} accounts={filteredAccounts} onAdd={handleAddStockAdjustment} onUpdate={handleUpdateStockAdjustment} onDelete={handleDeleteStockAdjustment} onPostGL={handlePostJournal} currency={currentOrg?.currency || 'USD'} currentUserId={currentUser?.id} isLoading={isLoading} />}
          {activeTab === 'reorder-points' && <ReorderView reorderPoints={reorderPoints.filter(r => !r.isDeleted)} items={stockItems.filter(i => !i.isDeleted)} levels={inventoryLevels.filter(l => !l.isDeleted)} onAdd={handleAddReorderPoint} onUpdate={handleUpdateReorderPoint} onDelete={handleDeleteReorderPoint} currency={currentOrg?.currency || 'USD'} isLoading={isLoading} />}
          {activeTab === 'inventory-transactions' && <InventoryTransactionsView transactions={inventoryTransactions.filter(t => !t.isDeleted)} items={stockItems.filter(i => !i.isDeleted)} locations={warehouseLocations.filter(l => !l.isDeleted)} currency={currentOrg?.currency || 'USD'} isLoading={isLoading} />}
          {activeTab === 'inventory-reports' && <AdvancedInventoryReports items={stockItems.filter(i => !i.isDeleted)} levels={inventoryLevels.filter(l => !l.isDeleted)} transactions={inventoryTransactions.filter(t => !t.isDeleted)} lines={filteredLines} currency={currentOrg?.currency || 'USD'} />}
          {activeTab === 'banking' && <BankingView bankAccounts={bankAccounts.filter(b => b.orgId === currentOrgId && !b.isDeleted)} summaries={summaries} accounts={filteredAccounts} entries={activeJournalEntries} lines={filteredLines} bankReconciliations={bankReconciliations} onAddBankAccount={handleAddBankAccount} onUpdateBankAccount={handleUpdateBankAccount} onDeleteBankAccount={handleDeleteBankAccount} onAddBankReconciliation={handleAddBankReconciliation} onUpdateBankReconciliation={handleUpdateBankReconciliation} onDeleteBankReconciliation={handleDeleteBankReconciliation} onPostTransfer={handlePostJournal} onToggleClearLine={id => setJournalLines(prev => prev.map(l => l.id === id ? {...l, isCleared: !l.isCleared} : l))} onNotify={handleNotify} />}
          {activeTab === 'checks' && <CheckPrintingView orgId={currentOrgId} checks={checkVouchers} bankAccounts={bankAccounts} vendors={vendors} payables={payables} accounts={filteredAccounts} entries={activeJournalEntries} currentUserId={currentUser?.id} onCreateCheck={handleAddCheckVoucher} onUpdateCheck={handleUpdateCheckVoucher} onDeleteCheck={handleDeleteCheckVoucher} onPostJournal={handlePostJournal} onNotify={handleNotify} />}
          {activeTab === 'eft' && <EFTBatchView orgId={currentOrgId} batches={eftBatches} bankAccounts={bankAccounts} vendors={vendors} payables={payables} currentUserId={currentUser?.id} onCreateBatch={b => setEftBatches(p => [...p, b])} onUpdateBatch={(id, u) => setEftBatches(p => p.map(b => b.id === id ? {...b, ...u} : b))} onDeleteBatch={id => setEftBatches(p => p.filter(b => b.id !== id))} onNotify={handleNotify} />}
          
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
          {activeTab === 'users' && <UsersManagementView 
            users={users.filter(u => u.orgId === currentOrgId)} 
            students={students.filter(s => s.orgId === currentOrgId)}
            trainers={trainers.filter(t => t.orgId === currentOrgId)}
            onAddUser={handleAddUser} 
            onDeleteUser={handleDeleteUser} 
          />}
          {activeTab === 'audit' && <AuditTrail orgId={currentOrgId} logs={auditLogs} />}
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
