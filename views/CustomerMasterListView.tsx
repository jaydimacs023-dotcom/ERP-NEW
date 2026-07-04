
import React, { useState, useMemo } from 'react';
import {
    Sponsor, Student, Invoice, Enrollment, Batch, Qualification, ChartOfAccount, StudentDocument, User as UserType
} from '../types';
import ModalPortal from '../components/ModalPortal';
import {
    Search, Users, Handshake, Mail, Phone, MapPin, Building,
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    Filter, Plus, FileText, LayoutDashboard, X, User as UserIcon,
    CheckCircle2, AlertCircle, Clock, ShieldCheck, Printer, Heart, Loader2, Receipt, Building2,
    ChevronDown, ChevronUp, RotateCcw, ArrowUpDown
} from 'lucide-react';

interface CustomerMasterListViewProps {
    sponsors: Sponsor[];
    students: Student[];
    invoices: Invoice[];
    enrollments: Enrollment[];
    batches: Batch[];
    qualifications: Qualification[];
    accounts: ChartOfAccount[];
    brandColor?: string;
    onAddSponsor?: (sponsor: Sponsor) => void | Promise<void>;
    onUpdateSponsor?: (sponsor: Sponsor) => void | Promise<void>;
    onDeleteSponsor?: (id: string) => void | Promise<boolean>;
    onAddStudent?: (student: Student) => void;
    onUpdateStudent?: (student: Student) => void | Promise<void>;
    onDeleteStudent?: (id: string) => void;
    onBatchAddStudents?: (students: Student[]) => void;
    onNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
}

const PAGE_SIZE = 7;

const getNextSponsorCode = (sponsorRecords: Sponsor[]) => {
    const highest = sponsorRecords.reduce<{ prefix: string; number: number; width: number } | null>((current, sponsor) => {
        const code = (sponsor.sponsorCode || '').trim();
        const match = code.match(/^(.*?)(\d+)$/);
        if (!match) return current;

        const number = Number.parseInt(match[2], 10);
        if (Number.isNaN(number)) return current;
        if (!current || number > current.number) {
            return { prefix: match[1], number, width: match[2].length };
        }
        return current;
    }, null);

    if (!highest) return 'SP-001';

    return `${highest.prefix}${String(highest.number + 1).padStart(Math.max(highest.width, 3), '0')}`;
};

const MANDATORY_DOCS = [
    'TOR (Transcript of Records)',
    'Birth Certificate',
    'Application Form',
    'Passport Size Photo'
];

type BillingFilter = 'ALL' | 'BILLED' | 'UNBILLED' | 'PARTIAL' | 'NO_ENROLLMENT';
type CustomerColumnKey = 'identity' | 'contact' | 'details' | 'billing';
type SortDirection = 'asc' | 'desc' | 'none';

