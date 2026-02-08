
import React, { useState, useRef, useMemo } from 'react';
import { 
  User, ShieldCheck, Clock, FileText, Upload, CheckCircle2, 
  AlertCircle, MapPin, Camera, X, Globe,
  Fingerprint, GraduationCap, LayoutDashboard,
  Award, UserCircle, Info, CalendarClock,
  Timer, Building, Receipt, Wallet, CreditCard,
  Printer, Landmark, UserCheck, BadgeDollarSign,
  Lock, ArrowRight, Check
} from 'lucide-react';
import { Student, StudentDocument, Batch, Qualification, Trainer, Location, TrainerSchedule, JournalEntry, JournalLine } from '../types';

interface StudentPortalViewProps {
  student: Student;
  batches: Batch[];
  qualifications: Qualification[];
  trainers: Trainer[];
  locations: Location[];
  schedules: TrainerSchedule[];
  entries: JournalEntry[];
  lines: JournalLine[];
  onUpdateStudent: (student: Student) => void;
}

const StudentPortalView: React.FC<StudentPortalViewProps> = ({ 
  student, batches, qualifications, trainers, locations, schedules, entries, lines, onUpdateStudent 
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'DOCS' | 'BILLING' | 'PROFILE'>('OVERVIEW');
  const [showCamera, setShowCamera] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Enrollment Resolution
  const enrollment = useMemo(() => {
    const batch = batches.find(b => b.studentIds.includes(student.id));
    if (!batch) return null;

    const qual = qualifications.find(q => q.id === batch.qualificationId);
    const trainer = trainers.find(t => t.id === batch.trainerId);
    const loc = locations.find(l => l.id === batch.locationId);

    return { batch, qual, trainer, loc };
  }, [batches, student.id, qualifications, trainers, locations]);

  // Billing Subsidiary Ledger Logic
  const billing = useMemo(() => {
    // Normal AR Balance for Student: Debit (Increases liability to school) - Credit (Payments made)
    const studentLines = lines.filter(l => l.contactId === student.id && l.contactType === 'STUDENT');
    
    const history = studentLines.map(l => {
      const entry = entries.find(e => e.id === l.journalEntryId);
      return { entry, line: l };
    }).filter(x => !!x.entry).sort((a, b) => b.entry!.date.localeCompare(a.entry!.date));

    const totalInvoiced = studentLines.reduce((sum, l) => sum + l.debit, 0);
    const totalPaid = studentLines.reduce((sum, l) => sum + l.credit, 0);
    const balance = totalInvoiced - totalPaid;

    return { history, totalInvoiced, totalPaid, balance, hasActivity: history.length > 0 };
  }, [lines, student.id, entries]);

  const verifiedCount = student.documents.filter(d => d.status === 'VERIFIED').length;
  const progressPercent = (verifiedCount / student.documents.length) * 100;
  const isFullyCompliant = verifiedCount === student.documents.length;

  const handleDocumentUpload = (docId: string, fileData: string) => {
    const nextDocs = student.documents.map(d => 
      d.id === docId ? { ...d, status: 'UPLOADED' as const, fileData } : d
    );
    onUpdateStudent({ ...student, documents: nextDocs });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedDocId) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleDocumentUpload(selectedDocId, reader.result as string);
        setSelectedDocId(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async (docId: string) => {
    setSelectedDocId(docId);
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } } 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Camera access denied. Ensure browser permissions are enabled.");
      setShowCamera(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current && selectedDocId) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
        handleDocumentUpload(selectedDocId, dataUrl);
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    setShowCamera(false);
    setSelectedDocId(null);
  };

  const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24 animate-in fade-in duration-700">
      {/* Identity Banner */}
      <div className="bg-slate-950 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl border border-white/5">
         <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12">
            <UserCircle size={220} />
         </div>
         <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
            <div className="w-32 h-32 rounded-[2.5rem] bg-teal-600 border-4 border-white/10 overflow-hidden shrink-0 shadow-2xl flex items-center justify-center relative group">
               {student.documents.find(d => d.name === 'Passport Size Photo')?.fileData ? (
                 <img src={student.documents.find(d => d.name === 'Passport Size Photo')?.fileData} className="w-full h-full object-cover" alt="Profile" />
               ) : (
                 <User size={56} />
               )}
               <button onClick={() => startCamera(student.documents.find(d => d.name === 'Passport Size Photo')?.id || 'photo')} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={24} />
               </button>
            </div>
            <div className="text-center md:text-left flex-1">
               <div className="flex flex-col md:flex-row items-center gap-4 mb-3">
                  <h1 className="text-4xl font-black tracking-tighter">{student.lastName.toUpperCase()}, {student.firstName}</h1>
                  <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/5">Learner Tier 1</span>
               </div>
               <div className="flex flex-wrap justify-center md:justify-start gap-4">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-teal-400 bg-white/5 px-4 py-2 rounded-2xl border border-white/5">
                     <Fingerprint size={14} /> ULI: {student.uli}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-black text-slate-400 bg-white/5 px-4 py-2 rounded-2xl border border-white/5 uppercase tracking-widest">
                     <Globe size={14} className="text-teal-500" /> {student.city}, {student.province}
                  </div>
               </div>
            </div>
            <div className="shrink-0 flex flex-col items-center md:items-end gap-3">
               {billing.balance > 0 ? (
                 <div className="px-6 py-3 bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse">
                    <BadgeDollarSign size={18} /> Bal Due: {"\u20B1"} {formatCurrency(billing.balance)}
                 </div>
               ) : (
                 <div className="px-6 py-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 size={18} /> Fully Paid
                 </div>
               )}
            </div>
         </div>
      </div>

      {/* Primary Portal Navigation */}
      <div className="flex bg-white rounded-3xl p-2 border border-slate-200 shadow-sm max-w-2xl mx-auto md:mx-0">
         <TabButton active={activeTab === 'OVERVIEW'} onClick={() => setActiveTab('OVERVIEW')} label="Console" icon={<LayoutDashboard size={18}/>} />
         <TabButton active={activeTab === 'DOCS'} onClick={() => setActiveTab('DOCS')} label="Documents" icon={<FileText size={18}/>} />
         <TabButton active={activeTab === 'BILLING'} onClick={() => setActiveTab('BILLING')} label="My Ledger" icon={<Receipt size={18}/>} />
         <TabButton active={activeTab === 'PROFILE'} onClick={() => setActiveTab('PROFILE')} label="Registry" icon={<Globe size={18}/>} />
      </div>

      {activeTab === 'OVERVIEW' && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="lg:col-span-2 space-y-8">
               {/* Enrollment Status */}
               {enrollment ? (
                 <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col group">
                    <div className="p-10 border-b bg-slate-50/50 flex flex-col md:flex-row items-center gap-8">
                       <div className="w-20 h-20 bg-teal-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-teal-100 shrink-0">
                          <GraduationCap size={40} />
                       </div>
                       <div className="text-center md:text-left">
                          <p className="text-[10px] font-black text-teal-600 uppercase tracking-[0.2em] mb-1">Current Enrollment Program</p>
                          <h4 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">{enrollment.qual?.name}</h4>
                          <div className="flex items-center justify-center md:justify-start gap-4 mt-3">
                             <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest">
                               BATCH: {enrollment.batch.name}
                             </span>
                             <span className="px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-lg text-[10px] font-black text-teal-600 uppercase tracking-widest">
                               {enrollment.batch.status.replace('_', ' ')}
                             </span>
                          </div>
                       </div>
                    </div>
                    
                    <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                       <div className="space-y-6">
                          <div className="flex items-center gap-4">
                             <div className="p-3 bg-slate-100 rounded-2xl text-slate-400 group-hover:bg-teal-600 group-hover:text-white transition-all">
                                <UserCheck size={20} />
                             </div>
                             <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Lead Instructor</p>
                                <p className="text-base font-black text-slate-800">Prof. {enrollment.trainer?.lastName}, {enrollment.trainer?.firstName}</p>
                                <p className="text-xs font-medium text-slate-400 italic">{enrollment.trainer?.email}</p>
                             </div>
                          </div>

                          <div className="flex items-center gap-4">
                             <div className="p-3 bg-slate-100 rounded-2xl text-slate-400 group-hover:bg-teal-600 group-hover:text-white transition-all">
                                <MapPin size={20} />
                             </div>
                             <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Physical Station</p>
                                <p className="text-base font-black text-slate-800">{enrollment.loc?.name || 'Distance Learning'}</p>
                                <p className="text-xs font-medium text-slate-400 italic truncate w-48">{enrollment.loc?.address}</p>
                             </div>
                          </div>
                       </div>

                       <div className="space-y-6">
                          <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-2xl relative overflow-hidden">
                             <div className="relative z-10">
                                <div className="flex justify-between items-center mb-4">
                                   <CalendarClock size={20} className="text-teal-400" />
                                   <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Program Schedule</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                   <div>
                                      <p className="text-[9px] font-black text-teal-400 uppercase tracking-widest">Commences</p>
                                      <p className="text-sm font-black">{enrollment.batch.startDate}</p>
                                   </div>
                                   <div className="text-right">
                                      <p className="text-[9px] font-black text-teal-400 uppercase tracking-widest">Concludes</p>
                                      <p className="text-sm font-black">{enrollment.batch.endDate}</p>
                                   </div>
                                </div>
                             </div>
                             <div className="absolute top-0 right-0 p-8 opacity-5">
                                <Timer size={80} />
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-slate-200">
                    <GraduationCap size={64} className="mx-auto text-slate-200 mb-6" strokeWidth={1} />
                    <h3 className="text-xl font-black text-slate-400 uppercase tracking-tight">No Active Enrollment</h3>
                    <p className="text-sm text-slate-400 mt-2 max-w-xs mx-auto">Please visit the Registrar's Office to complete your batch assignment and program registration.</p>
                 </div>
               )}

               {/* Treasury Summary */}
               <div className="bg-white rounded-[3rem] border border-slate-200 p-10 shadow-sm flex flex-col md:flex-row items-center gap-10">
                  <div className="flex-1 space-y-2">
                     <div className="flex items-center gap-2 text-rose-600 mb-2">
                        <Wallet size={20} />
                        <h4 className="text-sm font-black uppercase tracking-widest">Treasury Position</h4>
                     </div>
                     <p className="text-sm text-slate-500 leading-relaxed font-medium">
                        Your subsidiary ledger tracks all institutional invoices and collections. A positive balance indicates outstanding liabilities for current training blocks.
                     </p>
                  </div>
                  <div className="w-full md:w-64 space-y-4">
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Balance Due</span>
                        <span className={`text-2xl font-mono font-black ${billing.balance > 0 ? 'text-rose-600' : 'text-teal-600'}`}>
                           {"\u20B1"} {formatCurrency(billing.balance)}
                        </span>
                     </div>
                     <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-600" style={{ width: billing.totalInvoiced > 0 ? `${(billing.totalPaid / billing.totalInvoiced) * 100}%` : '0%' }}></div>
                     </div>
                     <p className="text-[9px] font-black text-slate-400 uppercase text-center tracking-widest">
                        {billing.totalInvoiced > 0 ? `${((billing.totalPaid / billing.totalInvoiced) * 100).toFixed(0)}% Settle Rate` : 'No Invoices Recognition'}
                     </p>
                  </div>
               </div>
            </div>

            <div className="space-y-8">
               <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
                  <h4 className="text-[10px] font-black text-teal-500 uppercase tracking-[0.3em] mb-8">Registry Compliance</h4>
                  <div className="space-y-6">
                     <div className="flex justify-between items-end">
                        <div>
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Verified Items</p>
                           <p className="text-4xl font-black tracking-tighter">{verifiedCount}<span className="text-xl text-slate-600"> / {student.documents.length}</span></p>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Status</p>
                           <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${isFullyCompliant ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                              {isFullyCompliant ? 'Certified' : 'Incomplete'}
                           </span>
                        </div>
                     </div>
                     <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                     </div>
                  </div>
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <ShieldCheck size={120} />
                  </div>
               </div>

               <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                  <div className="flex gap-4">
                     <Info size={24} className="text-teal-600 shrink-0" />
                     <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase">Self-Service Note</h4>
                        <p className="text-[10px] text-slate-500 leading-relaxed font-bold mt-2">
                          Ensure all mandatory identification documents are uploaded and clear for final institutional certification.
                        </p>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      )}

      {activeTab === 'DOCS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
           {student.documents.map(doc => (
             <div key={doc.id} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 space-y-6 flex flex-col group hover:shadow-2xl hover:border-teal-200 transition-all">
                <div className="flex justify-between items-start">
                   <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-teal-600 group-hover:text-white transition-all">
                      <FileText size={28}/>
                   </div>
                   <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                     doc.status === 'VERIFIED' ? 'bg-emerald-50 text-teal-600 border-emerald-100' : 
                     doc.status === 'UPLOADED' ? 'bg-teal-50 text-teal-600 border-teal-100' :
                     'bg-slate-50 text-slate-400 border-slate-200'
                   }`}>
                     {doc.status}
                   </span>
                </div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight flex-1">{doc.name}</h3>
                {doc.status !== 'VERIFIED' && (
                  <div className="flex gap-3">
                     {doc.name.toLowerCase().includes('photo') && (
                       <button onClick={() => startCamera(doc.id)} className="flex-1 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all">
                         <Camera size={14} /> Identity Capture
                       </button>
                     )}
                     <button onClick={() => { setSelectedDocId(doc.id); fileInputRef.current?.click(); }} className="flex-1 py-3.5 bg-teal-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-teal-700 shadow-lg shadow-teal-100 transition-all">
                        <Upload size={14} /> File Sync
                     </button>
                  </div>
                )}
                {doc.status === 'VERIFIED' && (
                  <div className="flex items-center gap-2 text-teal-600 text-[10px] font-black uppercase tracking-widest">
                     <ShieldCheck size={16} /> Auditor Approved
                  </div>
                )}
             </div>
           ))}
           <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
        </div>
      )}

      {activeTab === 'BILLING' && (
         <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Assessments</p>
                  <p className="text-2xl font-mono font-black text-slate-800">{"\u20B1"} {formatCurrency(billing.totalInvoiced)}</p>
               </div>
               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Payments Made</p>
                  <p className="text-2xl font-mono font-black text-teal-600">{"\u20B1"} {formatCurrency(billing.totalPaid)}</p>
               </div>
               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Statement Balance</p>
                  <p className={`text-2xl font-mono font-black ${billing.balance > 0 ? 'text-rose-600' : 'text-teal-600'}`}>{"\u20B1"} {formatCurrency(billing.balance)}</p>
               </div>
            </div>

            {billing.hasActivity ? (
               <div className="bg-white rounded-[3rem] border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-10 border-b bg-slate-50/50 flex justify-between items-center">
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl"><Landmark size={24} /></div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Institutional Account Ledger</h3>
                     </div>
                     <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                        <Printer size={16} /> Print Advice
                     </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                       <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b">
                          <tr>
                             <th className="px-10 py-5 text-left">Posting Date</th>
                             <th className="px-10 py-5 text-left">Transaction Reference</th>
                             <th className="px-10 py-5 text-right">Debit (Inv)</th>
                             <th className="px-10 py-5 text-right">Credit (Coll)</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {billing.history.map(({entry, line}, i) => (
                             <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-10 py-6 text-xs font-bold text-slate-500">{entry?.date}</td>
                                <td className="px-10 py-6">
                                   <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{entry?.description}</p>
                                   <p className="text-[9px] font-mono font-bold text-teal-600 mt-0.5">{entry?.reference}</p>
                                </td>
                                <td className="px-10 py-6 text-right font-mono text-sm font-bold text-slate-600">
                                   {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                                </td>
                                <td className="px-10 py-6 text-right font-mono text-sm font-black text-teal-600">
                                   {line.credit > 0 ? `+ ${formatCurrency(line.credit)}` : '—'}
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>
               </div>
            ) : (
               <div className="p-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200 text-slate-300">
                  <Receipt size={64} strokeWidth={1} className="mx-auto mb-6 opacity-20"/>
                  <h3 className="text-xl font-black text-slate-400 uppercase tracking-tight">Record Is Empty</h3>
                  <p className="text-sm text-slate-400 mt-2">No tuition charges or payment receipts have been recognized against this learner ID.</p>
               </div>
            )}

            <div className="bg-teal-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-10">
               <div className="relative z-10 flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                     <CreditCard size={28} className="text-teal-400" />
                     <h4 className="text-2xl font-black tracking-tight uppercase">Digital Settlement</h4>
                  </div>
                  <p className="text-sm text-teal-200 leading-relaxed font-medium">
                    "Securely settle your outstanding dues via institutional bank transfer or digital wallet. All payments are verified by our treasury department within 24 hours."
                  </p>
               </div>
               <button className="relative z-10 px-12 py-5 bg-white text-teal-900 rounded-3xl text-xs font-black uppercase tracking-[0.3em] shadow-xl hover:scale-105 active:scale-95 transition-all">
                  Open Payment Gateway
               </button>
               <div className="absolute top-0 right-0 p-12 opacity-10">
                  <Building size={140} />
               </div>
            </div>
         </div>
      )}

      {activeTab === 'PROFILE' && (
        <div className="max-w-4xl mx-auto bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
           <div className="p-8 border-b bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl"><ShieldCheck size={24}/></div>
                 <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Registry Synchronization</h3>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Version 4.1.0</p>
           </div>
           
           <div className="p-10 bg-amber-50 border-b border-amber-100 flex gap-6">
              <AlertCircle size={28} className="text-amber-600 shrink-0" />
              <div>
                 <h5 className="text-xs font-black text-amber-900 uppercase">Registry Lock Protocol</h5>
                 <p className="text-[11px] text-amber-800 leading-relaxed font-bold mt-1">
                   Updating residency or contact data will trigger a re-verification alert for the Institutional Registrar. Ensure all fields are verifiable against government identification.
                 </p>
              </div>
           </div>

           <div className="p-10 space-y-12 opacity-60 pointer-events-none">
              <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50">
                 <Lock size={40} className="mx-auto text-slate-300 mb-4" />
                 <p className="text-sm font-black uppercase text-slate-400 tracking-widest">Updates Locked By Registrar</p>
                 <p className="text-[10px] font-bold text-slate-400 mt-2 px-10">Verification of current enrollment cycle is active. Modification of registry data is restricted until completion.</p>
              </div>
           </div>
        </div>
      )}

      {/* Camera Overlay */}
      {showCamera && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center z-[100] p-4">
          <div className="w-full max-w-md space-y-12 text-white">
             <div className="text-center">
                <h3 className="text-2xl font-black uppercase tracking-tight">Biometric Verification</h3>
                <p className="text-slate-500 text-sm font-medium mt-1">Align your face within the frame for institutional identification.</p>
             </div>
             <div className="relative aspect-square w-full bg-slate-900 rounded-[3.5rem] overflow-hidden border-4 border-white/20 shadow-2xl ring-24 ring-teal-600/10">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                   <div className="w-3/4 h-3/4 border-2 border-dashed border-white/40 rounded-[3rem]"></div>
                </div>
             </div>
             <div className="flex items-center justify-center gap-12">
                <button onClick={stopCamera} className="w-16 h-16 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-all"><X size={28} /></button>
                <button onClick={capturePhoto} className="w-24 h-24 flex items-center justify-center bg-white text-slate-950 rounded-full hover:scale-110 active:scale-90 transition-all shadow-2xl ring-8 ring-white/10"><Camera size={40} /></button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TabButton: React.FC<{ active: boolean, label: string, onClick: () => void, icon: React.ReactNode }> = ({ active, label, onClick, icon }) => (
  <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-teal-600 text-white shadow-xl shadow-teal-900/40' : 'text-slate-400 hover:text-slate-600'}`}>{icon} {label}</button>
);

export default StudentPortalView;
