
import React from 'react';
import { 
  Binary, Database, BookOpen, Layers, 
  GraduationCap, FileText, ShoppingCart, 
  ShieldCheck, Calculator, Workflow, Download,
  X, UserCog, Building2, MapPin, Landmark,
  Award, Handshake, Truck, Box, CalendarClock,
  Fingerprint, Clock, Tag, History
} from 'lucide-react';

interface SchemaField {
  field: string;
  type: string;
  constraint: string;
  desc: string;
}

interface SchemaEntity {
  title: string;
  desc: string;
  logic: string;
  rows: SchemaField[];
}

interface SchemaCategory {
  id: string;
  title: string;
  icon: React.ReactNode;
  colorClass: string;
  entities: SchemaEntity[];
}

const SchemaManualView: React.FC = () => {
  const SCHEMA_DATA: SchemaCategory[] = [
    {
      id: 'governance',
      title: 'I. Governance & Access Control',
      icon: <UserCog size={24} className="text-rose-600" />,
      colorClass: 'rose',
      entities: [
        {
          title: "Organization (Tenant)",
          desc: "Top-level entity defining the institutional workspace.",
          logic: "Isolation Logic: All database queries are implicitly filtered by orgId. Subscription tiers (BASIC, PRO, ENTERPRISE) control functional feature toggles and storage limits.",
          rows: [
            { field: 'id', type: 'UUID', constraint: 'P-Key', desc: 'Primary identifier for the institutional workspace.' },
            { field: 'name', type: 'String', constraint: 'Not Null', desc: 'Legal institutional name used in report headers.' },
            { field: 'currency', type: 'Enum', constraint: 'PHP/USD/EUR', desc: 'Functional currency for financial reporting.' },
            { field: 'subscriptionStatus', type: 'Enum', constraint: 'TRIAL/ACTIVE/PENDING', desc: 'Determines system availability and billing lifecycle.' },
            { field: 'planType', type: 'Enum', constraint: 'BASIC/PRO/ENT', desc: 'Sets the RBAC capability and module access.' },
          ]
        },
        {
          title: "User Identity",
          desc: "Authenticated personnel within a specific organization.",
          logic: "RBAC Matrix: SYSTEM_ADMIN (Platform level), ADMIN (Org level), REGISTRAR (Ops level), ACCOUNTANT (Finance level). Password hashes must satisfy 256-bit encryption standards.",
          rows: [
            { field: 'email', type: 'String', constraint: 'Unique/Org', desc: 'Authentication login credential.' },
            { field: 'role', type: 'Enum', constraint: 'Defined RBAC', desc: 'Scope of module visibility and write permissions.' },
            { field: 'orgId', type: 'UUID', constraint: 'F-Key', desc: 'Mandatory link to the parent organization for multi-tenant isolation.' },
          ]
        }
      ]
    },
    {
      id: 'financial',
      title: 'II. Financial Core Engine',
      icon: <Database size={24} className="text-indigo-600" />,
      colorClass: 'indigo',
      entities: [
        {
          title: "Chart of Accounts (COA)",
          desc: "The foundational hierarchy for the general ledger.",
          logic: "Balances are calculated recursively: Root Balance = Σ(Direct Balance + ΣChildren Balances). Leaf accounts prevent further nesting. Nominal accounts (Revenue/Expense) can be linked to Qualifications.",
          rows: [
            { field: 'code', type: 'String(10)', constraint: 'Unique/Org', desc: 'GL Code (e.g., 1000, 1101) following Standard PH Accounting Standards.' },
            { field: 'class', type: 'Enum', constraint: 'ClassGroup', desc: 'Asset, Liability, Equity, Revenue, Expense.' },
            { field: 'isHeader', type: 'Boolean', constraint: 'Logic Gate', desc: 'Folders aggregate data; only leaf accounts store actual postings.' },
            { field: 'qualificationId', type: 'UUID', constraint: 'F-Key (Null)', desc: 'Optional segment link for Profit & Loss attribution by program.' },
          ]
        },
        {
          title: "Journal Entry & Lines",
          desc: "Atomic transactional records for bookkeeping compliance.",
          logic: "Strict GAAP Balance Rule: Sum(Debit) - Sum(Credit) = 0. Records are immutable once POSTED; modifications require a REVERSE and REPOST sequence to preserve audit trail.",
          rows: [
            { field: 'reference', type: 'String', constraint: 'Unique/Org', desc: 'Audit-ready tracking number (INV/PYMT/OR).' },
            { field: 'sourceType', type: 'Enum', constraint: 'Audit Category', desc: 'Manual, Invoice, Bill, Payment, Collection, Depreciation.' },
            { field: 'lines', type: 'Collection', constraint: 'Atomicity', desc: 'Array of balanced GL impact rows including account links and contact attribution.' },
          ]
        }
      ]
    },
    {
      id: 'subsidiary',
      title: 'III. Subsidiary Ledgers & Partners',
      icon: <Handshake size={24} className="text-amber-600" />,
      colorClass: 'amber',
      entities: [
        {
          title: "Sponsors (AR Subsidiary)",
          desc: "External funding entities providing grants or scholarships.",
          logic: "Receivable Mapping: Every sponsor must link to a specific Asset account in the COA to isolate funding buckets in the Balance Sheet.",
          rows: [
            { field: 'arAccountId', type: 'UUID', constraint: 'F-Key', desc: 'Specific G/L account where this sponsor\'s debt is tracked.' },
            { field: 'type', type: 'Enum', constraint: 'Category', desc: 'Corporate, NGO, Government, Individual.' },
            { field: 'balance', type: 'Decimal', constraint: 'Virtual', desc: 'Real-time calculation based on uncollected invoices attributed to this ID.' },
          ]
        },
        {
          title: "Vendors (AP Subsidiary)",
          desc: "Procurement partners for materials and utilities.",
          logic: "Tax Compliance: Every vendor record must store a TIN for Expanded Withholding Tax (EWT) reporting and BIR Form 2307 issuance.",
          rows: [
            { field: 'apAccountId', type: 'UUID', constraint: 'F-Key', desc: 'Default Liability account for payables recognition.' },
            { field: 'tin', type: 'String', constraint: 'Tax ID', desc: 'Mandatory for BIR 2307 compliance documentation.' },
          ]
        },
        {
          title: "Bank Accounts (Treasury)",
          desc: "Physical cash and bank repositories.",
          logic: "Liquidity Control: The glAccountId link creates a dedicated sub-ledger. The Banking module acts as a granular view of the parent Cash/Bank asset account.",
          rows: [
            { field: 'bankName', type: 'String', constraint: 'Identifier', desc: 'Institutional name of the financial repository.' },
            { field: 'accountNumber', type: 'String', constraint: 'Privacy Mask', desc: 'Masked or full account number for reconciliation.' },
            { field: 'glAccountId', type: 'UUID', constraint: 'F-Key', desc: 'The corresponding Asset account in the main Ledger.' },
          ]
        }
      ]
    },
    {
      id: 'instructional',
      title: 'IV. Instructional Logistics',
      icon: <GraduationCap size={24} className="text-sky-600" />,
      colorClass: 'sky',
      entities: [
        {
          title: "Qualifications (Curriculum)",
          desc: "TESDA-standardized training regulations.",
          logic: "Instructional Load: durationDays defines the 8-hour blocks required for completion. This field is the base for all automated end-date forecasting.",
          rows: [
            { field: 'code', type: 'String', constraint: 'Unique', desc: 'Official program code (e.g., CSS-NCII).' },
            { field: 'durationDays', type: 'Integer', constraint: 'Min: 1', desc: 'Required instructional days for certificate issuance.' },
          ]
        },
        {
          title: "Trainer & Scheduling",
          desc: "Human resource availability for training delivery.",
          logic: "Capacity Engine: Total weekly hours are derived from shifts. If a trainer is assigned to a batch, the system calculates the remaining instructional hours to project completion.",
          rows: [
            { field: 'qualificationIds', type: 'UUID[]', constraint: 'Accreditation', desc: 'Accredited programs the trainer is authorized to teach.' },
            { field: 'slots', type: 'JSON', constraint: 'Day-Time Map', desc: 'Weekly shift recurring definition (dayIndex, start, end).' },
          ]
        },
        {
          title: "Locations (Facilities)",
          desc: "Physical infrastructure for training delivery.",
          logic: "Accreditation Shield: Addresses are verified for territorial compliance against regional UTPRAS standards to ensure audit readiness.",
          rows: [
            { field: 'code', type: 'String', constraint: 'Identifier', desc: 'Short code for classroom or satellite center (e.g., CL1, MAIN).' },
            { field: 'address', type: 'String', constraint: 'Legal', desc: 'Physical address for UTPRAS facility accreditation audits.' },
          ]
        }
      ]
    },
    {
      id: 'operational',
      title: 'V. Operational Lifecycle',
      icon: <Layers size={24} className="text-emerald-600" />,
      colorClass: 'emerald',
      entities: [
        {
          title: "Learner Registry (Student)",
          desc: "Comprehensive demographic and PII data.",
          logic: "Compliance Lock: Registry entries are only valid if mandatory documents (TOR, Birth Cert) are tracked and verified in the documents collection.",
          rows: [
            { field: 'uli', type: 'String(20)', constraint: 'Unique', desc: 'Unique Learner Identifier for TESDA MIS mapping.' },
            { field: 'documents', type: 'Array<JSON>', constraint: 'Compliance', desc: 'Registry of verified document statuses and metadata.' },
          ]
        },
        {
          title: "Training Batches",
          desc: "The primary unit of instruction and billing.",
          logic: "Scheduling Algorithm: ProjectedEndDate = StartDate + CalendarDays(InstructionalHours >= (QualDays * 8)). Accounts for trainer holidays and off-days.",
          rows: [
            { field: 'status', type: 'Enum', constraint: 'Workflow', desc: 'DRAFT, OPEN, ONGOING, COMPLETED.' },
            { field: 'studentIds', type: 'UUID[]', constraint: 'Enrollment', desc: 'Foreign key list for learner cohort attribution.' },
          ]
        }
      ]
    },
    {
      id: 'capital',
      title: 'VI. Capital & Procurement',
      icon: <ShoppingCart size={24} className="text-purple-600" />,
      colorClass: 'purple',
      entities: [
        {
          title: "Purchase Orders (PO)",
          desc: "Internal spend authorization documents.",
          logic: "Approval Gate: Moves from DRAFT to PENDING_APPROVAL. Only APPROVED POs can be converted to Accounts Payable Bills.",
          rows: [
            { field: 'totalAmount', type: 'Decimal', constraint: 'Aggregate', desc: 'Total financial commitment across all items.' },
            { field: 'status', type: 'Enum', constraint: 'Authorization', desc: 'Current state of procurement commitment.' },
          ]
        },
        {
          title: "Fixed Assets",
          desc: "Capitalized items with multi-year life.",
          logic: "Straight-Line Logic: Monthly Charge = (Cost - Salvage) / UsefulLifeMonths. The assetId on Journal Lines enables granular tracking of NBV.",
          rows: [
            { field: 'purchaseCost', type: 'Decimal', constraint: 'Historical', desc: 'Acquisition value at the date of purchase.' },
            { field: 'usefulLifeMonths', type: 'Integer', constraint: 'Min: 1', desc: 'Estimated period of economic utility.' },
            { field: 'depreciationAccountId', type: 'UUID', constraint: 'F-Key', desc: 'Asset account link for Accumulated Depreciation.' },
          ]
        }
      ]
    },
    {
      id: 'catalog',
      title: 'VII. Service & Item Catalog',
      icon: <Tag size={24} className="text-teal-600" />,
      colorClass: 'teal',
      entities: [
        {
          title: "Catalog Items (Non-Stock)",
          desc: "Defined services, fees, and material items.",
          logic: "Tax Propagation: The taxCategory and whtRate define automated calculations in the AR (Invoice) and AP (Bill) modules.",
          rows: [
            { field: 'code', type: 'String', constraint: 'Unique', desc: 'Internal SKU or identifier (e.g. TUIT-NCII).' },
            { field: 'defaultAccountId', type: 'UUID', constraint: 'F-Key', desc: 'Target G/L account for revenue or expense recognition.' },
            { field: 'taxCategory', type: 'Enum', constraint: 'VAT/EXEMPT', desc: 'Standard tax classification for the item.' },
          ]
        }
      ]
    },
    {
      id: 'security',
      title: 'VIII. System Integrity & Logs',
      icon: <History size={24} className="text-slate-600" />,
      colorClass: 'slate',
      entities: [
        {
          title: "Audit Trail (Logs)",
          desc: "Immutable record of all system state changes.",
          logic: "Forensic Integrity: Entries cannot be deleted or modified. Previous and New state deltas are stored as JSON for change comparisons.",
          rows: [
            { field: 'timestamp', type: 'DateTime', constraint: 'Auto-Gen', desc: 'Precise system time of the action execution.' },
            { field: 'userId', type: 'String', constraint: 'Identifier', desc: 'Name or ID of the user who initiated the state change.' },
            { field: 'details', type: 'String', constraint: 'Narration', desc: 'Human-readable summary of the modification.' },
          ]
        }
      ]
    }
  ];

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Category,Entity,Field,Data Type,Constraint,Description,Business Logic\n";

    SCHEMA_DATA.forEach(cat => {
      cat.entities.forEach(entity => {
        entity.rows.forEach((row, rowIndex) => {
          const logicEscaped = rowIndex === 0 ? `"${entity.logic.replace(/"/g, '""')}"` : "";
          const rowData = [
            `"${cat.title}"`,
            `"${entity.title}"`,
            `"${row.field}"`,
            `"${row.type}"`,
            `"${row.constraint}"`,
            `"${row.desc.replace(/"/g, '""')}"`,
            logicEscaped
          ];
          csvContent += rowData.join(",") + "\n";
        });
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AccounTech_Universal_Schema_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-24">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-slate-900 text-white rounded-3xl shadow-2xl shadow-indigo-200">
              <Binary size={40} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-800 tracking-tight">Technical Data Manual</h1>
              <p className="text-slate-500 font-medium italic">Comprehensive ERP Schema & Business Logic Reference (v4.1.0)</p>
            </div>
          </div>
        </div>
        <button 
          onClick={handleExportCSV}
          className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl active:scale-95 border-b-4 border-slate-700"
        >
          <Download size={20} /> Export System Blueprint
        </button>
      </header>

      <div className="p-8 bg-amber-50 rounded-[2.5rem] border-2 border-amber-100 flex gap-6 items-start shadow-sm">
        <div className="p-3 bg-white rounded-2xl shadow-sm text-amber-600 border border-amber-100 shrink-0">
          <ShieldCheck size={32} />
        </div>
        <div>
          <h4 className="text-lg font-black text-amber-900 uppercase tracking-tight mb-1">Architectural Integrity Statement</h4>
          <p className="text-sm text-amber-800 leading-relaxed font-medium">
            This manual details the entire data model of the AccounTech system. All entities are architected for <strong>multi-tenant isolation</strong> via the mandatory <code className="bg-amber-200/50 px-1.5 py-0.5 rounded font-mono text-xs">orgId</code> key. Financial calculations adhere to GAAP double-entry standards, while operational modules follow TESDA MIS 03-02 registry protocols.
          </p>
        </div>
      </div>

      <div className="space-y-16">
        {SCHEMA_DATA.map((category) => (
          <section key={category.id} className="space-y-10">
            <div className="flex items-center gap-4 pb-4 border-b-4 border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm">
                 {category.icon}
              </div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-widest">{category.title}</h2>
            </div>

            <div className="grid grid-cols-1 gap-12">
              {category.entities.map((entity, idx) => (
                <SchemaCard 
                  key={idx}
                  title={entity.title}
                  desc={entity.desc}
                  rows={entity.rows}
                  logic={entity.logic}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="pt-16 border-t-2 border-slate-100 text-center space-y-6">
        <div className="flex items-center justify-center gap-10 text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">
          <div className="flex items-center gap-2"><Workflow size={16} /> Unified Ledger</div>
          <div className="w-2 h-2 bg-slate-200 rounded-full"></div>
          <div className="flex items-center gap-2"><Calculator size={16} /> GAAP Compliant</div>
          <div className="w-2 h-2 bg-slate-200 rounded-full"></div>
          <div className="flex items-center gap-2"><Fingerprint size={16} /> Immutable Audit</div>
        </div>
        <div className="bg-slate-50 inline-block px-6 py-2 rounded-full border border-slate-200">
          <p className="text-[11px] text-slate-500 font-bold tracking-tight">
            Compiled for: <span className="text-slate-900">Platform Quality Assurance & System Audit</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

interface SchemaCardProps {
  title: string;
  desc: string;
  rows: SchemaField[];
  logic: string;
}

const SchemaCard: React.FC<SchemaCardProps> = ({ title, desc, rows, logic }) => (
  <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden group">
    <div className="p-10 border-b bg-slate-50/50 group-hover:bg-white transition-colors">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h3>
        <span className="px-4 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">Master Entity</span>
      </div>
      <p className="text-base text-slate-500 font-medium mt-2 max-w-2xl leading-relaxed">{desc}</p>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b">
          <tr>
            <th className="px-10 py-5">Logical Field</th>
            <th className="px-10 py-5">Data Type</th>
            <th className="px-10 py-5">Constraint</th>
            <th className="px-10 py-5">Internal Documentation</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-indigo-50/20 transition-colors">
              <td className="px-10 py-5 font-mono text-xs font-bold text-indigo-600">{row.field}</td>
              <td className="px-10 py-5 text-slate-700 font-bold">{row.type}</td>
              <td className="px-10 py-5">
                <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                  {row.constraint}
                </span>
              </td>
              <td className="px-10 py-5 text-slate-500 italic font-medium">{row.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="p-10 bg-indigo-50/30 border-t flex gap-6 items-start">
      <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-600 border border-indigo-100 shrink-0">
        <Calculator size={24} />
      </div>
      <div>
        <p className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-2">Core Business Logic Layer</p>
        <p className="text-sm text-indigo-900 font-bold leading-relaxed">{logic}</p>
      </div>
    </div>
  </div>
);

export default SchemaManualView;