const CustomerMasterListView: React.FC<CustomerMasterListViewProps> = ({
    sponsors,
    students,
    invoices,
    enrollments,
    batches,
    qualifications,
    accounts,
    brandColor = '#F47721',
    onAddSponsor,
    onUpdateSponsor,
    onAddStudent,
    onUpdateStudent,
    onNotify
}) => {
    const [activeSubTab, setActiveSubTab] = useState<'sponsors' | 'students'>('sponsors');
    const [searchTerm, setSearchTerm] = useState('');
    const [billingFilter, setBillingFilter] = useState<BillingFilter>('ALL');
    const [showBillingDropdown, setShowBillingDropdown] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sponsorColumnOrder, setSponsorColumnOrder] = useState<CustomerColumnKey[]>(['identity', 'contact', 'details', 'billing']);
    const [studentColumnOrder, setStudentColumnOrder] = useState<CustomerColumnKey[]>(['identity', 'contact', 'details', 'billing']);
    const [draggedColumn, setDraggedColumn] = useState<CustomerColumnKey | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: CustomerColumnKey; direction: SortDirection }>({
        key: 'identity',
        direction: 'none'
    });

    // Detail Modals
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);

    // Form Modals
    const [showSponsorModal, setShowSponsorModal] = useState(false);
    const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
    const [sponsorFormData, setSponsorFormData] = useState<Partial<Sponsor>>({
        sponsorCode: '', name: '', contactPerson: '', email: '', phone: '', address: '', tin: '', taxType: 'NON_VAT', ewtRate: 0, arAccountId: ''
    });

    const [showStudentModal, setShowStudentModal] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [studentFormData, setStudentFormData] = useState<Partial<Student>>({
        uli: '', lastName: '', firstName: '', middleName: '', extension: '', sex: 'Male',
        dateOfBirth: '', age: 0, birthRegion: '', birthProvince: '', birthCity: '',
        civilStatus: 'Single', educationalAttainment: 'College Graduate', nationality: 'Filipino',
        email: '', contactNumber: '', street: '', barangay: '', city: '', district: '',
        province: '', guardian: '',
    });

    // --- Form Handlers ---
    const resetSponsorForm = () => {
        setSponsorFormData({ sponsorCode: '', name: '', contactPerson: '', email: '', phone: '', address: '', tin: '', taxType: 'NON_VAT', ewtRate: 0, arAccountId: '' });
        setEditingSponsor(null);
    };

    const openCreateSponsorModal = () => {
        setEditingSponsor(null);
        setSponsorFormData({ sponsorCode: getNextSponsorCode(sponsors), name: '', contactPerson: '', email: '', phone: '', address: '', tin: '', taxType: 'NON_VAT', ewtRate: 0, arAccountId: '' });
        setShowSponsorModal(true);
    };

    const resetStudentForm = () => {
        setStudentFormData({
            uli: '', lastName: '', firstName: '', middleName: '', extension: '', sex: 'Male',
            dateOfBirth: '', age: 0, birthRegion: '', birthProvince: '', birthCity: '',
            civilStatus: 'Single', educationalAttainment: 'College Graduate', nationality: 'Filipino',
            email: '', contactNumber: '', street: '', barangay: '', city: '', district: '',
            province: '', guardian: '',
        });
        setEditingStudent(null);
    };

    const handleSponsorSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sponsorFormData.name || !onAddSponsor || !onUpdateSponsor) return;
        setIsSubmitting(true);
        try {
            if (editingSponsor) {
                await onUpdateSponsor({ ...editingSponsor, ...sponsorFormData, name: sponsorFormData.name!, updatedAt: new Date().toISOString() });
                onNotify?.('success', `Sponsor "${sponsorFormData.name}" updated successfully!`);
            } else {
                await onAddSponsor({
                    id: `sp-${Date.now()}`,
                    orgId: '',
                    ...sponsorFormData,
                    sponsorCode: sponsorFormData.sponsorCode || getNextSponsorCode(sponsors),
                    name: sponsorFormData.name!,
                    createdAt: new Date().toISOString()
                } as Sponsor);
                onNotify?.('success', `Sponsor "${sponsorFormData.name}" created successfully!`);
            }
            setShowSponsorModal(false);
            resetSponsorForm();
        } catch (error) {
            onNotify?.('error', `Failed to save sponsor: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStudentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!studentFormData.firstName || !onAddStudent || !onUpdateStudent) return;
        setIsSubmitting(true);
        try {
            if (editingStudent) {
                await onUpdateStudent({ ...editingStudent, ...studentFormData as Student, updatedAt: new Date().toISOString() });
                onNotify?.('success', `Learner ${studentFormData.firstName} updated successfully!`);
            } else {
                onAddStudent({
                    ...studentFormData as Student,
                    id: `stud-${Date.now()}`,
                    orgId: '',
                    documents: [],
                    createdAt: new Date().toISOString()
                });
                onNotify?.('success', `Learner ${studentFormData.firstName} registered successfully!`);
            }
            setShowStudentModal(false);
            resetStudentForm();
        } catch (error) {
            onNotify?.('error', `Failed to save learner: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Status Logic ---
    const getStudentBillingStatus = (studentId: string) => {
        const studentEnrollments = enrollments.filter(e => e.studentId === studentId);
        if (studentEnrollments.length === 0) return 'NO_ENROLLMENT';

        const hasBilled = studentEnrollments.some(e => e.billingStatus === 'BILLED' || e.billingStatus === 'PARTIALLY_BILLED');
        const hasUnbilled = studentEnrollments.some(e => e.billingStatus === 'UNBILLED');

        if (hasBilled && !hasUnbilled) return 'BILLED';
        if (hasUnbilled && !hasBilled) return 'UNBILLED';
        if (hasBilled && hasUnbilled) return 'PARTIAL';
        return 'UNKNOWN';
    };

    const getSponsorBillingStatus = (sponsorId: string) => {
        const sponsorInvoices = invoices.filter(i => i.sponsorId === sponsorId);
        if (sponsorInvoices.length === 0) return 'UNBILLED';

        const hasOpen = sponsorInvoices.some(i => i.status === 'OPEN');
        if (hasOpen) return 'BILLED';
        return 'BILLED';
    };

    // --- Filtering Logic ---
    const filteredData = useMemo(() => {
        if (activeSubTab === 'sponsors') {
            const lowerSearch = searchTerm.toLowerCase();
            return sponsors.filter(s =>
                !s.isDeleted && (
                    s.name.toLowerCase().includes(lowerSearch) ||
                    s.sponsorCode?.toLowerCase().includes(lowerSearch) ||
                    s.contactPerson?.toLowerCase().includes(lowerSearch)
                ) &&
                (billingFilter === 'ALL' || getSponsorBillingStatus(s.id) === billingFilter)
            );
        } else {
            const lowerSearch = searchTerm.toLowerCase();
            return students.filter(s =>
                !s.isDeleted && (
                    `${s.firstName} ${s.lastName}`.toLowerCase().includes(lowerSearch) ||
                    (s.uli || '').toLowerCase().includes(lowerSearch) ||
                    s.email?.toLowerCase().includes(lowerSearch)
                ) &&
                (billingFilter === 'ALL' || getStudentBillingStatus(s.id) === billingFilter)
            );
        }
    }, [activeSubTab, sponsors, students, searchTerm, billingFilter, invoices, enrollments]);

    const activeTabData = useMemo(
        () => activeSubTab === 'sponsors'
            ? sponsors.filter(s => !s.isDeleted)
            : students.filter(s => !s.isDeleted),
        [activeSubTab, sponsors, students]
    );

    const summary = useMemo(() => {
        if (activeSubTab === 'sponsors') {
            const billedCount = activeTabData.filter(item => getSponsorBillingStatus((item as Sponsor).id) === 'BILLED').length;
            const unbilledCount = activeTabData.filter(item => getSponsorBillingStatus((item as Sponsor).id) === 'UNBILLED').length;
            return {
                total: activeTabData.length,
                billed: billedCount,
                attention: unbilledCount,
                visible: filteredData.length
            };
        }

        const billedCount = activeTabData.filter(item => getStudentBillingStatus((item as Student).id) === 'BILLED').length;
        const attentionCount = activeTabData.filter(item => {
            const status = getStudentBillingStatus((item as Student).id);
            return status === 'UNBILLED' || status === 'PARTIAL' || status === 'NO_ENROLLMENT';
        }).length;
        return {
            total: activeTabData.length,
            billed: billedCount,
            attention: attentionCount,
            visible: filteredData.length
        };
    }, [activeSubTab, activeTabData, filteredData.length, enrollments, invoices]);

    const activeColumnOrder = activeSubTab === 'sponsors' ? sponsorColumnOrder : studentColumnOrder;

    const tableColumns: Record<CustomerColumnKey, { key: CustomerColumnKey; label: string; width: string }> = activeSubTab === 'sponsors'
        ? {
            identity: { key: 'identity', label: 'Sponsor Identification', width: 'w-[34%]' },
            contact: { key: 'contact', label: 'Contact Person', width: 'w-[22%]' },
            details: { key: 'details', label: 'Contact Details', width: 'w-[24%]' },
            billing: { key: 'billing', label: 'Billing Status', width: 'w-[20%]' },
        }
        : {
            identity: { key: 'identity', label: 'Learner Identification', width: 'w-[34%]' },
            contact: { key: 'contact', label: 'Contact Number', width: 'w-[22%]' },
            details: { key: 'details', label: 'Residence', width: 'w-[24%]' },
            billing: { key: 'billing', label: 'Billing Status', width: 'w-[20%]' },
        };

    const getSortValue = (item: Sponsor | Student, key: CustomerColumnKey): string => {
        if (activeSubTab === 'sponsors') {
            const sponsor = item as Sponsor;
            switch (key) {
                case 'identity':
                    return `${sponsor.name || ''} ${sponsor.sponsorCode || ''}`;
                case 'contact':
                    return sponsor.contactPerson || '';
                case 'details':
                    return `${sponsor.email || ''} ${sponsor.phone || ''}`;
                case 'billing':
                    return getSponsorBillingStatus(sponsor.id);
                default:
                    return '';
            }
        }

        const student = item as Student;
        switch (key) {
            case 'identity':
                return `${student.lastName || ''} ${student.firstName || ''} ${student.uli || ''}`;
            case 'contact':
                return student.contactNumber || '';
            case 'details':
                return `${student.city || ''} ${student.province || ''}`;
            case 'billing':
                return getStudentBillingStatus(student.id);
            default:
                return '';
        }
    };

    const sortedData = useMemo(() => {
        if (sortConfig.direction === 'none') return filteredData;

        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        return [...filteredData].sort((a, b) => (
            getSortValue(a as Sponsor | Student, sortConfig.key)
                .localeCompare(getSortValue(b as Sponsor | Student, sortConfig.key), undefined, { numeric: true, sensitivity: 'base' }) * dir
        ));
    }, [filteredData, sortConfig, activeSubTab, invoices, enrollments]);

    const handleSort = (key: CustomerColumnKey) => {
        setCurrentPage(1);
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleColumnDrop = (targetKey: CustomerColumnKey) => {
        if (!draggedColumn || draggedColumn === targetKey) return;

        const reorder = (currentOrder: CustomerColumnKey[]) => {
            const nextOrder = currentOrder.filter(key => key !== draggedColumn);
            const targetIndex = nextOrder.indexOf(targetKey);
            nextOrder.splice(targetIndex, 0, draggedColumn);
            return nextOrder;
        };

        if (activeSubTab === 'sponsors') {
            setSponsorColumnOrder(reorder);
        } else {
            setStudentColumnOrder(reorder);
        }

        setDraggedColumn(null);
    };

    const SortIndicator = ({ columnKey }: { columnKey: CustomerColumnKey }) => {
        if (sortConfig.key !== columnKey || sortConfig.direction === 'none') {
            return <ArrowUpDown size={12} className="ml-1 text-white/70" />;
        }

        return sortConfig.direction === 'asc'
            ? <ChevronUp size={12} className="ml-1 text-white" />
            : <ChevronDown size={12} className="ml-1 text-white" />;
    };

    // --- Pagination ---
    const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return sortedData.slice(start, start + PAGE_SIZE);
    }, [sortedData, currentPage]);

    const handleTabChange = (tab: 'sponsors' | 'students') => {
        setActiveSubTab(tab);
        setSearchTerm('');
        setBillingFilter('ALL');
        setShowBillingDropdown(false);
        setDraggedColumn(null);
        setSortConfig({ key: 'identity', direction: 'none' });
        setCurrentPage(1);
    };

    // --- Detail Renderers ---
    const DataPoint = ({ label, value, isSpan2 = false }: { label: string, value?: string, isSpan2?: boolean }) => (
        <div className={isSpan2 ? "col-span-2" : ""}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
            <p className="text-sm font-bold text-slate-700">{value || '---'}</p>
        </div>
    );

    const availableBillingFilters: Array<{ value: BillingFilter; label: string }> = activeSubTab === 'sponsors'
        ? [
            { value: 'ALL', label: 'All' },
            { value: 'BILLED', label: 'Billed' },
            { value: 'UNBILLED', label: 'Unbilled' },
        ]
        : [
            { value: 'ALL', label: 'All' },
            { value: 'BILLED', label: 'Billed' },
            { value: 'UNBILLED', label: 'Unbilled' },
            { value: 'PARTIAL', label: 'Partial' },
            { value: 'NO_ENROLLMENT', label: 'No Enrollment' },
        ];

    const billingFilterLabel = availableBillingFilters.find(option => option.value === billingFilter)?.label || 'All';
    const hasActiveFilters = searchTerm.trim().length > 0 || billingFilter !== 'ALL';
    const registryCellClass = 'h-16 px-6 py-3 align-middle';

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-end gap-4 flex-wrap">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 tracking-tighter">Customer Master List</h2>
                    <p className="text-sm italic text-slate-500 font-medium">Centralized registry for all billable entities and individuals.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => handleTabChange('sponsors')}
                            className={`px-6 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${activeSubTab === 'sponsors' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Sponsors
                        </button>
                        <button
                            onClick={() => handleTabChange('students')}
                            className={`px-6 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${activeSubTab === 'students' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Learners
                        </button>
                    </div>
                    {/* {activeSubTab === 'sponsors' ? (
                        <button
                            onClick={openCreateSponsorModal}
                            className="flex items-center gap-2 px-6 py-2.5 text-white rounded-xl transition-all font-semibold text-[10px] uppercase tracking-widest"
                            style={{ backgroundColor: brandColor, boxShadow: `0 10px 20px -10px ${brandColor}` }}
                        >
                            <Plus size={16} /> New Sponsor
                        </button>
                    ) : (
                        <button
                            onClick={() => { resetStudentForm(); setShowStudentModal(true); }}
                            className="flex items-center gap-2 px-6 py-2.5 text-white rounded-xl transition-all font-semibold text-[10px] uppercase tracking-widest"
                            style={{ backgroundColor: brandColor, boxShadow: `0 10px 20px -10px ${brandColor}` }}
                        >
                            <Plus size={16} /> Register Learner
                        </button>
                    )} */}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        {activeSubTab === 'sponsors' ? 'Total Sponsors' : 'Total Learners'}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">{summary.total}</p>
                </div>
                <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Billed</p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-600">{summary.billed}</p>
                </div>
                <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Needs Attention</p>
                    <p className="mt-2 text-2xl font-semibold" style={{ color: brandColor }}>{summary.attention}</p>
                </div>
                <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Visible Results</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">{summary.visible}</p>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white border-y px-4 py-2">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-72">
                        <Search size={14} className="text-gray-400 mr-2" />
                        <input
                            type="text"
                            placeholder={`Search ${activeSubTab}...`}
                            className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>

                    <div className="relative">
                        <div
                            onClick={() => setShowBillingDropdown(prev => !prev)}
                            className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none max-w-[220px]"
                        >
                            <span className="text-[13px] text-gray-500 mr-1 truncate">Billing:</span>
                            <span className="text-[13px] font-bold text-gray-800 pr-5 truncate">{billingFilterLabel}</span>
                            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
                        </div>

                        {showBillingDropdown && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowBillingDropdown(false)}></div>
                                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                    <div className="p-1">
                                        {availableBillingFilters.map(option => (
                                            <button
                                                key={option.value}
                                                onClick={() => {
                                                    setBillingFilter(option.value);
                                                    setShowBillingDropdown(false);
                                                    setCurrentPage(1);
                                                }}
                                                className={`w-full text-left px-3 py-2 text-[13px] rounded transition-colors ${
                                                    billingFilter === option.value ? 'font-bold text-white' : 'text-gray-700 hover:bg-gray-100'
                                                }`}
                                                style={billingFilter === option.value ? { backgroundColor: brandColor } : undefined}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setSearchTerm('');
                            setBillingFilter('ALL');
                            setShowBillingDropdown(false);
                            setCurrentPage(1);
                        }}
                        className="p-2 text-gray-400 transition-colors"
                        style={hasActiveFilters ? { color: brandColor } : undefined}
                        title="Clear all filters"
                    >
                        <RotateCcw size={16} />
                    </button>

                    <div className="ml-auto flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        <Filter size={14} />
                        <span>{filteredData.length} record{filteredData.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="min-w-full table-fixed divide-y divide-gray-100 text-left">
                    <thead style={{ backgroundColor: brandColor }}>
                        <tr>
                            {activeColumnOrder.map(columnKey => {
                                const column = tableColumns[columnKey];
                                const isDragged = draggedColumn === columnKey;

                                return (
                                    <th
                                        key={column.key}
                                        draggable
                                        onDragStart={() => setDraggedColumn(column.key)}
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={() => handleColumnDrop(column.key)}
                                        onDragEnd={() => setDraggedColumn(null)}
                                        className={`px-6 py-4 text-xs font-bold uppercase tracking-wide text-white ${column.width} ${isDragged ? 'opacity-50' : ''}`}
                                        title="Drag to reorder. Click to sort."
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleSort(column.key)}
                                            className="flex items-center gap-1 text-left uppercase tracking-wide"
                                        >
                                            {column.label}
                                            <SortIndicator columnKey={column.key} />
                                        </button>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {paginatedData.map((item) => {
                            if (activeSubTab === 'sponsors') {
                                const sponsor = item as Sponsor;
                                const status = getSponsorBillingStatus(sponsor.id);
                                const cells: Record<CustomerColumnKey, React.ReactNode> = {
                                    identity: (
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                                style={{ backgroundColor: 'var(--acm-primary-light)', color: brandColor, border: `1px solid var(--acm-primary-light)` }}
                                            >
                                                <Building size={20} />
                                            </div>
                                            <div className="min-w-0">
                                                <button
                                                    onClick={() => setSelectedSponsor(sponsor)}
                                                    className="block max-w-full truncate text-left text-sm font-semibold uppercase tracking-tight text-slate-900 transition-colors"
                                                    style={{ color: undefined }}
                                                >
                                                    {sponsor.name}
                                                </button>
                                                <div className="truncate text-[10px] font-mono font-bold uppercase text-slate-400">{sponsor.sponsorCode || 'NO-CODE'}</div>
                                            </div>
                                        </div>
                                    ),
                                    contact: <div className="truncate text-sm font-bold text-slate-600">{sponsor.contactPerson || '---'}</div>,
                                    details: <div className="truncate text-xs font-bold text-slate-500">{sponsor.email || sponsor.phone || '---'}</div>,
                                    billing: status === 'BILLED' ? (
                                        <span className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                                            <CheckCircle2 size={12} /> Billed
                                        </span>
                                    ) : (
                                        <span className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            <Clock size={12} /> Unbilled
                                        </span>
                                    )
                                };

                                return (
                                    <tr key={sponsor.id} className="hover:bg-gray-50 transition-colors group">
                                        {activeColumnOrder.map(columnKey => (
                                            <td key={columnKey} className={registryCellClass}>
                                                {cells[columnKey]}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            } else {
                                const student = item as Student;
                                const status = getStudentBillingStatus(student.id);
                                const statusCell = (
                                    <>
                                        {status === 'BILLED' && (
                                            <span className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                                                <CheckCircle2 size={12} /> Billed
                                            </span>
                                        )}
                                        {status === 'UNBILLED' && (
                                            <span className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border border-brand-light bg-brand/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                                                <AlertCircle size={12} /> Unbilled
                                            </span>
                                        )}
                                        {status === 'PARTIAL' && (
                                            <span className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-600">
                                                <Clock size={12} /> Partial
                                            </span>
                                        )}
                                        {status === 'NO_ENROLLMENT' && (
                                            <span className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                No Enrollment
                                            </span>
                                        )}
                                    </>
                                );
                                const cells: Record<CustomerColumnKey, React.ReactNode> = {
                                    identity: (
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                                                style={{ backgroundColor: 'var(--acm-primary-light)', color: brandColor, border: `1px solid var(--acm-primary-light)` }}
                                            >
                                                <UserIcon size={20} />
                                            </div>
                                            <div className="min-w-0">
                                                <button
                                                    onClick={() => setSelectedStudent(student)}
                                                    className="block max-w-full truncate text-left text-sm font-black uppercase tracking-tight text-slate-900 transition-colors"
                                                >
                                                    {student.lastName.toUpperCase()}, {student.firstName}
                                                </button>
                                                <div className="truncate text-[10px] font-mono font-bold uppercase" style={{ color: brandColor }}>ULI: {student.uli}</div>
                                            </div>
                                        </div>
                                    ),
                                    contact: <div className="truncate text-sm font-bold text-slate-600">{student.contactNumber || '---'}</div>,
                                    details: (
                                        <>
                                            <div className="truncate text-[10px] font-black uppercase tracking-widest text-slate-500">{student.city || '---'}</div>
                                            <div className="truncate text-[10px] font-bold uppercase text-slate-400">{student.province || '---'}</div>
                                        </>
                                    ),
                                    billing: statusCell
                                };

                                return (
                                    <tr key={student.id} className="hover:bg-gray-50 transition-colors group">
                                        {activeColumnOrder.map(columnKey => (
                                            <td key={columnKey} className={registryCellClass}>
                                                {cells[columnKey]}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            }
                        })}
                    </tbody>
                </table>

                {paginatedData.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                        <Search size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-bold uppercase tracking-widest">No matching records found</p>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronsLeft size={16} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        <div className="flex items-center px-4">
                            <span className="text-xs font-black text-slate-900">{currentPage}</span>
                        </div>

                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronsRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Sponsor Modal (Add/Edit) */}
            {showSponsorModal && (
                <ModalPortal>
<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300 border border-slate-200">
                        <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-900 shadow-sm">
                                    <Building size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                                        {editingSponsor ? 'Edit Sponsor' : 'New Sponsor Profile'}
                                    </h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enterprise & Organization Setup</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setShowSponsorModal(false); resetSponsorForm(); }}
                                className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSponsorSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                        <Handshake size={14} className="text-slate-400" /> Sponsor Code
                                    </label>
                                    <input
                                        type="text"
                                        readOnly={!editingSponsor}
                                        className={`w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all ${editingSponsor ? 'bg-slate-50' : 'bg-slate-100 text-slate-700 cursor-default'}`}
                                        value={sponsorFormData.sponsorCode}
                                        onChange={(e) => setSponsorFormData(prev => ({ ...prev, sponsorCode: e.target.value }))}
                                        placeholder="Auto-generated"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                        <Building2 size={14} className="text-slate-400" /> Organization Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={sponsorFormData.name}
                                        onChange={(e) => setSponsorFormData(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Enter full legal name"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                        <UserIcon size={14} className="text-slate-400" /> Contact Person
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={sponsorFormData.contactPerson}
                                        onChange={(e) => setSponsorFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                                        placeholder="Full name of representative"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                        <Mail size={14} className="text-slate-400" /> Professional Email
                                    </label>
                                    <input
                                        type="email"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={sponsorFormData.email}
                                        onChange={(e) => setSponsorFormData(prev => ({ ...prev, email: e.target.value }))}
                                        placeholder="billing@organization.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                        <Phone size={14} className="text-slate-400" /> Contact Number
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={sponsorFormData.phone}
                                        onChange={(e) => setSponsorFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        placeholder="+63 000 000 0000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                        <MapPin size={14} className="text-slate-400" /> Office Address
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={sponsorFormData.address}
                                        onChange={(e) => setSponsorFormData(prev => ({ ...prev, address: e.target.value }))}
                                        placeholder="Building, Street, City"
                                    />
                                </div>
                            </div>

                            <div className="h-px bg-slate-100" />

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                        <FileText size={14} className="text-slate-400" /> Tax Identification (TIN)
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={sponsorFormData.tin}
                                        onChange={(e) => setSponsorFormData(prev => ({ ...prev, tin: e.target.value }))}
                                        placeholder="000-000-000-000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                        <Receipt size={14} className="text-slate-400" /> Tax Classification
                                    </label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={sponsorFormData.taxType}
                                        onChange={(e) => setSponsorFormData(prev => ({ ...prev, taxType: e.target.value as any }))}
                                    >
                                        <option value="VAT">Value Added Tax (VAT)</option>
                                        <option value="NON_VAT">Non-VAT Entity</option>
                                        <option value="ZERO_RATED">Zero Rated</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                        <LayoutDashboard size={14} className="text-slate-400" /> G/L Receivable Account
                                    </label>
                                    <select
                                        required
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={sponsorFormData.arAccountId}
                                        onChange={(e) => setSponsorFormData(prev => ({ ...prev, arAccountId: e.target.value }))}
                                    >
                                        <option value="">Select Account...</option>
                                        {accounts.filter(a => a.type === 'ASSET' || a.code.startsWith('1')).map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                        <AlertCircle size={14} className="text-slate-400" /> EWT Rate (Optional)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                            value={sponsorFormData.ewtRate !== undefined && sponsorFormData.ewtRate !== null ? sponsorFormData.ewtRate * 100 : ''}
                                            onChange={(e) => {
                                                const val = e.target.value === '' ? undefined : parseFloat(e.target.value) / 100;
                                                setSponsorFormData(prev => ({ ...prev, ewtRate: val }));
                                            }}
                                            placeholder="e.g. 1.0"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase">%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowSponsorModal(false); resetSponsorForm(); }}
                                    className="px-8 py-3 bg-white border border-slate-200 rounded-2xl text-slate-400 font-black text-[10px] uppercase tracking-widest hover:border-slate-900 hover:text-slate-900 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-10 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : editingSponsor ? 'Update Sponsor' : 'Confirm Registration'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
</ModalPortal>
            )}

            {/* Student Modal (Add/Edit) */}
            {showStudentModal && (
                <ModalPortal>
<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-300 border border-slate-200">
                        <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-900 shadow-sm">
                                    <UserIcon size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                                        {editingStudent ? 'Edit Learner Detail' : 'Learner Registration'}
                                    </h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Personal Identification & Profile</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setShowStudentModal(false); resetStudentForm(); }}
                                className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleStudentSubmit} className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-4 gap-6">
                                <div className="col-span-1 space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">ULI (Learner ID)</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={studentFormData.uli}
                                        onChange={(e) => setStudentFormData(prev => ({ ...prev, uli: e.target.value }))}
                                        placeholder="Enter ULI"
                                    />
                                </div>
                                <div className="col-span-1 space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Last Name *</label>
                                    <input
                                        type="text" required
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={studentFormData.lastName}
                                        onChange={(e) => setStudentFormData(prev => ({ ...prev, lastName: e.target.value }))}
                                    />
                                </div>
                                <div className="col-span-1 space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">First Name *</label>
                                    <input
                                        type="text" required
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={studentFormData.firstName}
                                        onChange={(e) => setStudentFormData(prev => ({ ...prev, firstName: e.target.value }))}
                                    />
                                </div>
                                <div className="col-span-1 space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Middle Name</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={studentFormData.middleName}
                                        onChange={(e) => setStudentFormData(prev => ({ ...prev, middleName: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Sex</label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={studentFormData.sex}
                                        onChange={(e) => setStudentFormData(prev => ({ ...prev, sex: e.target.value as any }))}
                                    >
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Date of Birth</label>
                                    <input
                                        type="date"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={studentFormData.dateOfBirth}
                                        onChange={(e) => setStudentFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Civil Status</label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={studentFormData.civilStatus}
                                        onChange={(e) => setStudentFormData(prev => ({ ...prev, civilStatus: e.target.value as any }))}
                                    >
                                        <option value="Single">Single</option>
                                        <option value="Married">Married</option>
                                        <option value="Widowed">Widowed</option>
                                        <option value="Separated">Separated</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Nationality</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={studentFormData.nationality}
                                        onChange={(e) => setStudentFormData(prev => ({ ...prev, nationality: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="h-px bg-slate-100" />

                            <div className="grid grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Email Address</label>
                                    <input
                                        type="email"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={studentFormData.email}
                                        onChange={(e) => setStudentFormData(prev => ({ ...prev, email: e.target.value }))}
                                        placeholder="student@example.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Phone Number</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={studentFormData.contactNumber}
                                        onChange={(e) => setStudentFormData(prev => ({ ...prev, contactNumber: e.target.value }))}
                                        placeholder="09xx-xxx-xxxx"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Province</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={studentFormData.province}
                                        onChange={(e) => setStudentFormData(prev => ({ ...prev, province: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Full Residence Address</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={studentFormData.street}
                                        onChange={(e) => setStudentFormData(prev => ({ ...prev, street: e.target.value }))}
                                        placeholder="Street / Barangay / Municipality / District"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Educational Attainment</label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900/5 outline-none transition-all"
                                        value={studentFormData.educationalAttainment}
                                        onChange={(e) => setStudentFormData(prev => ({ ...prev, educationalAttainment: e.target.value as any }))}
                                    >
                                        <option value="High School Graduate">High School Graduate</option>
                                        <option value="College Undergraduate">College Undergraduate</option>
                                        <option value="College Graduate">College Graduate</option>
                                        <option value="Post Graduate">Post Graduate</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6">
                                <button
                                    type="button"
                                    onClick={() => { setShowStudentModal(false); resetStudentForm(); }}
                                    className="px-8 py-3 bg-white border border-slate-200 rounded-2xl text-slate-400 font-black text-[10px] uppercase tracking-widest hover:border-slate-900 hover:text-slate-900 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-10 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : editingStudent ? 'Update Profile' : 'Complete Registration'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
</ModalPortal>
            )}

            {/* Student Detail Modal */}
            {selectedStudent && (
                <ModalPortal>
<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-300 border border-slate-200">
                        <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-2xl bg-white border-4 border-white shadow-xl flex items-center justify-center overflow-hidden shrink-0">
                                    <UserIcon size={32} className="text-slate-300" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">
                                        {selectedStudent.lastName.toUpperCase()}, {selectedStudent.firstName}
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-mono font-black text-brand uppercase tracking-widest bg-brand/10 px-2 py-0.5 rounded-full border border-brand-light">ULI: {selectedStudent.uli}</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Learner Profile</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedStudent(null)}
                                className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:border-slate-900 transition-all shadow-sm"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-8 grid grid-cols-3 gap-12 max-h-[60vh] overflow-y-auto">
                            <div className="space-y-8">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg"><UserIcon size={14} /></div>
                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Personal Info</h4>
                                </div>
                                <div className="space-y-6">
                                    <DataPoint label="Birth Date" value={selectedStudent.dateOfBirth} />
                                    <DataPoint label="Sex" value={selectedStudent.sex} />
                                    <DataPoint label="Civil Status" value={selectedStudent.civilStatus} />
                                    <DataPoint label="Nationality" value={selectedStudent.nationality} />
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-1.5 bg-emerald-50 text-emerald-500 rounded-lg"><Mail size={14} /></div>
                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Contact & Residence</h4>
                                </div>
                                <div className="space-y-6">
                                    <DataPoint label="Official Email" value={selectedStudent.email} />
                                    <DataPoint label="Phone Number" value={selectedStudent.contactNumber} />
                                    <DataPoint label="Full Address" value={`${selectedStudent.street}, ${selectedStudent.barangay}, ${selectedStudent.city}, ${selectedStudent.province}`} isSpan2 />
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-1.5 bg-brand/10 text-brand rounded-lg"><LayoutDashboard size={14} /></div>
                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Enrollment Details</h4>
                                </div>
                                <div className="space-y-4">
                                    {enrollments.filter(e => e.studentId === selectedStudent.id).map(enr => {
                                        const batch = batches.find(b => b.id === enr.batchId);
                                        const qual = qualifications.find(q => q.id === batch?.qualificationId);
                                        return (
                                            <div key={enr.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1">{qual?.name || 'Unknown Batch'}</p>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-slate-400 capitalize">{enr.enrollmentStatus}</span>
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${enr.billingStatus === 'BILLED' ? 'text-emerald-500' : 'text-brand'}`}>
                                                        {enr.billingStatus}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {enrollments.filter(e => e.studentId === selectedStudent.id).length === 0 && (
                                        <p className="text-xs font-bold text-slate-400 italic">No active enrollments found.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
</ModalPortal>
            )}

            {/* Sponsor Detail Modal */}
            {selectedSponsor && (
                <ModalPortal>
<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-300 border border-slate-200">
                        <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-2xl bg-white border-4 border-white shadow-xl flex items-center justify-center overflow-hidden shrink-0">
                                    <Building size={32} className="text-brand" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">
                                        {selectedSponsor.name}
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">CODE: {selectedSponsor.sponsorCode || 'N/A'}</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sponsor Organization</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedSponsor(null)}
                                className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:border-slate-900 transition-all shadow-sm"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-8 grid grid-cols-2 gap-12 max-h-[60vh] overflow-y-auto">
                            <div className="space-y-8">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-1.5 bg-brand/10 text-brand rounded-lg"><Building size={14} /></div>
                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Organization Details</h4>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <DataPoint label="Contact Person" value={selectedSponsor.contactPerson} />
                                    <DataPoint label="Tax ID (TIN)" value={selectedSponsor.tin} />
                                    <DataPoint label="Tax Type" value={selectedSponsor.taxType} />
                                    <DataPoint label="EWT Rate" value={selectedSponsor.ewtRate ? `${(selectedSponsor.ewtRate * 100).toFixed(1)}%` : 'None'} />
                                    <DataPoint label="Official Address" value={selectedSponsor.address} isSpan2 />
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg"><Mail size={14} /></div>
                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Communication & Billing</h4>
                                </div>
                                <div className="space-y-6">
                                    <DataPoint label="Primary Email" value={selectedSponsor.email} />
                                    <DataPoint label="Phone/Mobile" value={selectedSponsor.phone} />

                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                        <div className="flex justify-between items-center mb-4">
                                            <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Billing Snapshot</h5>
                                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Active Partner</span>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Invoices</span>
                                                <span className="text-sm font-black text-slate-900">{invoices.filter(i => i.sponsorId === selectedSponsor.id).length}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Open Balance</span>
                                                <span className="text-sm font-black text-rose-500">
                                                    {"\u20B1"}{invoices.filter(i => i.sponsorId === selectedSponsor.id && i.status === 'OPEN')
                                                        .reduce((acc, inv) => acc + inv.balanceDue, 0).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
</ModalPortal>
            )}
        </div>
    );
};

export default CustomerMasterListView;

