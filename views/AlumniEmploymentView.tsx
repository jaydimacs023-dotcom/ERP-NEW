import React, { useState, useMemo } from 'react';
import { AlumniEmploymentReport, AlumniEmploymentStatus, AlumniEmploymentType, Student, Batch, Qualification, Enrollment } from '../types';
import {
    Briefcase, Search, Plus, Filter, Download, ExternalLink,
    MapPin, Calendar, DollarSign, CheckCircle2, X, MoreVertical,
    BookOpen, Building2, TrendingUp, GraduationCap, ChevronLeft, ChevronRight,
    ChevronsLeft, ChevronsRight, Info
} from 'lucide-react';

interface AlumniEmploymentViewProps {
    students: Student[];
    enrollments: Enrollment[];
    alumniReports: AlumniEmploymentReport[];
    batches: Batch[];
    qualifications: Qualification[];
    onAddReport: (report: AlumniEmploymentReport) => void;
    onUpdateReport: (report: AlumniEmploymentReport) => void;
    onDeleteReport: (id: string) => void;
}

const PAGE_SIZE = 10;

const AlumniEmploymentView: React.FC<AlumniEmploymentViewProps> = ({
    students,
    enrollments,
    alumniReports,
    batches,
    qualifications,
    onAddReport,
    onUpdateReport,
    onDeleteReport
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<AlumniEmploymentStatus | 'ALL'>('ALL');
    const [relevanceFilter, setRelevanceFilter] = useState<'ALL' | 'YES' | 'NO'>('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [showModal, setShowModal] = useState(false);
    const [editingReport, setEditingReport] = useState<AlumniEmploymentReport | null>(null);

    const [formData, setFormData] = useState<Partial<AlumniEmploymentReport>>({
        employmentStatus: AlumniEmploymentStatus.EMPLOYED,
        isRelatedToCourse: true,
        employmentType: AlumniEmploymentType.REGULAR
    });

    // Graduated Students Filtering
    const graduates = useMemo(() => {
        // A student is considered a graduate if they have at least one enrollment with status 'COMPLETED'
        const graduatedStudentIds = new Set(
            enrollments
                .filter(e => e.enrollmentStatus === 'COMPLETED')
                .map(e => e.studentId)
        );
        return students.filter(s => graduatedStudentIds.has(s.id));
    }, [students, enrollments]);

    // Derived Stats
    const stats = useMemo(() => {
        const total = alumniReports.length;
        if (total === 0) return { employmentRate: 0, relatedRate: 0, total };

        const employedCount = alumniReports.filter(r =>
            r.employmentStatus === AlumniEmploymentStatus.EMPLOYED ||
            r.employmentStatus === AlumniEmploymentStatus.SELF_EMPLOYED
        ).length;

        const relatedCount = alumniReports.filter(r => r.isRelatedToCourse).length;

        return {
            total,
            employmentRate: Math.round((employedCount / total) * 100),
            relatedRate: Math.round((relatedCount / total) * 100)
        };
    }, [alumniReports]);

    // Filtering
    const filteredReports = useMemo(() => {
        return alumniReports.filter(report => {
            const student = students.find(s => s.id === report.studentId);
            const studentName = student ? `${student.firstName} ${student.lastName}`.toLowerCase() : '';
            const matchesSearch = studentName.includes(searchTerm.toLowerCase()) ||
                (report.employerName || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = statusFilter === 'ALL' || report.employmentStatus === statusFilter;
            const matchesRelevance = relevanceFilter === 'ALL' ||
                (relevanceFilter === 'YES' ? report.isRelatedToCourse : !report.isRelatedToCourse);

            return matchesSearch && matchesStatus && matchesRelevance;
        });
    }, [alumniReports, students, searchTerm, statusFilter, relevanceFilter]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE));
    const paginatedReports = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredReports.slice(start, start + PAGE_SIZE);
    }, [filteredReports, currentPage]);

    const handleExport = () => {
        const headers = ['Student', 'Email', 'Employment Status', 'Employer', 'Position', 'Type', 'Hired Date', 'Related to Course'];
        const rows = filteredReports.map(r => {
            const s = students.find(stud => stud.id === r.studentId);
            return [
                `${s?.firstName} ${s?.lastName}`,
                s?.email || '',
                r.employmentStatus,
                r.employerName || 'N/A',
                r.position || 'N/A',
                r.employmentType || 'N/A',
                r.dateHired || 'N/A',
                r.isRelatedToCourse ? 'Yes' : 'No'
            ].join(',');
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Alumni_Employment_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingReport) {
            onUpdateReport({ ...editingReport, ...formData } as AlumniEmploymentReport);
        } else {
            onAddReport({
                ...formData,
                id: `report-${Date.now()}`,
                orgId: 'temp', // Replaced in App.tsx
                createdAt: new Date().toISOString()
            } as AlumniEmploymentReport);
        }
        setShowModal(false);
        setEditingReport(null);
        setFormData({
            employmentStatus: AlumniEmploymentStatus.EMPLOYED,
            isRelatedToCourse: true,
            employmentType: AlumniEmploymentType.REGULAR
        });
    };

    return (
        <div className="space-y-6 pb-20 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Alumni Tracer & Employment Reports</h2>
                    <p className="text-sm text-gray-500 mt-1 italic">Registry Oversight & Graduate Career Tracking</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded hover:bg-gray-50 transition-all font-semibold text-sm"
                    >
                        <Download size={18} className="text-orange-600" /> Export CSV
                    </button>
                    <button
                        onClick={() => { setShowModal(true); setEditingReport(null); }}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-all font-bold text-sm shadow-md"
                    >
                        <Plus size={18} /> Add Record
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><GraduationCap size={24} /></div>
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tracked Alumni</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp size={24} /></div>
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Employment Rate</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.employmentRate}%</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-orange-50 text-orange-600 rounded-lg"><Briefcase size={24} /></div>
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Course Related</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.relatedRate}%</p>
                    </div>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col lg:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by student or employer..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500/20 outline-none text-sm transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500/20 transition-all font-medium text-gray-600"
                    >
                        <option value="ALL">All Status</option>
                        {Object.values(AlumniEmploymentStatus).map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <select
                        value={relevanceFilter}
                        onChange={(e) => setRelevanceFilter(e.target.value as any)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500/20 transition-all font-medium text-gray-600"
                    >
                        <option value="ALL">Course Relevance</option>
                        <option value="YES">Related</option>
                        <option value="NO">Not Related</option>
                    </select>
                </div>
            </div>

            {/* Reports Table */}
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Alumni Details</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Employment Information</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Status & Date</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paginatedReports.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2 text-gray-300">
                                            <Briefcase size={40} />
                                            <p className="text-sm font-medium">No employment reports found.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedReports.map(report => {
                                const student = students.find(s => s.id === report.studentId);
                                const isEmployed = report.employmentStatus === AlumniEmploymentStatus.EMPLOYED ||
                                    report.employmentStatus === AlumniEmploymentStatus.SELF_EMPLOYED;

                                return (
                                    <tr key={report.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center font-bold text-xs border border-orange-100 shadow-sm">
                                                    {student?.firstName[0]}{student?.lastName[0]}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 leading-none mb-1">
                                                        {student?.lastName.toUpperCase()}, {student?.firstName}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate max-w-[150px]">{student?.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {isEmployed ? (
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                                                        <Building2 size={14} className="text-gray-400" /> {report.employerName}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                                                        <Briefcase size={12} /> {report.position} ({report.employmentType})
                                                    </p>
                                                </div>
                                            ) : (
                                                <span className="text-xs font-medium text-gray-400 italic">Not applicable</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1.5">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider w-fit border ${report.employmentStatus === AlumniEmploymentStatus.EMPLOYED ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                    report.employmentStatus === AlumniEmploymentStatus.FURTHER_STUDIES ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                        'bg-gray-50 text-gray-600 border-gray-100'
                                                    }`}>
                                                    {report.employmentStatus}
                                                </span>
                                                {report.dateHired && (
                                                    <p className="text-[10px] text-gray-400 font-semibold flex items-center gap-1">
                                                        <Calendar size={10} /> Hired: {new Date(report.dateHired).toLocaleDateString()}
                                                    </p>
                                                )}
                                                {report.isRelatedToCourse && (
                                                    <span className="text-[10px] font-bold text-orange-600 flex items-center gap-1">
                                                        <CheckCircle2 size={10} /> Related to Training
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                <button
                                                    onClick={() => { setEditingReport(report); setFormData(report); setShowModal(true); }}
                                                    className="p-1.5 hover:bg-orange-50 text-gray-400 hover:text-orange-600 rounded transition-all"
                                                >
                                                    <ExternalLink size={16} />
                                                </button>
                                                <button
                                                    onClick={() => { if (confirm('Delete record?')) onDeleteReport(report.id); }}
                                                    className="p-1.5 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded transition-all"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Table Footer */}
                {filteredReports.length > PAGE_SIZE && (
                    <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500">
                            Page {currentPage} of {totalPages}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="p-1.5 text-gray-400 hover:text-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronsLeft size={16} />
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 text-gray-400 hover:text-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1.5 text-gray-400 hover:text-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="p-1.5 text-gray-400 hover:text-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronsRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 border border-gray-100 flex flex-col h-full max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center sticky top-0 z-10 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-600 text-white rounded-lg"><Plus size={20} /></div>
                                <h3 className="text-lg font-bold text-gray-800 tracking-tight uppercase">
                                    {editingReport ? 'Edit Employment Record' : 'Add New Tracer Entry'}
                                </h3>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={24} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-0 scrollbar-hide">
                            <div className="p-8 space-y-8">
                                {/* Section 1: Alumni Identity */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-orange-600 border-b border-orange-100 pb-2">
                                        <GraduationCap size={18} />
                                        <h4 className="text-xs font-bold uppercase tracking-widest">Learner Identification</h4>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Select Student *</label>
                                            <select
                                                required
                                                disabled={!!editingReport}
                                                value={formData.studentId || ''}
                                                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20 outline-none transition-all font-semibold"
                                            >
                                                <option value="">-- Choose Alumni (Graduates Only) --</option>
                                                {graduates.map(s => (
                                                    <option key={s.id} value={s.id}>{s.lastName}, {s.firstName} ({s.uli})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Employment Status */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-orange-600 border-b border-orange-100 pb-2">
                                        <Briefcase size={18} />
                                        <h4 className="text-xs font-bold uppercase tracking-widest">Current Career Status</h4>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Employment Status *</label>
                                            <select
                                                required
                                                value={formData.employmentStatus}
                                                onChange={(e) => setFormData({ ...formData, employmentStatus: e.target.value as any })}
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20 outline-none transition-all font-semibold"
                                            >
                                                {Object.values(AlumniEmploymentStatus).map(s => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {(formData.employmentStatus === AlumniEmploymentStatus.EMPLOYED || formData.employmentStatus === AlumniEmploymentStatus.SELF_EMPLOYED) && (
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Employment Type</label>
                                                <select
                                                    value={formData.employmentType}
                                                    onChange={(e) => setFormData({ ...formData, employmentType: e.target.value as any })}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20 outline-none transition-all font-semibold"
                                                >
                                                    {Object.values(AlumniEmploymentType).map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Section 3: Job Details - Conditioned */}
                                {(formData.employmentStatus === AlumniEmploymentStatus.EMPLOYED || formData.employmentStatus === AlumniEmploymentStatus.SELF_EMPLOYED) && (
                                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                        <div className="flex items-center gap-2 text-orange-600 border-b border-orange-100 pb-2">
                                            <Building2 size={18} />
                                            <h4 className="text-xs font-bold uppercase tracking-widest">Professional Details</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Employer Name / Company</label>
                                                <input
                                                    type="text"
                                                    value={formData.employerName || ''}
                                                    onChange={(e) => setFormData({ ...formData, employerName: e.target.value })}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20 outline-none transition-all font-semibold"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Position / Job Title</label>
                                                <input
                                                    type="text"
                                                    value={formData.position || ''}
                                                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20 outline-none transition-all font-semibold"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Hiring Date</label>
                                                <input
                                                    type="date"
                                                    value={formData.dateHired || ''}
                                                    onChange={(e) => setFormData({ ...formData, dateHired: e.target.value })}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20 outline-none transition-all font-semibold"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Salary Range (Monthly)</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. 20k - 30k"
                                                    value={formData.salaryRange || ''}
                                                    onChange={(e) => setFormData({ ...formData, salaryRange: e.target.value })}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20 outline-none transition-all font-semibold"
                                                />
                                            </div>
                                            <div className="flex items-center pt-8">
                                                <label className="flex items-center gap-3 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.isRelatedToCourse}
                                                        onChange={(e) => setFormData({ ...formData, isRelatedToCourse: e.target.checked })}
                                                        className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500/20 transition-all cursor-pointer"
                                                    />
                                                    <span className="text-sm font-bold text-gray-700 group-hover:text-orange-600 transition-colors uppercase">Related to Training Program</span>
                                                </label>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Employer Address</label>
                                                <textarea
                                                    rows={2}
                                                    value={formData.employerAddress || ''}
                                                    onChange={(e) => setFormData({ ...formData, employerAddress: e.target.value })}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20 outline-none transition-all font-semibold"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Info Note */}
                                <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 flex gap-3">
                                    <Info size={18} className="text-orange-600 shrink-0" />
                                    <p className="text-[11px] text-orange-800 leading-relaxed font-semibold uppercase tracking-tight">
                                        This information is part of the institutional tracer system. ensure data accuracy as it contributes to periodic employment reporting and compliance audits.
                                    </p>
                                </div>
                            </div>

                            {/* Form Footer */}
                            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end items-center gap-3 sticky bottom-0 z-10 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-2.5 text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-2.5 bg-orange-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest shadow-md hover:bg-orange-700 transition-all active:scale-95"
                                >
                                    {editingReport ? 'Update Record' : 'Save Tracer Entry'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AlumniEmploymentView;
