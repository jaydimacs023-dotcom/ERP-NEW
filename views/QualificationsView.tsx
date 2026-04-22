
import React, { useMemo, useState, useEffect } from 'react';
import { Batch, Qualification, Trainer, Organization } from '../types';
import EmptyState from '../components/EmptyState';
import { generateUUID } from '../utils/uuid';
import ModalPortal from '../components/ModalPortal';
import {
  Search, Plus, Filter, Award, Code, Clock, Trash2, X, PlusCircle,
  Database, Info, ShieldCheck, FileText, ChevronRight, Layers,
  LayoutGrid, List, Timer, MoreVertical, Edit2, Loader2,
  CheckCircle, AlertCircle
} from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface QualificationsViewProps {
  qualifications: Qualification[];
  batches: Batch[];
  trainers: Trainer[];
  organization?: Organization;
  onAddQualification: (qual: Qualification) => void | Promise<void>;
  onUpdateQualification: (qual: Qualification) => void | Promise<void>;
  onDeleteQualification: (id: string) => void | Promise<boolean>;
}

const SECTORS = [
  'ICT',
  'Tourism',
  'Construction',
  'Manufacturing',
  'Agriculture',
  'Automotive',
  'Health & Social Services',
  'Electronics',
  'Metal & Engineering',
  'Others'
];

