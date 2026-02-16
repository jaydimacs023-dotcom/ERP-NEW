// File intentionally left blank (RecurringInvoicesView removed)
  onRunRecurringInvoice: (id: string) => void;
  onNotify: (type: 'success' | 'error' | 'warning', message: string) => void;
}

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Bi-Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMIANNUAL', label: 'Semi-Annual' },
  { value: 'ANNUAL', label: 'Annual' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'PAUSED', label: 'Paused', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'COMPLETED', label: 'Completed', color: 'bg-orange-100 text-orange-800' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
];

export default function RecurringInvoicesView({
  orgId,
  currency,
  recurringInvoices,
  recurringInvoiceHistory,
  customers,
  accounts,
  items,
  onCreateRecurringInvoice,
  onUpdateRecurringInvoice,
  onDeleteRecurringInvoice,
  onRunRecurringInvoice,
  onNotify
}: RecurringInvoicesViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<RecurringInvoice | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Line items state for form
  const [lineItems, setLineItems] = useState<RecurringInvoiceLineItem[]>([
    { itemId: '', quantity: 1, unitPrice: 0 }
  ]);

  // Form state
  const [formData, setFormData] = useState<Partial<RecurringInvoice>>({
    customerId: '',
    invoiceName: '',
    description: '',
    amount: 0,
    currency: currency,
    frequency: 'MONTHLY',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    paymentTermsDays: 30,
    arAccountId: '',
    revenueAccountId: '',
    autoCreateReceivable: true,
    notes: ''
  });

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return recurringInvoices.filter(inv => {
      const matchesSearch = 
        inv.invoiceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [recurringInvoices, searchTerm, statusFilter]);

  // Get AR accounts
  const arAccounts = useMemo(() => 
    accounts.filter(a => a.class === 'ASSET' && !a.isHeader && a.name.toLowerCase().includes('receivable')),
    [accounts]
  );

  // Get Revenue accounts
  const revenueAccounts = useMemo(() => 
    accounts.filter(a => a.class === 'REVENUE' && !a.isHeader),
    [accounts]
  );

  // Get customer name
  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown Customer';
  };

  // Get item name
  const getItemName = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    return item?.name || 'Unknown Item';
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    // Explicitly handle symbols to stay consistent with institutional layout
    const symbol = currency === 'PHP' ? '\u20B1' : currency === 'USD' ? '$' : '';
    const formatted = Math.abs(amount).toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
    return `${amount < 0 ? '-' : ''}${symbol}${formatted}`;
  };

  // Calculate totals from line items
  const calculateTotals = useMemo(() => {
    let subtotal = 0;
    let vatAmount = 0;
    lineItems.forEach(line => {
      const lineTotal = line.quantity * line.unitPrice;
      subtotal += lineTotal;
      const item = items.find(i => i.id === line.itemId);
      if (item?.taxCategoryId) {
        vatAmount += lineTotal * 0.12; // VAT 12%
      }
    });
    return { subtotal, vatAmount, total: subtotal + vatAmount };
  }, [lineItems, items]);

  // Add line item
  const handleAddLineItem = () => {
    setLineItems([...lineItems, { itemId: '', quantity: 1, unitPrice: 0 }]);
  };

  // Remove line item
  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  // Update line item
  const handleUpdateLineItem = (index: number, updates: Partial<RecurringInvoiceLineItem>) => {
    const newLines = [...lineItems];
    newLines[index] = { ...newLines[index], ...updates };
    // Auto-fill price from item catalog
    if (updates.itemId) {
      const item = items.find(i => i.id === updates.itemId);
      if (item) {
        newLines[index].unitPrice = item.unitPrice;
        newLines[index].description = item.name;
      }
    }
    setLineItems(newLines);
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerId) {
      onNotify('error', 'Please select a customer');
      return;
    }
    if (!formData.invoiceName) {
      onNotify('error', 'Please enter an invoice name');
      return;
    }
    
    // Validate line items
    const validLineItems = lineItems.filter(l => l.itemId && l.quantity > 0 && l.unitPrice > 0);
    if (validLineItems.length === 0) {
      onNotify('error', 'Please add at least one valid charge item');
      return;
    }

    const totalAmount = calculateTotals.total;

    if (editingInvoice) {
      onUpdateRecurringInvoice(editingInvoice.id, {
        ...formData,
        amount: totalAmount,
        lineItems: validLineItems
      });
    } else {
      const newInvoice = RecurringInvoiceService.createRecurringInvoiceTemplate(
        orgId,
        formData.customerId!,
        formData.invoiceName!,
        totalAmount,
        formData.frequency as RecurrenceFrequency,
        formData.startDate!,
        {
          description: formData.description,
          currency: formData.currency,
          endDate: formData.endDate || undefined,
          paymentTermsDays: formData.paymentTermsDays,
          arAccountId: formData.arAccountId,
          revenueAccountId: formData.revenueAccountId,
          autoCreateReceivable: formData.autoCreateReceivable,
          notes: formData.notes,
          lineItems: validLineItems
        }
      );
      onCreateRecurringInvoice(newInvoice);
    }

    resetForm();
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      customerId: '',
      invoiceName: '',
      description: '',
      amount: 0,
      currency: currency,
      frequency: 'MONTHLY',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      paymentTermsDays: 30,
      arAccountId: '',
      revenueAccountId: '',
      autoCreateReceivable: true,
      notes: ''
    });
    setLineItems([{ itemId: '', quantity: 1, unitPrice: 0 }]);
    setEditingInvoice(null);
    setShowForm(false);
  };

  // Edit invoice
  const handleEdit = (invoice: RecurringInvoice) => {
    setEditingInvoice(invoice);
    setFormData({
      customerId: invoice.customerId,
      invoiceName: invoice.invoiceName,
      description: invoice.description,
      amount: invoice.amount,
      currency: invoice.currency || currency,
      frequency: invoice.frequency,
      startDate: invoice.startDate,
      endDate: invoice.endDate || '',
      paymentTermsDays: invoice.paymentTermsDays || 30,
      arAccountId: invoice.arAccountId || '',
      revenueAccountId: invoice.revenueAccountId || '',
      autoCreateReceivable: invoice.autoCreateReceivable,
      notes: invoice.notes || ''
    });
    // Load existing line items or create default
    if (invoice.lineItems && invoice.lineItems.length > 0) {
      setLineItems(invoice.lineItems);
    } else {
      setLineItems([{ itemId: '', quantity: 1, unitPrice: invoice.amount }]);
    }
    setShowForm(true);
  };

  // Toggle pause/resume
  const handleTogglePause = (invoice: RecurringInvoice) => {
    const newStatus = invoice.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    onUpdateRecurringInvoice(invoice.id, { status: newStatus });
  };

  // Delete with confirmation
  const handleDelete = (invoice: RecurringInvoice) => {
    if (window.confirm(`Are you sure you want to delete "${invoice.invoiceName}"?`)) {
      onDeleteRecurringInvoice(invoice.id);
    }
  };

  // Get history for an invoice
  const getInvoiceHistory = (invoiceId: string) => {
    return recurringInvoiceHistory.filter(h => h.recurringInvoiceId === invoiceId);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Recurring Invoices</h2>
          <p className="text-sm text-gray-500 font-normal italic">Automate customer billing cycles and recurring revenue recognition.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#F47721] text-white rounded hover:bg-[#E06610] transition-all shadow-md shadow-gray-100 font-bold text-sm active:scale-95"
        >
          <Plus size={18} />
          New Recurring Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
          >
            <option value="ALL">All Status</option>
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Total Active Templates</div>
          <div className="text-lg font-mono font-semibold text-[#F47721] tracking-tighter">
            {recurringInvoices.filter(i => i.status === 'ACTIVE').length}
          </div>
        </div>
        <div className="bg-white p-6 rounded border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Monthly Recurring Revenue</div>
          <div className="text-lg font-mono font-semibold text-[#F47721] tracking-tighter">
            {formatCurrency(
              recurringInvoices
                .filter(i => i.status === 'ACTIVE' && i.frequency === 'MONTHLY')
                .reduce((sum, i) => sum + i.amount, 0)
            )}
          </div>
        </div>
        <div className="bg-white p-6 rounded border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Cycles Due Today</div>
          <div className="text-lg font-mono font-semibold text-amber-600 tracking-tighter">
            {recurringInvoices.filter(i => RecurringInvoiceService.isDueToRun(i)).length}
          </div>
        </div>
        <div className="bg-white p-6 rounded border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Total Life-time Issuance</div>
          <div className="text-lg font-mono font-semibold text-gray-900 tracking-tighter">
            {recurringInvoices.reduce((sum, i) => sum + (i.totalInvoicesGenerated || 0), 0)}
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Invoice Name</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frequency</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next Invoice</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No recurring invoices found. Create one to get started!
                </td>
              </tr>
            ) : (
              filteredInvoices.map(invoice => {
                const scheduleInfo = RecurringInvoiceService.getScheduleInfo(invoice);
                const history = getInvoiceHistory(invoice.id);
                const isExpanded = expandedRow === invoice.id;

                return (
                  <React.Fragment key={invoice.id}>
                    <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-orange-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedRow(isExpanded ? null : invoice.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          <div>
                            <div className="font-medium text-gray-900">{invoice.invoiceName}</div>
                            {invoice.description && (
                              <div className="text-sm text-gray-500 truncate max-w-xs">{invoice.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {getCustomerName(invoice.customerId)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {formatCurrency(invoice.amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {RecurringInvoiceService.getFrequencyLabel(invoice.frequency)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-1">
                          {scheduleInfo.isOverdue ? (
                            <AlertCircle className="w-4 h-4 text-orange-500" />
                          ) : (
                            <Calendar className="w-4 h-4 text-gray-400" />
                          )}
                          <span className={scheduleInfo.isOverdue ? 'text-orange-600 font-medium' : 'text-gray-900'}>
                            {invoice.nextInvoiceDate}
                          </span>
                          {scheduleInfo.daysUntilRun > 0 && !scheduleInfo.isOverdue && (
                            <span className="text-xs text-gray-400">({scheduleInfo.daysUntilRun}d)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${RecurringInvoiceService.getStatusColor(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {invoice.status === 'ACTIVE' && scheduleInfo.isOverdue && (
                            <button
                              onClick={() => onRunRecurringInvoice(invoice.id)}
                              className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg"
                              title="Run Now"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleTogglePause(invoice)}
                            className={`p-1.5 rounded-lg ${invoice.status === 'ACTIVE' ? 'text-yellow-600 hover:bg-yellow-100' : 'text-green-600 hover:bg-green-100'}`}
                            title={invoice.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                            disabled={invoice.status === 'COMPLETED' || invoice.status === 'CANCELLED'}
                          >
                            {invoice.status === 'ACTIVE' ? <Pause className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleEdit(invoice)}
                            className="p-1.5 text-[#F47721] hover:bg-orange-100 rounded-lg"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(invoice)}
                            className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="px-4 py-4 bg-gray-50">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Details</h4>
                              <dl className="space-y-1 text-sm">
                                <div className="flex">
                                  <dt className="w-32 text-gray-500">Start Date:</dt>
                                  <dd className="text-gray-900">{invoice.startDate}</dd>
                                </div>
                                <div className="flex">
                                  <dt className="w-32 text-gray-500">End Date:</dt>
                                  <dd className="text-gray-900">{invoice.endDate || 'No end date'}</dd>
                                </div>
                                <div className="flex">
                                  <dt className="w-32 text-gray-500">Payment Terms:</dt>
                                  <dd className="text-gray-900">{invoice.paymentTermsDays || 30} days</dd>
                                </div>
                                <div className="flex">
                                  <dt className="w-32 text-gray-500">Total Generated:</dt>
                                  <dd className="text-gray-900">{invoice.totalInvoicesGenerated || 0} invoices</dd>
                                </div>
                                {invoice.lastInvoiceDate && (
                                  <div className="flex">
                                    <dt className="w-32 text-gray-500">Last Invoice:</dt>
                                    <dd className="text-gray-900">{invoice.lastInvoiceDate}</dd>
                                  </div>
                                )}
                                {invoice.notes && (
                                  <div className="flex">
                                    <dt className="w-32 text-gray-500">Notes:</dt>
                                    <dd className="text-gray-900">{invoice.notes}</dd>
                                  </div>
                                )}
                              </dl>
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                                <History className="w-4 h-4" /> Recent History
                              </h4>
                              {history.length === 0 ? (
                                <p className="text-sm text-gray-500">No invoices generated yet</p>
                              ) : (
                                <ul className="space-y-1 text-sm">
                                  {history.slice(0, 5).map(h => (
                                    <li key={h.id} className="flex items-center gap-2">
                                      <Clock className="w-3 h-3 text-gray-400" />
                                      <span className="text-gray-900">{h.invoiceDate}</span>
                                      <span className="text-gray-500">-</span>
                                      <span className="text-gray-900">{formatCurrency(h.amount)}</span>
                                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                                        h.status === 'CREATED' ? 'bg-green-100 text-green-700' :
                                        h.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                                        'bg-gray-100 text-gray-700'
                                      }`}>
                                        {h.status}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-sm max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingInvoice ? 'Edit Recurring Invoice' : 'New Recurring Invoice'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Customer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                <select
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                  required
                >
                  <option value="">Select Customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Invoice Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Name *</label>
                <input
                  type="text"
                  value={formData.invoiceName}
                  onChange={(e) => setFormData({ ...formData, invoiceName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                  placeholder="e.g., Monthly Subscription"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                  rows={2}
                  placeholder="Invoice description..."
                />
              </div>

              {/* Line Items - Charge Items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Charge Items *</label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">Qty</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">Unit Price</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">VAT (12%)</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">Line Total</th>
                        <th className="px-3 py-2 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {lineItems.map((line, index) => {
                        const lineSubtotal = line.quantity * line.unitPrice;
                        const lineTax = lineSubtotal * 0.12;
                        const lineTotal = lineSubtotal + lineTax;
                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <select
                                value={line.itemId}
                                onChange={(e) => {
                                  const selectedItem = items.find(i => i.id === e.target.value);
                                  handleUpdateLineItem(index, 'itemId', e.target.value);
                                  if (selectedItem) {
                                    handleUpdateLineItem(index, 'unitPrice', selectedItem.unitPrice || 0);
                                    handleUpdateLineItem(index, 'description', selectedItem.name);
                                  }
                                }}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-400"
                              >
                                <option value="">Select item...</option>
                                {items.map(item => (
                                  <option key={item.id} value={item.id}>
                                    {item.itemCode} - {item.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={line.quantity}
                                onChange={(e) => handleUpdateLineItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-400"
                                min="1"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={line.unitPrice}
                                onChange={(e) => handleUpdateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-400"
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-600">
                              {formatCurrency(lineTax)}
                            </td>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900">
                              {formatCurrency(lineTotal)}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(index)}
                                disabled={lineItems.length <= 1}
                                className="p-1 text-red-500 hover:bg-red-100 rounded disabled:opacity-30"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="flex items-center gap-1 text-sm text-[#F47721] hover:text-orange-700"
                    >
                      <Plus className="w-4 h-4" />
                      Add Line Item
                    </button>
                  </div>
                </div>
                {/* Totals */}
                <div className="mt-3 flex justify-end">
                  <div className="w-64 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subtotal:</span>
                      <span className="text-gray-900">{formatCurrency(calculateTotals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">VAT (12%):</span>
                      <span className="text-gray-900">{formatCurrency(calculateTotals.vat)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t pt-1">
                      <span className="text-gray-700">Total:</span>
                      <span className="text-gray-900">{formatCurrency(calculateTotals.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <input
                  type="text"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                  placeholder="PHP"
                />
              </div>

              {/* Frequency & Dates */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency *</label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value as RecurrenceFrequency })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                  >
                    {FREQUENCY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                  />
                </div>
              </div>

              {/* Payment Terms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms (Days)</label>
                <input
                  type="number"
                  value={formData.paymentTermsDays}
                  onChange={(e) => setFormData({ ...formData, paymentTermsDays: parseInt(e.target.value) || 30 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                  min="0"
                />
              </div>

              {/* Account Mapping */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">AR Account</label>
                  <select
                    value={formData.arAccountId}
                    onChange={(e) => setFormData({ ...formData, arAccountId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                  >
                    <option value="">Select AR Account</option>
                    {arAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Revenue Account</label>
                  <select
                    value={formData.revenueAccountId}
                    onChange={(e) => setFormData({ ...formData, revenueAccountId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                  >
                    <option value="">Select Revenue Account</option>
                    {revenueAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Auto Create */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoCreate"
                  checked={formData.autoCreateReceivable}
                  onChange={(e) => setFormData({ ...formData, autoCreateReceivable: e.target.checked })}
                  className="h-4 w-4 text-[#F47721] rounded border-gray-300 focus:ring-orange-400"
                />
                <label htmlFor="autoCreate" className="text-sm text-gray-700">
                  Automatically create receivable when invoice is generated
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                  rows={2}
                  placeholder="Internal notes..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-[#F47721] text-white rounded-lg hover:bg-[#E06610] transition-colors"
                >
                  <Check className="w-4 h-4" />
                  {editingInvoice ? 'Update Invoice' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
