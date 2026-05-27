import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  List,
  Plus,
  Search,
  TableProperties,
} from 'lucide-react';
import { Invoice, Sponsor, Student, User } from '../types';
import ModalPortal from '../components/ModalPortal';

type TaskStatus = 'Pending' | 'In Progress' | 'Completed';
type DueIndicator = 'Upcoming' | 'Due Today' | 'Overdue' | 'Completed';
type TaskPriority = 'Low' | 'Normal' | 'High';
type CustomerType = 'Sponsor' | 'Student';
type CalendarMode = 'Month' | 'Week' | 'List';

interface ARTask {
  id: string;
  taskDate: string;
  taskTime: string;
  taskType: string;
  customerType: CustomerType;
  customerId: string;
  customerName: string;
  relatedReference: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo: string;
  remarks: string;
  createdBy: string;
  createdDate: string;
  lastUpdatedBy: string;
  lastUpdatedDate: string;
  completedBy?: string;
  completedDate?: string;
  completionRemarks?: string;
}

interface ARCalendarTasksViewProps {
  sponsors: Sponsor[];
  students: Student[];
  invoices: Invoice[];
  currentUser?: User | null;
  brandColor?: string;
  onNotify?: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

const taskTypes = ['Follow-up', 'Send SOA', 'Payment Verification', 'Aging Review', 'Customer Call', 'Promise to Pay'];
const priorities: TaskPriority[] = ['High', 'Normal', 'Low'];
const statusOptions: TaskStatus[] = ['Pending', 'In Progress', 'Completed'];

const todayKey = () => new Date().toISOString().split('T')[0];

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDate = (dateKey: string) =>
  new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const formatMonth = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const getStudentName = (student: Student) =>
  `${student.firstName} ${student.lastName}`.trim();

const getDueIndicator = (task: Pick<ARTask, 'taskDate' | 'status'>): DueIndicator => {
  if (task.status === 'Completed') return 'Completed';
  const today = todayKey();
  if (task.taskDate > today) return 'Upcoming';
  if (task.taskDate === today) return 'Due Today';
  return 'Overdue';
};

const brandTint = (hex: string, opacity: number) => {
  const match = hex.trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return `rgb(16 185 129 / ${opacity})`;
  const [, r, g, b] = match;
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${opacity})`;
};

const createSeedTasks = (
  invoices: Invoice[],
  sponsors: Sponsor[],
  students: Student[],
  currentUser?: User | null
): ARTask[] => {
  const userName = currentUser?.name || 'AR Specialist';
  const today = new Date(`${todayKey()}T00:00:00`);
  const fallbackDates = [-5, -2, 0, 1, 4, 8].map(offset => {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    return toDateKey(date);
  });

  const invoiceTasks = invoices
    .filter(invoice => !invoice.isDeleted && invoice.status === 'OPEN' && Number(invoice.balanceDue || 0) > 0)
    .sort((a, b) => (a.dueDate || a.invoiceDate || '').localeCompare(b.dueDate || b.invoiceDate || ''))
    .map((invoice, index) => {
      const sponsor = sponsors.find(item => item.id === invoice.sponsorId);
      const student = students.find(item => item.id === invoice.studentId);
      const customerType: CustomerType = sponsor ? 'Sponsor' : 'Student';
      const customerName = sponsor?.name || (student ? getStudentName(student) : 'Student Account');
      const taskDate = invoice.dueDate || fallbackDates[index % fallbackDates.length];
      const isPastDue = taskDate < todayKey();
      const taskType = isPastDue
        ? 'Collection Follow-up'
        : taskDate === todayKey()
          ? 'Customer Call'
          : 'Send SOA';
      const priority: TaskPriority = isPastDue ? 'High' : 'Normal';
      return {
        id: `seed-${invoice.id}`,
        taskDate,
        taskTime: index % 2 === 0 ? '09:00' : '14:00',
        taskType,
        customerType,
        customerId: sponsor?.id || student?.id || '',
        customerName,
        relatedReference: invoice.invoiceNo,
        description: isPastDue
          ? 'Past due open invoice requires collection follow-up and documented next action.'
          : 'Monitor open invoice due date and prepare the next receivable action.',
        priority,
        status: 'Pending',
        assignedTo: userName,
        remarks: '',
        createdBy: userName,
        createdDate: new Date().toISOString(),
        lastUpdatedBy: userName,
        lastUpdatedDate: new Date().toISOString(),
      } satisfies ARTask;
    });

  return invoiceTasks;
};

const cn = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ');

const ARCalendarTasksView: React.FC<ARCalendarTasksViewProps> = ({
  sponsors,
  students,
  invoices,
  currentUser,
  brandColor = '#059669',
  onNotify,
}) => {
  const seedTasks = useMemo(
    () => createSeedTasks(invoices, sponsors, students, currentUser),
    [currentUser, invoices, sponsors, students]
  );
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('Month');
  const [tasks, setTasks] = useState<ARTask[]>(() => seedTasks);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | TaskStatus>('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | TaskPriority>('All');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [form, setForm] = useState({
    taskType: 'Follow-up',
    taskDate: todayKey(),
    taskTime: '09:00',
    customerType: 'Sponsor' as CustomerType,
    customerId: sponsors[0]?.id || students[0]?.id || '',
    relatedReference: invoices[0]?.invoiceNo || '',
    description: '',
    priority: 'Normal' as TaskPriority,
    assignedTo: currentUser?.name || 'AR Specialist',
  });

  const customerOptions = form.customerType === 'Sponsor'
    ? sponsors.map(sponsor => ({ id: sponsor.id, name: sponsor.name }))
    : students.map(student => ({ id: student.id, name: getStudentName(student) }));

  const selectedTask = selectedTaskId ? tasks.find(task => task.id === selectedTaskId) || null : null;
  const today = todayKey();

  useEffect(() => {
    setTasks(prev => {
      const manualTasks = prev.filter(task => !task.id.startsWith('seed-'));
      return [...seedTasks, ...manualTasks];
    });
    setSelectedTaskId(prev => {
      if (!prev || !prev.startsWith('seed-')) return prev;
      return seedTasks.some(task => task.id === prev) ? prev : null;
    });
  }, [seedTasks]);

  const metrics = useMemo(() => {
    const completedThisMonth = tasks.filter(task => {
      if (task.status !== 'Completed' || !task.completedDate) return false;
      const completed = new Date(task.completedDate);
      return completed.getMonth() === currentMonth.getMonth() && completed.getFullYear() === currentMonth.getFullYear();
    }).length;

    return {
      today: tasks.filter(task => task.taskDate === today).length,
      pending: tasks.filter(task => task.status === 'Pending').length,
      inProgress: tasks.filter(task => task.status === 'In Progress').length,
      overdue: tasks.filter(task => getDueIndicator(task) === 'Overdue').length,
      completedThisMonth,
    };
  }, [currentMonth, tasks, today]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = toDateKey(date);
      return {
        key,
        date,
        inMonth: date.getMonth() === currentMonth.getMonth(),
        tasks: tasks.filter(task => task.taskDate === key),
      };
    });
  }, [currentMonth, tasks]);

  const filteredTasks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return tasks
      .filter(task => statusFilter === 'All' || task.status === statusFilter)
      .filter(task => typeFilter === 'All' || task.taskType === typeFilter)
      .filter(task => priorityFilter === 'All' || task.priority === priorityFilter)
      .filter(task => {
        if (!term) return true;
        return [
          task.taskType,
          task.customerType,
          task.customerName,
          task.relatedReference,
          task.description,
          task.assignedTo,
          getDueIndicator(task),
        ].some(value => value.toLowerCase().includes(term));
      })
      .sort((a, b) => `${a.taskDate} ${a.taskTime}`.localeCompare(`${b.taskDate} ${b.taskTime}`));
  }, [priorityFilter, searchTerm, statusFilter, tasks, typeFilter]);

  const upcomingTasks = useMemo(() => tasks
    .filter(task => task.status !== 'Completed')
    .sort((a, b) => `${a.taskDate} ${a.taskTime}`.localeCompare(`${b.taskDate} ${b.taskTime}`))
    .slice(0, 6), [tasks]);

  const saveTask = () => {
    const customer = customerOptions.find(option => option.id === form.customerId);
    if (!customer) {
      onNotify?.('error', 'Please select a customer or payor for the task.');
      return;
    }

    const userName = currentUser?.name || 'AR Specialist';
    const now = new Date().toISOString();
    const task: ARTask = {
      id: `task-${Date.now()}`,
      ...form,
      customerName: customer.name,
      status: 'Pending',
      remarks: '',
      createdBy: userName,
      createdDate: now,
      lastUpdatedBy: userName,
      lastUpdatedDate: now,
    };

    setTasks(prev => [task, ...prev]);
    setSelectedTaskId(task.id);
    setShowTaskForm(false);
    onNotify?.('success', 'Task created as Pending.');
  };

  const updateTask = (taskId: string, updates: Partial<ARTask>) => {
    const userName = currentUser?.name || 'AR Specialist';
    setTasks(prev => prev.map(task => task.id === taskId
      ? { ...task, ...updates, lastUpdatedBy: userName, lastUpdatedDate: new Date().toISOString() }
      : task));
  };

  const markCompleted = () => {
    if (!selectedTask) return;
    const userName = currentUser?.name || 'AR Specialist';
    updateTask(selectedTask.id, {
      status: 'Completed',
      completedBy: userName,
      completedDate: new Date().toISOString(),
      completionRemarks: completionRemarks || selectedTask.completionRemarks || 'Completed by AR Specialist.',
    });
    setCompletionRemarks('');
    onNotify?.('success', 'Task marked as Completed.');
  };

  const moveMonth = (direction: -1 | 1) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  return (
    <div className="space-y-4 pb-10 font-sans text-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tighter">AR Calendar &amp; Tasks</h2>
          <p className="mt-1 text-sm italic font-medium text-slate-500">Manage AR follow-ups, collection schedules, and task reminders.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowTaskForm(true)}
          className="inline-flex h-10 items-center gap-2 rounded px-4 text-xs font-bold text-white shadow-sm"
          style={{ backgroundColor: brandColor }}
        >
          <Plus size={16} /> New Task
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <MetricCard label="Today's Tasks" value={metrics.today} note="Tasks scheduled for today" accent={brandColor} />
        <MetricCard label="Pending Tasks" value={metrics.pending} note="Tasks not yet started" accent="#2563eb" />
        <MetricCard label="In Progress" value={metrics.inProgress} note="Tasks currently being handled" accent="#7c3aed" />
        <MetricCard label="Overdue Tasks" value={metrics.overdue} note="Past due and not completed" accent="#dc2626" />
        <MetricCard label="Completed This Month" value={metrics.completedThisMonth} note="Manually marked as completed" accent="#059669" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setCurrentMonth(new Date())} className="h-9 rounded border border-gray-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm">Today</button>
          <div className="flex overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
            <button type="button" onClick={() => moveMonth(-1)} className="flex h-9 w-10 items-center justify-center border-r border-gray-200 text-slate-600"><ChevronLeft size={16} /></button>
            <button type="button" onClick={() => moveMonth(1)} className="flex h-9 w-10 items-center justify-center text-slate-600"><ChevronRight size={16} /></button>
          </div>
          <div className="flex items-center gap-2 px-1 text-base font-bold text-slate-800">
            <CalendarDays size={18} style={{ color: brandColor }} />
            {formatMonth(currentMonth)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
            {(['Month', 'Week', 'List'] as CalendarMode[]).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setCalendarMode(mode)}
                className={cn('inline-flex h-9 items-center gap-1.5 px-3 text-xs font-bold', calendarMode === mode ? 'text-white' : 'text-slate-600')}
                style={calendarMode === mode ? { backgroundColor: brandColor } : undefined}
              >
                {mode === 'Month' && <CalendarDays size={14} />}
                {mode === 'Week' && <TableProperties size={14} />}
                {mode === 'List' && <List size={14} />}
                {mode}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              className="h-9 w-56 rounded border border-gray-200 bg-white pl-3 pr-9 text-xs font-semibold text-slate-700 outline-none focus:border-slate-300"
              placeholder="Search tasks..."
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
          {calendarMode === 'List' ? (
            <div className="divide-y divide-gray-100">
              {filteredTasks.slice(0, 12).map(task => (
                <TaskListRow key={task.id} task={task} brandColor={brandColor} onSelect={() => setSelectedTaskId(task.id)} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 text-xs">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="border-b border-gray-200 bg-slate-50 px-3 py-2 text-center font-black text-slate-600">{day}</div>
              ))}
              {calendarDays.map(day => (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => day.tasks[0] && setSelectedTaskId(day.tasks[0].id)}
                  className={cn('min-h-28 border-b border-r border-gray-100 p-2 text-left transition hover:bg-slate-50', !day.inMonth && 'bg-slate-50/60 text-slate-300')}
                >
                  <div className={cn('mb-2 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black', day.key === today && 'text-white')} style={day.key === today ? { backgroundColor: brandColor } : undefined}>
                    {day.date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {day.tasks.slice(0, 3).map(task => (
                      <div key={task.id} className="rounded px-2 py-1" style={{ backgroundColor: indicatorStyle(getDueIndicator(task)).soft }}>
                        <div className="truncate text-[11px] font-black text-slate-900">{task.taskType}</div>
                        <div className="truncate text-[10px] font-semibold text-slate-600">{task.customerName}</div>
                        <div className="mt-1 text-right text-[10px] font-black" style={{ color: indicatorStyle(getDueIndicator(task)).color }}>{getDueIndicator(task)}</div>
                      </div>
                    ))}
                    {day.tasks.length > 3 && <div className="text-[10px] font-bold text-slate-500">+{day.tasks.length - 3} more</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900">Upcoming Tasks</h3>
            <button type="button" onClick={() => setCalendarMode('List')} className="text-xs font-bold" style={{ color: brandColor }}>View all</button>
          </div>
          <div className="space-y-3">
            {upcomingTasks.map(task => (
              <button key={task.id} type="button" onClick={() => setSelectedTaskId(task.id)} className="flex w-full items-start gap-3 text-left">
                <span className="mt-1 h-2 w-2 rounded-full" style={{ backgroundColor: indicatorStyle(getDueIndicator(task)).color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black text-slate-900">{task.taskType}</span>
                  <span className="block truncate text-[11px] font-semibold text-slate-600">{task.customerName}</span>
                  <span className="block truncate text-[11px] font-semibold text-slate-500">{task.relatedReference}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[11px] font-bold text-slate-700">{formatDate(task.taskDate)}</span>
                  <span className="block text-[11px] font-semibold text-slate-500">{task.taskTime}</span>
                  <IndicatorBadge indicator={getDueIndicator(task)} />
                </span>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <section className="rounded-md border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
          <h3 className="text-sm font-black text-slate-900">Task List (All)</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'All' | TaskStatus)} className="h-9 rounded border border-gray-200 bg-white px-3 text-xs font-bold text-slate-700">
              <option>All</option>
              {statusOptions.map(status => <option key={status}>{status}</option>)}
            </select>
            <select value={typeFilter} onChange={event => setTypeFilter(event.target.value)} className="h-9 rounded border border-gray-200 bg-white px-3 text-xs font-bold text-slate-700">
              <option>All</option>
              {taskTypes.map(type => <option key={type}>{type}</option>)}
            </select>
            <select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as 'All' | TaskPriority)} className="h-9 rounded border border-gray-200 bg-white px-3 text-xs font-bold text-slate-700">
              <option>All</option>
              {priorities.map(priority => <option key={priority}>{priority}</option>)}
            </select>
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded border border-gray-200 bg-white text-slate-500">
              <Filter size={15} />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Task Date</th>
                <th className="px-4 py-3">Task Type</th>
                <th className="px-4 py-3">Customer Type</th>
                <th className="px-4 py-3">Customer / Payor</th>
                <th className="px-4 py-3">Related Reference</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due Indicator</th>
                <th className="px-4 py-3">Assigned To</th>
                <th className="px-4 py-3">Completion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTasks.map(task => (
                <tr
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className="cursor-pointer hover:bg-slate-50/70"
                  tabIndex={0}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedTaskId(task.id);
                    }
                  }}
                >
                  <td className="px-4 py-3 font-semibold text-slate-700">{formatDate(task.taskDate)} {task.taskTime}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{task.taskType}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{task.customerType}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{task.customerName}</td>
                  <td className="px-4 py-3 font-mono text-[11px] font-semibold text-slate-700">{task.relatedReference || '-'}</td>
                  <td className="max-w-[240px] truncate px-4 py-3 font-medium text-slate-600">{task.description || '-'}</td>
                  <td className="px-4 py-3"><PriorityBadge priority={task.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                  <td className="px-4 py-3"><IndicatorBadge indicator={getDueIndicator(task)} /></td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{task.assignedTo}</td>
                  <td className="px-4 py-3 font-semibold text-slate-500">{task.status === 'Completed' ? 'Completed' : 'Open task'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs font-semibold text-slate-500">
          <span>Showing 1 to {filteredTasks.length} of {tasks.length} tasks</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3].map(page => (
              <span key={page} className={cn('flex h-7 w-7 items-center justify-center rounded border text-xs font-bold', page === 1 ? 'text-white' : 'border-gray-200 bg-white text-slate-600')} style={page === 1 ? { backgroundColor: brandColor, borderColor: brandColor } : undefined}>{page}</span>
            ))}
          </div>
        </div>
      </section>

      {showTaskForm && (
        <ModalShell title="New AR Task" subtitle="Manual task creation saves the item as Pending." onClose={() => setShowTaskForm(false)}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Task Type"><select value={form.taskType} onChange={event => setForm(prev => ({ ...prev, taskType: event.target.value }))} className="field-control">{taskTypes.map(type => <option key={type}>{type}</option>)}</select></Field>
            <Field label="Task Date"><input type="date" value={form.taskDate} onChange={event => setForm(prev => ({ ...prev, taskDate: event.target.value }))} className="field-control" /></Field>
            <Field label="Task Time"><input type="time" value={form.taskTime} onChange={event => setForm(prev => ({ ...prev, taskTime: event.target.value }))} className="field-control" /></Field>
            <Field label="Customer Type"><select value={form.customerType} onChange={event => setForm(prev => ({ ...prev, customerType: event.target.value as CustomerType, customerId: event.target.value === 'Sponsor' ? sponsors[0]?.id || '' : students[0]?.id || '' }))} className="field-control"><option>Sponsor</option><option>Student</option></select></Field>
            <Field label="Customer / Payor"><select value={form.customerId} onChange={event => setForm(prev => ({ ...prev, customerId: event.target.value }))} className="field-control">{customerOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></Field>
            <Field label="Related Reference"><input value={form.relatedReference} onChange={event => setForm(prev => ({ ...prev, relatedReference: event.target.value }))} className="field-control" placeholder="INV / SOA / PAY reference" /></Field>
            <Field label="Priority"><select value={form.priority} onChange={event => setForm(prev => ({ ...prev, priority: event.target.value as TaskPriority }))} className="field-control">{priorities.map(priority => <option key={priority}>{priority}</option>)}</select></Field>
            <div className="md:col-span-2"><Field label="Description"><textarea value={form.description} onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))} className="field-control min-h-20 py-3" /></Field></div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setShowTaskForm(false)} className="h-10 rounded border border-gray-200 bg-white px-4 text-xs font-bold text-slate-700">Cancel</button>
            <button type="button" onClick={saveTask} className="h-10 rounded px-5 text-xs font-bold text-white" style={{ backgroundColor: brandColor }}>Save Pending Task</button>
          </div>
        </ModalShell>
      )}

      {selectedTask && (
        <ModalShell title={selectedTask.taskType} subtitle={`${selectedTask.customerName} - ${selectedTask.relatedReference || 'No reference'}`} onClose={() => setSelectedTaskId(null)}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Status"><select value={selectedTask.status} onChange={event => updateTask(selectedTask.id, { status: event.target.value as TaskStatus })} className="field-control">{statusOptions.map(status => <option key={status}>{status}</option>)}</select></Field>
                <Field label="Due Indicator"><div className="field-control flex items-center"><IndicatorBadge indicator={getDueIndicator(selectedTask)} /></div></Field>
              </div>
              <Field label="Follow-up Notes"><textarea value={selectedTask.remarks} onChange={event => updateTask(selectedTask.id, { remarks: event.target.value })} className="field-control min-h-24 py-3" /></Field>
              <Field label="Completion Remarks"><textarea value={completionRemarks} onChange={event => setCompletionRemarks(event.target.value)} className="field-control min-h-20 py-3" placeholder={selectedTask.completionRemarks || 'Required when marking as completed'} /></Field>
              <button type="button" onClick={markCompleted} disabled={selectedTask.status === 'Completed'} className="inline-flex h-10 items-center gap-2 rounded px-4 text-xs font-bold text-white disabled:opacity-50" style={{ backgroundColor: brandColor }}>
                <CheckCircle2 size={16} /> Mark as Completed
              </button>
            </div>
            <div className="rounded border border-gray-200 bg-slate-50 p-4">
              <h4 className="mb-3 text-xs font-black uppercase text-slate-500">Audit Trail</h4>
              <AuditLine label="Created By" value={selectedTask.createdBy} />
              <AuditLine label="Created Date" value={new Date(selectedTask.createdDate).toLocaleString()} />
              <AuditLine label="Last Updated By" value={selectedTask.lastUpdatedBy} />
              <AuditLine label="Last Updated Date" value={new Date(selectedTask.lastUpdatedDate).toLocaleString()} />
              <AuditLine label="Completed By" value={selectedTask.completedBy || '-'} />
              <AuditLine label="Completed Date" value={selectedTask.completedDate ? new Date(selectedTask.completedDate).toLocaleString() : '-'} />
              <AuditLine label="Completion Remarks" value={selectedTask.completionRemarks || '-'} />
            </div>
          </div>
        </ModalShell>
      )}

      <style>{`
        .field-control {
          width: 100%;
          min-height: 40px;
          border-radius: 4px;
          border: 1px solid #e5e7eb;
          background: #fff;
          padding: 0 12px;
          font-size: 12px;
          font-weight: 700;
          color: #334155;
          outline: none;
        }
        .field-control:focus {
          border-color: ${brandTint(brandColor, 0.5)};
          box-shadow: 0 0 0 4px ${brandTint(brandColor, 0.12)};
        }
      `}</style>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: number; note: string; accent: string }> = ({ label, value, note, accent }) => (
  <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
    <div className="text-xs font-black text-slate-700">{label}</div>
    <div className="mt-2 text-2xl font-black" style={{ color: accent }}>{value}</div>
    <div className="mt-1 text-[11px] font-semibold text-slate-500">{note}</div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-black uppercase text-slate-500">{label}</span>
    {children}
  </label>
);

const ModalShell: React.FC<{ title: string; subtitle: string; children: React.ReactNode; onClose: () => void }> = ({ title, subtitle, children, onClose }) => (
  <ModalPortal>
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-md bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 tracking-tighter">{title}</h3>
            <p className="mt-1 text-sm italic font-medium text-slate-500">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded border border-gray-200 px-3 py-1.5 text-xs font-bold text-slate-600">Close</button>
        </div>
        {children}
      </div>
    </div>
  </ModalPortal>
);

const AuditLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="mb-3">
    <div className="text-[10px] font-black uppercase text-slate-400">{label}</div>
    <div className="mt-0.5 text-xs font-bold text-slate-700">{value}</div>
  </div>
);

const indicatorStyle = (indicator: DueIndicator) => {
  if (indicator === 'Due Today') return { color: '#2563eb', soft: '#dbeafe' };
  if (indicator === 'Overdue') return { color: '#dc2626', soft: '#fee2e2' };
  if (indicator === 'Completed') return { color: '#059669', soft: '#dcfce7' };
  return { color: '#16a34a', soft: '#dcfce7' };
};

const IndicatorBadge: React.FC<{ indicator: DueIndicator }> = ({ indicator }) => {
  const style = indicatorStyle(indicator);
  return <span className="inline-flex rounded px-2 py-1 text-[10px] font-black" style={{ backgroundColor: style.soft, color: style.color }}>{indicator}</span>;
};

const PriorityBadge: React.FC<{ priority: TaskPriority }> = ({ priority }) => {
  const map = {
    High: 'bg-red-50 text-red-600',
    Normal: 'bg-blue-50 text-blue-600',
    Low: 'bg-slate-100 text-slate-600',
  };
  return <span className={cn('inline-flex rounded px-2 py-1 text-[10px] font-black', map[priority])}>{priority}</span>;
};

const StatusBadge: React.FC<{ status: TaskStatus }> = ({ status }) => {
  const map = {
    Pending: 'bg-slate-100 text-slate-600',
    'In Progress': 'bg-blue-50 text-blue-600',
    Completed: 'bg-green-50 text-green-600',
  };
  return <span className={cn('inline-flex rounded px-2 py-1 text-[10px] font-black', map[status])}>{status}</span>;
};

const TaskListRow: React.FC<{ task: ARTask; brandColor: string; onSelect: () => void }> = ({ task, brandColor, onSelect }) => (
  <button type="button" onClick={onSelect} className="flex w-full items-center gap-4 p-4 text-left hover:bg-slate-50">
    <div className="flex h-10 w-10 items-center justify-center rounded" style={{ backgroundColor: brandTint(brandColor, 0.1), color: brandColor }}>
      <Clock3 size={18} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-black text-slate-900">{task.taskType}</div>
      <div className="truncate text-xs font-semibold text-slate-500">{task.customerName} - {task.relatedReference}</div>
    </div>
    <div className="text-right">
      <div className="text-xs font-bold text-slate-700">{formatDate(task.taskDate)} {task.taskTime}</div>
      <IndicatorBadge indicator={getDueIndicator(task)} />
    </div>
  </button>
);

export default ARCalendarTasksView;
