
import React, { useState, useMemo } from 'react';
import {
    Sponsor, Student, Invoice, Enrollment, Batch, Qualification, ChartOfAccount, StudentDocument, User as UserType
} from '../types';
import {
    Search, Users, Handshake, Mail, Phone, MapPin, Building,
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    Eye, Filter, Plus, FileText, LayoutDashboard, X, User as UserIcon,
    CheckCircle2, AlertCircle, Clock, ShieldCheck, Printer, Heart
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
}

const PAGE_SIZE = 10;

const CustomerMasterListView: React.FC<CustomerMasterListViewProps> = ({
    sponsors,
    students,
    invoices,
    enrollments,
    batches,
    qualifications,
    accounts,
    brandColor = '#F47721'
}) => {
    const [activeSubTab, setActiveSubTab] = useState<'sponsors' | 'students'>('sponsors');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    // Detail Modals
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);

    // --- Filtering Logic ---
    const filteredData = useMemo(() => {
        if (activeSubTab === 'sponsors') {
            const lowerSearch = searchTerm.toLowerCase();
            return sponsors.filter(s =>
                !s.isDeleted && (
                    s.name.toLowerCase().includes(lowerSearch) ||
                    s.sponsorCode?.toLowerCase().includes(lowerSearch) ||
                    s.contactPerson?.toLowerCase().includes(lowerSearch)
                )
            );
        } else {
            const lowerSearch = searchTerm.toLowerCase();
            return students.filter(s =>
                !s.isDeleted && (
                    `${s.firstName} ${s.lastName}`.toLowerCase().includes(lowerSearch) ||
                    s.uli.toLowerCase().includes(lowerSearch) ||
                    s.email?.toLowerCase().includes(lowerSearch)
                )
            );
        }
    }, [activeSubTab, sponsors, students, searchTerm]);

    // --- Pagination ---
    const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredData.slice(start, start + PAGE_SIZE);
    }, [filteredData, currentPage]);

    const handleTabChange = (tab: 'sponsors' | 'students') => {
        setActiveSubTab(tab);
        setSearchTerm('');
        setCurrentPage(1);
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
        if (hasOpen) return 'BILLED'; // Or active balance
        return 'BILLED'; // If they have invoices at all, they've been billed
    };

    // --- Detail Renderers ---
    const DataPoint = ({ label, value, isSpan2 = false }: { label: string, value?: string, isSpan2?: boolean }) => (
        <div className={isSpan2 ? "col-span-2" : ""}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
            <p className="text-sm font-bold text-slate-700">{value || '---'}</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tighter">Customer Master List</h2>
                    <p className="text-sm text-slate-500 font-medium">Centralized registry for all billable entities and individuals.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => handleTabChange('sponsors')}
                        className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'sponsors' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Sponsors
                    </button>
                    <button
                        onClick={() => handleTabChange('students')}
                        className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'students' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Learners
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder={`Search ${activeSubTab}...`}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {filteredData.length} Total Records
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {activeSubTab === 'sponsors' ? 'Sponsor Identification' : 'Learner Identification'}
                            </th>
                            {activeSubTab === 'sponsors' ? (
                                <>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact Person</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact Details</th>
                                </>
                            ) : (
                                <>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact Number</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Residence</th>
                                </>
                            )}
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Billing Status</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginatedData.map((item, idx) => {
                            if (activeSubTab === 'sponsors') {
                                const sponsor = item as Sponsor;
                                const status = getSponsorBillingStatus(sponsor.id);
                                return (
                                    <tr key={sponsor.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 border border-orange-100 shrink-0">
                                                    <Building size={20} />
                                                </div>
                                                <div>
                                                    <button
                                                        onClick={() => setSelectedSponsor(sponsor)}
                                                        className="text-sm font-black text-slate-900 uppercase tracking-tight hover:text-indigo-600 transition-colors text-left"
                                                    >
                                                        {sponsor.name}
                                                    </button>
                                                    <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">{sponsor.sponsorCode || 'NO-CODE'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-slate-600">{sponsor.contactPerson || '---'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-bold text-slate-500">{sponsor.email || sponsor.phone || '---'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {status === 'BILLED' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                                                    <CheckCircle2 size={12} /> Billed
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100">
                                                    <Clock size={12} /> Unbilled
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => setSelectedSponsor(sponsor)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            } else {
                                const student = item as Student;
                                const status = getStudentBillingStatus(student.id);
                                return (
                                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 border border-indigo-100 shrink-0 overflow-hidden">
                                                    {student.documents?.includes('Passport Size Photo') ? (
                                                        <UserIcon size={20} />
                                                    ) : (
                                                        <UserIcon size={20} />
                                                    )}
                                                </div>
                                                <div>
                                                    <button
                                                        onClick={() => setSelectedStudent(student)}
                                                        className="text-sm font-black text-slate-900 uppercase tracking-tight hover:text-indigo-600 transition-colors text-left"
                                                    >
                                                        {student.lastName.toUpperCase()}, {student.firstName}
                                                    </button>
                                                    <div className="text-[10px] font-mono font-bold text-orange-500 uppercase">ULI: {student.uli}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-slate-600">{student.contactNumber || '---'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{student.city || '---'}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">{student.province || '---'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {status === 'BILLED' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                                                    <CheckCircle2 size={12} /> Billed
                                                </span>
                                            )}
                                            {status === 'UNBILLED' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-100">
                                                    <AlertCircle size={12} /> Unbilled
                                                </span>
                                            )}
                                            {status === 'PARTIAL' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                                                    <Clock size={12} /> Partial
                                                </span>
                                            )}
                                            {status === 'NO_ENROLLMENT' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100">
                                                    No Enrollment
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => setSelectedStudent(student)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </td>
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

            {/* Student Detail Modal */}
            {selectedStudent && (
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
                                        <span className="text-[10px] font-mono font-black text-orange-500 uppercase tracking-widest bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">ULI: {selectedStudent.uli}</span>
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
                            {/* Personal Info */}
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

                            {/* Contact Info */}
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

                            {/* Enrollment Info */}
                            <div className="space-y-8">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-1.5 bg-orange-50 text-orange-500 rounded-lg"><LayoutDashboard size={14} /></div>
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
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${enr.billingStatus === 'BILLED' ? 'text-emerald-500' : 'text-amber-500'}`}>
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
            )}

            {/* Sponsor Detail Modal */}
            {selectedSponsor && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-300 border border-slate-200">
                        <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-2xl bg-white border-4 border-white shadow-xl flex items-center justify-center overflow-hidden shrink-0">
                                    <Building size={32} className="text-orange-500" />
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
                            {/* Organization Info */}
                            <div className="space-y-8">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-1.5 bg-orange-50 text-orange-500 rounded-lg"><Building size={14} /></div>
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

                            {/* Communication & Billing */}
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
                                                    ₱{invoices.filter(i => i.sponsorId === selectedSponsor.id && i.status === 'OPEN')
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
            )}
        </div>
    );
};

export default CustomerMasterListView;