const QualificationsView: React.FC<QualificationsViewProps> = ({ qualifications, batches, trainers, organization, onAddQualification, onUpdateQualification, onDeleteQualification }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState<'ALL' | string>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showModal, setShowModal] = useState(false);
  const [editingQual, setEditingQual] = useState<Qualification | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [formData, setFormData] = useState<Partial<Qualification>>({
    name: '',
    code: '',
    durationDays: 0,
    sector: 'ICT'
  });

  const brandColor = organization?.primaryColor || '#059669';
  const sectors = useMemo(() => Array.from(new Set(qualifications.map(q => q.sector).filter(Boolean))).sort(), [qualifications]);
  const hasActiveFilters = searchTerm.trim().length > 0 || sectorFilter !== 'ALL';

  useEffect(() => {
    if (brandColor) {
      document.documentElement.style.setProperty('--brand', brandColor);
    }
  }, [brandColor]);

  const filteredQuals = qualifications.filter(q => {
    if (q.isDeleted) return false;
    const matchesSearch =
      q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.sector?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector = sectorFilter === 'ALL' || q.sector === sectorFilter;
    return matchesSearch && matchesSector;
  });

  const resetForm = () => {
    setFormData({ name: '', code: '', durationDays: 0, sector: 'ICT' });
    setEditingQual(null);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `toast-${Date.now()}`;
    const toast: Toast = { id, message, type };
    setToasts(prev => [...prev, toast]);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const openEditModal = (qual: Qualification) => {
    setEditingQual(qual);
    setFormData({
      name: qual.name,
      code: qual.code,
      durationDays: qual.durationDays,
      sector: qual.sector || 'ICT'
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code || !formData.durationDays) return;

    setIsSubmitting(true);

    try {
      if (editingQual) {
        // Update existing qualification
        const updatedQual: Qualification = {
          ...editingQual,
          name: formData.name,
          code: formData.code,
          durationDays: Number(formData.durationDays),
          sector: formData.sector,
          updatedAt: new Date().toISOString()
        };
        await onUpdateQualification(updatedQual);
        showToast(`Qualification "${formData.name}" updated successfully!`, 'success');
      } else {
        // Create new qualification with proper UUID
        const newQual: Qualification = {
          id: generateUUID(),
          orgId: '', // Will be set by App.tsx handler
          name: formData.name,
          code: formData.code,
          durationDays: Number(formData.durationDays),
          sector: formData.sector,
          createdAt: new Date().toISOString()
        };
        await onAddQualification(newQual);
        showToast(`Qualification "${formData.name}" registered successfully!`, 'success');
      }

      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving qualification:', error);
      showToast(`Failed to save qualification: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const qualToDelete = qualifications.find(q => q.id === id);
    const engagedBatch = batches.find(b => b.qualificationId === id && (b.status === 'PLANNED' || b.status === 'ONGOING'));
    const assignedTrainer = trainers.find(t => t.qualificationIds.includes(id));

    if (engagedBatch || assignedTrainer) {
      const details = engagedBatch ? `Batch ${engagedBatch.name} (${engagedBatch.status.toLowerCase()})` : `Trainer ${assignedTrainer?.firstName} ${assignedTrainer?.lastName}`;
      showToast(`Cannot delete qualification "${qualToDelete?.name || 'Unknown'}" because it is in use by ${details}.`, 'error');
      return;
    }

    if (!confirm('Are you sure you want to delete this qualification? This action cannot be undone.')) return;

    setDeletingId(id);
    try {
      const result = await onDeleteQualification(id);
      if (result === false) {
        showToast('Cannot delete qualification: It is currently in use by batches or trainers.', 'error');
      } else {
        showToast(`Qualification "${qualToDelete?.name || 'Unknown'}" deleted successfully!`, 'success');
      }
    } catch (error) {
      showToast(`Failed to delete qualification: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const getSectorColor = (sector: string) => {
    switch (sector) {
      case 'ICT': return 'teal';
      case 'Tourism': return 'emerald';
      case 'Construction': return 'amber';
      case 'Manufacturing': return 'rose';
      case 'Health & Social Services': return 'sky';
      case 'Metal & Engineering': return 'indigo';
      default: return 'slate';
    }
  };

  return (
    <div className="space-y-6 relative">
      

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight flex items-center gap-3">
            Professional Qualifications
          </h2>
          <p className="text-sm text-gray-500 font-normal italic">TESDA Registered Program Catalog (Training Regulations Compliance)</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-sm shadow-brand/20 font-medium text-sm"
        >
          <Plus size={18} /> Add New Qualification
        </button>
      </div>

      <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr_1fr] items-end">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by code, name, or sector..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm focus:border-brand outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="text-gray-400" size={18} />
            <select
              value={sectorFilter}
              onChange={e => setSectorFilter(e.target.value as any)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm font-semibold text-gray-700 focus:border-brand outline-none transition-all"
            >
              <option value="ALL">All sectors</option>
              {sectors.map(sector => (
                <option key={sector} value={sector}>{sector}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => {
                setSearchTerm('');
                setSectorFilter('ALL');
              }}
              className={`text-sm font-semibold transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            >
              Clear filters
            </button>
            <p className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-900">{filteredQuals.length}</span> of <span className="font-semibold text-gray-900">{qualifications.length}</span>
            </p>
          </div>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-brand border-b">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wide">Code & Sector</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wide">Qualification Name</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wide">Duration</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-white uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredQuals.length > 0 ? filteredQuals.map(qual => (
                <tr key={qual.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="text-xs font-mono font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded inline-block border border-brand-light w-fit">
                        {qual.code}
                      </div>
                      <div className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                        <Layers size={10} /> {qual.sector || 'Uncategorized'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-gray-800">
                      {qual.name}
                    </div>
                    <div className="text-xs font-medium text-gray-400 mt-1 uppercase">
                      Registered on {new Date(qual.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex flex-col items-center">
                      <div className="flex items-center gap-1 text-gray-700 font-semibold text-sm">
                        <Clock size={14} className="text-amber-500" /> {qual.durationDays} Days
                      </div>
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${Math.min(100, (qual.durationDays / 40) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(qual)}
                        className="p-2 hover:bg-brand-light text-gray-300 hover:text-brand rounded transition-all"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(qual.id)}
                        disabled={
                          deletingId === qual.id ||
                          batches.some(b => b.qualificationId === qual.id && (b.status === 'PLANNED' || b.status === 'ONGOING')) ||
                          trainers.some(t => t.qualificationIds.includes(qual.id))
                        }
                        className="p-2 hover:bg-rose-50 text-gray-300 hover:text-rose-600 rounded transition-all disabled:opacity-50"
                        title={
                          batches.some(b => b.qualificationId === qual.id && (b.status === 'PLANNED' || b.status === 'ONGOING'))
                            ? 'Cannot delete qualification while assigned to active batches.'
                            : trainers.some(t => t.qualificationIds.includes(qual.id))
                              ? 'Cannot delete qualification while trainers are assigned.'
                              : 'Delete'
                        }
                      >
                        {deletingId === qual.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12">
                    <EmptyState
                      title="No qualifications registered"
                      description="Add your first professional qualification to your TESDA-registered program catalog."
                      actionLabel="Add Qualification"
                      onAction={() => setShowModal(true)}
                      icon={<Award size={48} className="text-slate-300" />}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {filteredQuals.map(qual => {
            const color = getSectorColor(qual.sector || '');
            return (
              <div key={qual.id} className="bg-white rounded-md border border-gray-200 shadow-sm hover:shadow-md hover:border-brand-light transition-all group overflow-hidden flex flex-col">
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`w-12 h-12 rounded bg-${color}-50 text-${color}-600 flex items-center justify-center border border-${color}-100 transition-all group-hover:scale-110`}>
                      <Award size={24} />
                    </div>
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wide bg-gray-50 px-2 py-1 rounded border border-gray-100">
                      {qual.sector || 'N/A'}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-gray-800 leading-tight group-hover:text-brand transition-colors">
                      {qual.name}
                    </h3>
                    <p className="text-xs font-mono font-semibold text-brand uppercase">{qual.code}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-end">
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Standard Term</p>
                      <div className="flex items-center gap-2">
                        <Timer size={18} className="text-amber-500" />
                        <span className="text-lg font-semibold text-gray-800">{qual.durationDays} Days</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50/80 px-5 py-4 flex items-center justify-between border-t border-gray-100">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(qual)}
                      className="p-2 hover:bg-white text-gray-400 hover:text-brand rounded transition-all border border-transparent hover:border-brand-light"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(qual.id)}
                      disabled={deletingId === qual.id}
                      className="p-2 hover:bg-white text-gray-400 hover:text-rose-600 rounded transition-all border border-transparent hover:border-gray-200 disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === qual.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                  <button className="text-brand text-xs font-medium uppercase tracking-wide flex items-center gap-1 hover:gap-2 transition-all">
                    Details <ChevronRight size={16} strokeWidth={3} />
                  </button>
                </div>
              </div>
            );
          })}
          {filteredQuals.length === 0 && (
            <div className="col-span-full py-16 text-center text-gray-400">No matching qualifications found.</div>
          )}
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${toast.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : toast.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-brand/10 border border-brand-light text-brand'
              }`}
          >
            {toast.type === 'success' && <CheckCircle size={18} className="flex-shrink-0 text-emerald-600" />}
            {toast.type === 'error' && <AlertCircle size={18} className="flex-shrink-0 text-red-600" />}
            {toast.type === 'info' && <AlertCircle size={18} className="flex-shrink-0 text-brand" />}
            <span>{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="ml-auto text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Registration Modal */}
      {showModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-md shadow-lg w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-gray-200 my-8">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand text-white rounded shadow-sm shadow-brand/20">
                  <Award size={20} />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {editingQual ? 'Edit Qualification' : 'Register Qualification'}
                </h3>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Qualification Title</label>
                  <input
                    required
                    autoFocus
                    placeholder="e.g., Computer Systems Servicing NC II"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none text-gray-800 font-medium"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Official Ref Code</label>
                    <input
                      required
                      placeholder="e.g., CSS211-1218"
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none font-mono text-brand font-semibold"
                      value={formData.code}
                      onChange={e => setFormData({ ...formData, code: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Industry Sector</label>
                    <select
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none text-sm font-medium appearance-none"
                      value={formData.sector}
                      onChange={e => setFormData({ ...formData, sector: e.target.value })}
                    >
                      {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Standard Duration (Days)</label>
                  <div className="relative">
                    <input
                      required
                      type="number"
                      placeholder="e.g., 35"
                      className="w-full pl-3 pr-14 py-2.5 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none text-gray-800 font-semibold text-lg"
                      value={formData.durationDays || ''}
                      onChange={e => setFormData({ ...formData, durationDays: e.target.value === '' ? 0 : Number(e.target.value) })}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400 uppercase">Days</div>
                  </div>
                </div>
              </div>

              <div className="bg-brand/10 p-4 rounded border border-brand-light flex gap-3">
                <ShieldCheck size={20} className="text-brand shrink-0" />
                <p className="text-xs text-brand leading-relaxed font-medium">
                  Registration into the institutional catalog enables this qualification for batch enrollment and automated curriculum planning within the MIS system.
                </p>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded transition-all">Discard</button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-brand text-white rounded text-sm font-medium shadow-sm shadow-brand/20 hover:bg-brand-hover transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                  {editingQual ? 'Update Program' : 'Register Program'}
                </button>
              </div>
            </form>
          </div>
        </div>
</ModalPortal>
      )}
    </div>
  );
};

export default QualificationsView;

