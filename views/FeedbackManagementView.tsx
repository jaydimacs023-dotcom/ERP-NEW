import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock3,
  Eye,
  FileImage,
  Filter,
  MessageSquare,
  Search,
  Send,
  X
} from 'lucide-react';
import { FeedbackTicket, FeedbackTicketPriority, FeedbackTicketStatus, Organization, User } from '../types';
import { generateUUID } from '../utils/uuid';

interface FeedbackManagementViewProps {
  tickets: FeedbackTicket[];
  currentUser: User;
  currentOrgId: string;
  organizations: Organization[];
  users: User[];
  onCreateTicket: (ticket: FeedbackTicket) => Promise<void> | void;
  onUpdateTicket: (id: string, updates: Partial<FeedbackTicket>) => Promise<void> | void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const statusOptions: FeedbackTicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const priorityOptions: FeedbackTicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const FeedbackManagementView: React.FC<FeedbackManagementViewProps> = ({
  tickets,
  currentUser,
  currentOrgId,
  organizations,
  users,
  onCreateTicket,
  onUpdateTicket,
  onNotify
}) => {
  const isSystemAdmin = currentUser.role === 'SYSTEM_ADMIN';
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | FeedbackTicketStatus>('ALL');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM' as FeedbackTicketPriority,
    screenshotDataUrl: '',
    screenshotName: ''
  });

  const visibleTickets = useMemo(() => {
    const scoped = isSystemAdmin
      ? tickets
      : tickets.filter(ticket => ticket.createdBy === currentUser.id);

    return scoped
      .filter(ticket => !ticket.isDeleted)
      .filter(ticket => statusFilter === 'ALL' || ticket.status === statusFilter)
      .filter(ticket => {
        const org = organizations.find(o => o.id === ticket.orgId);
        const haystack = [
          ticket.title,
          ticket.description,
          ticket.createdByName,
          ticket.createdByRole,
          org?.name,
          ticket.status,
          ticket.priority
        ].join(' ').toLowerCase();
        return haystack.includes(searchTerm.trim().toLowerCase());
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [currentOrgId, currentUser.id, isSystemAdmin, organizations, searchTerm, statusFilter, tickets]);

  const selectedTicket = visibleTickets.find(ticket => ticket.id === selectedTicketId) || visibleTickets[0];

  const stats = useMemo(() => ({
    open: tickets.filter(ticket => ticket.status === 'OPEN').length,
    active: tickets.filter(ticket => ticket.status === 'IN_PROGRESS').length,
    resolved: tickets.filter(ticket => ticket.status === 'RESOLVED' || ticket.status === 'CLOSED').length
  }), [tickets]);

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      priority: 'MEDIUM',
      screenshotDataUrl: '',
      screenshotName: ''
    });
  };

  const handleScreenshotChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onNotify('error', 'Please attach an image file for the screenshot.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      onNotify('error', 'Screenshot must be 3MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({
        ...prev,
        screenshotDataUrl: String(reader.result || ''),
        screenshotName: file.name
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      onNotify('error', 'Please add a title and complaint description.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateTicket({
        id: generateUUID(),
        orgId: currentUser.orgId || currentOrgId,
        title: form.title.trim(),
        description: form.description.trim(),
        screenshotDataUrl: form.screenshotDataUrl || undefined,
        screenshotName: form.screenshotName || undefined,
        priority: form.priority,
        status: 'OPEN',
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        createdByRole: currentUser.role,
        createdAt: new Date().toISOString()
      });
      resetForm();
    } catch {
      // App-level handler owns the notification; keep the form contents intact.
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (ticket: FeedbackTicket, status: FeedbackTicketStatus) => {
    const notes = adminNotes[ticket.id] ?? ticket.adminNotes ?? '';
    await onUpdateTicket(ticket.id, {
      status,
      adminNotes: notes,
      assignedTo: currentUser.id,
      resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString()
    });
  };

  const getOrgName = (orgId: string) => organizations.find(org => org.id === orgId)?.name || 'Unknown tenant';
  const getAssigneeName = (id?: string) => users.find(user => user.id === id)?.name || 'Unassigned';

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-5">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-md bg-[#025959] text-white flex items-center justify-center shadow-sm">
              <MessageSquare size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
                {isSystemAdmin ? 'Users Feedback Management' : 'Feedback Ticket'}
              </h1>
              <p className="text-sm text-gray-500 italic">
                {isSystemAdmin ? 'Review reported issues across tenants and update support status.' : 'Send a complaint with details and an optional screenshot.'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full xl:w-auto">
          <StatPill label="Open" value={stats.open} tone="rose" />
          <StatPill label="Active" value={stats.active} tone="amber" />
          <StatPill label="Done" value={stats.resolved} tone="emerald" />
        </div>
      </header>

      {!isSystemAdmin && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
            <Send size={18} className="text-[#025959]" />
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Create Feedback</h2>
          </div>
          <div className="p-6 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
            <div className="space-y-4">
              <input
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-4 py-3 rounded border border-gray-200 bg-gray-50 text-sm focus:ring-1 focus:ring-[#025959] outline-none"
                placeholder="Short title of the issue"
              />
              <textarea
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full min-h-[150px] px-4 py-3 rounded border border-gray-200 bg-gray-50 text-sm focus:ring-1 focus:ring-[#025959] outline-none resize-y"
                placeholder="Describe what happened, where it happened, and what you expected."
              />
            </div>
            <div className="space-y-4">
              <select
                value={form.priority}
                onChange={e => setForm(prev => ({ ...prev, priority: e.target.value as FeedbackTicketPriority }))}
                className="w-full px-4 py-3 rounded border border-gray-200 bg-gray-50 text-sm focus:ring-1 focus:ring-[#025959] outline-none"
              >
                {priorityOptions.map(priority => <option key={priority} value={priority}>{priority}</option>)}
              </select>
              <label className="min-h-[112px] border border-dashed border-gray-300 rounded bg-gray-50 hover:bg-gray-100 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer text-center px-4">
                <Camera size={22} className="text-gray-500" />
                <span className="text-xs font-semibold text-gray-600">{form.screenshotName || 'Attach screenshot'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleScreenshotChange} />
              </label>
              {form.screenshotDataUrl && (
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, screenshotDataUrl: '', screenshotName: '' }))}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  <X size={14} /> Remove Screenshot
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded bg-[#025959] text-white text-sm font-semibold hover:bg-[#014343] disabled:opacity-60"
              >
                <Send size={16} /> {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search feedback, user, tenant, status..."
            className="w-full pl-10 pr-4 py-2.5 rounded border border-gray-200 bg-gray-50 text-sm focus:ring-1 focus:ring-[#025959] outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={17} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as 'ALL' | FeedbackTicketStatus)}
            className="px-4 py-2.5 rounded border border-gray-200 bg-gray-50 text-sm focus:ring-1 focus:ring-[#025959] outline-none"
          >
            <option value="ALL">All Statuses</option>
            {statusOptions.map(status => <option key={status} value={status}>{formatLabel(status)}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(360px,520px)_1fr] gap-6">
        <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100">
            {visibleTickets.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                <MessageSquare size={28} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-semibold">No feedback tickets found</p>
              </div>
            ) : (
              visibleTickets.map(ticket => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={`w-full text-left p-5 hover:bg-gray-50 transition-colors ${selectedTicket?.id === ticket.id ? 'bg-[#025959]/5' : 'bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{ticket.title}</p>
                      <p className="text-xs text-gray-500 mt-1 truncate">{isSystemAdmin ? getOrgName(ticket.orgId) : ticket.createdByName}</p>
                    </div>
                    <StatusBadge status={ticket.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-4 text-xs text-gray-500">
                    <span className={`px-2 py-1 rounded border font-semibold ${getPriorityClass(ticket.priority)}`}>{ticket.priority}</span>
                    {ticket.screenshotDataUrl && <span className="inline-flex items-center gap-1"><FileImage size={13} /> Screenshot</span>}
                    <span>{formatDate(ticket.createdAt)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-md shadow-sm min-h-[420px]">
          {selectedTicket ? (
            <div className="p-6 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-gray-100 pb-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <StatusBadge status={selectedTicket.status} />
                    <span className={`px-2.5 py-1 rounded border text-xs font-semibold ${getPriorityClass(selectedTicket.priority)}`}>{selectedTicket.priority}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedTicket.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedTicket.createdByName} / {formatLabel(selectedTicket.createdByRole)} / {getOrgName(selectedTicket.orgId)}
                  </p>
                </div>
                <div className="text-xs text-gray-500 lg:text-right">
                  <p>Created {formatDate(selectedTicket.createdAt)}</p>
                  <p>Assigned: {getAssigneeName(selectedTicket.assignedTo)}</p>
                </div>
              </div>

              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Complaint Description</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-6">{selectedTicket.description}</p>
              </section>

              {selectedTicket.screenshotDataUrl && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Screenshot</h3>
                  <a href={selectedTicket.screenshotDataUrl} target="_blank" rel="noreferrer" className="block group">
                    <div className="relative rounded-md border border-gray-200 overflow-hidden bg-gray-50">
                      <img src={selectedTicket.screenshotDataUrl} alt={selectedTicket.screenshotName || 'Feedback screenshot'} className="w-full max-h-[360px] object-contain" />
                      <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded bg-white/90 border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye size={13} /> Open
                      </div>
                    </div>
                  </a>
                </section>
              )}

              {isSystemAdmin ? (
                <section className="border-t border-gray-100 pt-5 space-y-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Admin Status Update</h3>
                  <textarea
                    value={adminNotes[selectedTicket.id] ?? selectedTicket.adminNotes ?? ''}
                    onChange={e => setAdminNotes(prev => ({ ...prev, [selectedTicket.id]: e.target.value }))}
                    className="w-full min-h-[90px] px-4 py-3 rounded border border-gray-200 bg-gray-50 text-sm focus:ring-1 focus:ring-[#025959] outline-none resize-y"
                    placeholder="Add internal notes or resolution details."
                  />
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {statusOptions.map(status => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => updateStatus(selectedTicket, status)}
                        className={`px-3 py-2 rounded border text-xs font-semibold transition-colors ${selectedTicket.status === status ? 'bg-[#025959] text-white border-[#025959]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                      >
                        {formatLabel(status)}
                      </button>
                    ))}
                  </div>
                </section>
              ) : selectedTicket.adminNotes ? (
                <section className="border-t border-gray-100 pt-5">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Admin Notes</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-6">{selectedTicket.adminNotes}</p>
                </section>
              ) : null}
            </div>
          ) : (
            <div className="h-full min-h-[420px] flex items-center justify-center text-center text-gray-500 p-10">
              <div>
                <MessageSquare size={30} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-semibold">Select a ticket to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const formatLabel = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const getPriorityClass = (priority: FeedbackTicketPriority) => {
  switch (priority) {
    case 'URGENT': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'HIGH': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'MEDIUM': return 'bg-amber-50 text-amber-700 border-amber-200';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const StatusBadge: React.FC<{ status: FeedbackTicketStatus }> = ({ status }) => {
  const config = {
    OPEN: { icon: AlertCircle, className: 'bg-rose-50 text-rose-700 border-rose-200' },
    IN_PROGRESS: { icon: Clock3, className: 'bg-amber-50 text-amber-700 border-amber-200' },
    RESOLVED: { icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    CLOSED: { icon: CheckCircle2, className: 'bg-slate-50 text-slate-700 border-slate-200' }
  }[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-semibold uppercase tracking-wide ${config.className}`}>
      <Icon size={13} /> {formatLabel(status)}
    </span>
  );
};

const StatPill: React.FC<{ label: string; value: number; tone: 'rose' | 'amber' | 'emerald' }> = ({ label, value, tone }) => {
  const classes = {
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }[tone];

  return (
    <div className={`rounded border px-4 py-3 ${classes}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-75">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </div>
  );
};

export default FeedbackManagementView;
