// Add navigation menu to the current App.tsx
// Replace the return statement in App.tsx with this:

return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden font-sans antialiased">
      <style>{`
        :root {
          --brand-primary: #4f46e5;
          --brand-primary-light: #4f46e515;
        }
        .bg-brand { background-color: var(--brand-primary) !important; }
        .text-brand { color: var(--brand-primary) !important; }
        .border-brand { border-color: var(--brand-primary) !important; }
        .ring-brand:focus { --tw-ring-color: var(--brand-primary) !important; }
        .sidebar-item-active { background-color: var(--brand-primary) !important; color: white !important; }
        .btn-brand { background-color: var(--brand-primary); color: white; transition: opacity 0.2s; }
        .btn-brand:hover { opacity: 0.9; }
        .btn-brand:active { transform: scale(0.98); }
        .bg-brand-light { background-color: var(--brand-primary-light) !important; }
      `}</style>

      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">AccounTech</h1>
              <p className="text-xs text-slate-500">ERP System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Main</h3>
              <div className="space-y-1">
                <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors sidebar-item-active">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Accounting</h3>
              <div className="space-y-1">
                <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors text-slate-700">
                  <BookText className="w-4 h-4" />
                  Chart of Accounts
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors text-slate-700">
                  <TableProperties className="w-4 h-4" />
                  General Ledger
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors text-slate-700">
                  <FileBarChart className="w-4 h-4" />
                  Reports
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Training</h3>
              <div className="space-y-1">
                <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors text-slate-700">
                  <Users className="w-4 h-4" />
                  Students
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors text-slate-700">
                  <GraduationCap className="w-4 h-4" />
                  Qualifications
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors text-slate-700">
                  <Award className="w-4 h-4" />
                  Trainers
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors text-slate-700">
                  <Layers className="w-4 h-4" />
                  Batches
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Operations</h3>
              <div className="space-y-1">
                <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors text-slate-700">
                  <Handshake className="w-4 h-4" />
                  Sponsors
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors text-slate-700">
                  <Box className="w-4 h-4" />
                  Vendors
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors text-slate-700">
                  <Landmark className="w-4 h-4" />
                  Banking
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
              <UserCog className="w-4 h-4 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{currentUser?.name}</p>
              <p className="text-xs text-slate-500 truncate">{currentUser?.role}</p>
            </div>
            <button className="text-slate-400 hover:text-slate-600">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <Dashboard 
          summaries={summaries}
          currency={organizations[0]?.currency || 'PHP'}
        />
      </div>
      
      {/* Toast notifications */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3">
        {toasts.map(toast => (
          <div key={toast.id} className={`p-4 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 
            toast.type === 'error' ? 'bg-red-500 text-white' : 
            'bg-blue-500 text-white'
          }`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
