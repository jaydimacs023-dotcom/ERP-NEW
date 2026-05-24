
import React, { useState, useRef, useMemo } from 'react';
import ModalPortal from '../components/ModalPortal';
import { 
  User, ShieldCheck, Clock, FileText, Upload, CheckCircle2, 
  AlertCircle, MapPin, Camera, X, Globe,
  Fingerprint, GraduationCap, LayoutDashboard,
  Award, UserCircle, Info, CalendarClock,
  Timer, Building, Receipt, Wallet, CreditCard,
  Printer, Landmark, UserCheck, BadgeDollarSign,
  Lock, ArrowRight, Check
} from 'lucide-react';
import { Student, Batch, Qualification, Trainer, Location, TrainerSchedule, JournalEntry, JournalLine } from '../types';
import { 
  updateProfilePhoto, 
  updateTOR, 
  updateBirthCertificate, 
  updateApplicationForm,
  getComplianceDocuments,
  getDocumentTypeFromName,
  getStudentProfilePhoto,
  normalizeStudentDocuments,
} from '../services/StudentDocumentService';

interface StudentPortalViewProps {
  student: Student;
  batches: Batch[];
  qualifications: Qualification[];
  trainers: Trainer[];
  locations: Location[];
  schedules: TrainerSchedule[];
  entries: JournalEntry[];
  lines: JournalLine[];
  brandColor: string;
  onUpdateStudent: (student: Student) => void;
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (!/^[\da-fA-F]{6}$/.test(normalized)) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const MAX_IMAGE_DIMENSION = 1280;
const IMAGE_QUALITY = 0.78;
const PROFILE_PHOTO_TARGET = '__profile_photo__';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

async function optimizeImageDataUrl(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl);
  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(image.width || 1, image.height || 1),
  );
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) return dataUrl;

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', IMAGE_QUALITY);
}

async function prepareUploadData(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  if (!file.type.startsWith('image/')) return dataUrl;

  try {
    return await optimizeImageDataUrl(dataUrl);
  } catch {
    return dataUrl;
  }
}

function isImageDataUrl(value?: string): boolean {
  return Boolean(value && value.startsWith('data:image/'));
}

function isPdfDataUrl(value?: string): boolean {
  return Boolean(value && value.startsWith('data:application/pdf'));
}

const StudentPortalView: React.FC<StudentPortalViewProps> = ({ 
  student, batches, qualifications, trainers, locations, schedules, entries, lines, brandColor, onUpdateStudent 
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

  const normalizedDocuments = useMemo(() => normalizeStudentDocuments(student.documents), [student.documents]);
  const complianceDocuments = useMemo(() => getComplianceDocuments(student), [student]);
  const verifiedCount = complianceDocuments.filter(d => d.status === 'VERIFIED').length;
  const progressPercent = complianceDocuments.length ? (verifiedCount / complianceDocuments.length) * 100 : 0;
  const isFullyCompliant = complianceDocuments.length > 0 && verifiedCount === complianceDocuments.length;
  const profilePhoto = getStudentProfilePhoto(student);

  /**
   * Independent document upload handlers - each document type updates in isolation
   */
  const handleProfilePhotoUpload = (fileData: string) => {
    const updatedStudent = updateProfilePhoto(student, fileData);
    onUpdateStudent(updatedStudent);
  };

  const handleTORUpload = (fileData: string) => {
    const updatedStudent = updateTOR(student, fileData);
    onUpdateStudent(updatedStudent);
  };

  const handleBirthCertificateUpload = (fileData: string) => {
    const updatedStudent = updateBirthCertificate(student, fileData);
    onUpdateStudent(updatedStudent);
  };

  const handleApplicationFormUpload = (fileData: string) => {
    const updatedStudent = updateApplicationForm(student, fileData);
    onUpdateStudent(updatedStudent);
  };

  // Generic handler that routes to specific document handlers based on document name
  const handleDocumentUpload = (docId: string, fileData: string) => {
    const doc = normalizedDocuments.find(d => d.id === docId);
    if (!doc) return;

    switch (getDocumentTypeFromName(doc.name)) {
      case 'TOR':
        handleTORUpload(fileData);
        break;
      case 'BIRTH_CERTIFICATE':
        handleBirthCertificateUpload(fileData);
        break;
      case 'APPLICATION_FORM':
        handleApplicationFormUpload(fileData);
        break;
      default:
        const nextDocs = normalizedDocuments.map(d =>
          d.id === docId ? { ...d, status: 'UPLOADED' as const, fileData } : d
        );
        onUpdateStudent({
          ...student,
          profilePhoto: student.profilePhoto, // Preserve profile photo
          documents: normalizeStudentDocuments(nextDocs),
        });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedDocId) {
      try {
        const preparedData = await prepareUploadData(file);
        if (selectedDocId === PROFILE_PHOTO_TARGET) {
          handleProfilePhotoUpload(preparedData);
        } else {
          handleDocumentUpload(selectedDocId, preparedData);
        }
      } finally {
        setSelectedDocId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
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
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.82);
        optimizeImageDataUrl(dataUrl)
          .then((optimizedDataUrl) => {
            if (selectedDocId === PROFILE_PHOTO_TARGET) {
              handleProfilePhotoUpload(optimizedDataUrl);
            } else {
              handleDocumentUpload(selectedDocId, optimizedDataUrl);
            }
          })
          .catch(() => {
            if (selectedDocId === PROFILE_PHOTO_TARGET) {
              handleProfilePhotoUpload(dataUrl);
            } else {
              handleDocumentUpload(selectedDocId, dataUrl);
            }
          })
          .finally(() => {
            stopCamera();
          });
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
      <div className="bg-gray-900 rounded-md p-5 text-white relative overflow-hidden shadow-md border border-white/5">
         <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12">
            <UserCircle size={220} />
         </div>
         <div className="relative z-10 flex flex-col md:flex-row items-center gap-5">
            <div className="w-32 h-32 rounded-md border-4 border-white/10 overflow-hidden shrink-0 shadow-md flex items-center justify-center relative group" style={{ backgroundColor: brandColor }}>
               {profilePhoto ? (
                 <img src={profilePhoto} className="w-full h-full object-cover" alt="Profile" />
               ) : (
                 <User size={56} />
               )}
               <button onClick={() => startCamera(PROFILE_PHOTO_TARGET)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={24} />
               </button>
            </div>
            <div className="text-center md:text-left flex-1">
               <div className="flex flex-col md:flex-row items-center gap-4 mb-3">
                  <h1 className="text-xl font-semibold tracking-tighter">{student.lastName.toUpperCase()}, {student.firstName}</h1>
                  <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-semibold uppercase tracking-wide border border-white/5">Learner Tier 1</span>
               </div>
               <div className="flex flex-wrap justify-center md:justify-start gap-4">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold bg-white/5 px-4 py-2 rounded border border-white/5" style={{ color: brandColor }}>
                     <Fingerprint size={14} /> ULI: {student.uli}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 bg-white/5 px-4 py-2 rounded border border-white/5 uppercase tracking-wide">
                     <Globe size={14} style={{ color: brandColor }} /> {student.city}, {student.province}
                  </div>
               </div>
            </div>
            <div className="shrink-0 flex flex-col items-center md:items-end gap-3">
               {billing.balance > 0 ? (
                 <div className="px-6 py-3 bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded text-xs font-semibold uppercase tracking-wide flex items-center gap-2 animate-pulse">
                    <BadgeDollarSign size={18} /> Bal Due: {"\u20B1"} {formatCurrency(billing.balance)}
                 </div>
               ) : (
                 <div className="px-6 py-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded text-xs font-semibold uppercase tracking-wide flex items-center gap-2">
                    <CheckCircle2 size={18} /> Fully Paid
                 </div>
               )}
            </div>
         </div>
      </div>

      {/* Primary Portal Navigation */}
      <div className="flex bg-white rounded-md p-2 border border-gray-200 shadow-sm max-w-2xl mx-auto md:mx-0">
         <TabButton active={activeTab === 'OVERVIEW'} onClick={() => setActiveTab('OVERVIEW')} label="Console" icon={<LayoutDashboard size={18}/>} brandColor={brandColor} />
         <TabButton active={activeTab === 'DOCS'} onClick={() => setActiveTab('DOCS')} label="Documents" icon={<FileText size={18}/>} brandColor={brandColor} />
         <TabButton active={activeTab === 'BILLING'} onClick={() => setActiveTab('BILLING')} label="My Ledger" icon={<Receipt size={18}/>} brandColor={brandColor} />
         <TabButton active={activeTab === 'PROFILE'} onClick={() => setActiveTab('PROFILE')} label="Registry" icon={<Globe size={18}/>} brandColor={brandColor} />
      </div>

      {activeTab === 'OVERVIEW' && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="lg:col-span-2 space-y-8">
               {/* Enrollment Status */}
               {enrollment ? (
                 <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden flex flex-col group">
                    <div className="p-5 border-b bg-gray-50 flex flex-col md:flex-row items-center gap-8">
                       <div className="w-20 h-20 text-white rounded flex items-center justify-center shadow-sm shadow-gray-100 shrink-0" style={{ backgroundColor: brandColor }}>
                          <GraduationCap size={40} />
                       </div>
                       <div className="text-center md:text-left">
                          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: brandColor }}>Current Enrollment Program</p>
                          <h4 className="text-xl font-semibold text-gray-900 tracking-tight leading-tight">{enrollment.qual?.name}</h4>
                          <div className="flex items-center justify-center md:justify-start gap-4 mt-3">
                             <span className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-500 uppercase tracking-wide">
                               BATCH: {enrollment.batch.name}
                             </span>
                             <span className="px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-semibold uppercase tracking-wide" style={{ color: brandColor }}>
                               {enrollment.batch.status.replace('_', ' ')}
                             </span>
                          </div>
                       </div>
                    </div>
                    
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                       <div className="space-y-6">
                          <div className="flex items-center gap-4">
                             <div className="p-3 rounded transition-all" style={{ backgroundColor: withAlpha(brandColor, 0.1), color: brandColor }}>
                                <UserCheck size={20} />
                             </div>
                             <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Lead Instructor</p>
                                <p className="text-base font-semibold text-gray-800">Prof. {enrollment.trainer?.lastName}, {enrollment.trainer?.firstName}</p>
                                <p className="text-xs font-medium text-gray-400 italic">{enrollment.trainer?.email}</p>
                             </div>
                          </div>

                          <div className="flex items-center gap-4">
                             <div className="p-3 rounded transition-all" style={{ backgroundColor: withAlpha(brandColor, 0.1), color: brandColor }}>
                                <MapPin size={20} />
                             </div>
                             <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Physical Station</p>
                                <p className="text-base font-semibold text-gray-800">{enrollment.loc?.name || 'Distance Learning'}</p>
                                <p className="text-xs font-medium text-gray-400 italic truncate w-48">{enrollment.loc?.address}</p>
                             </div>
                          </div>
                       </div>

                       <div className="space-y-6">
                          <div className="p-6 bg-gray-800 rounded text-white shadow-md relative overflow-hidden">
                             <div className="relative z-10">
                                <div className="flex justify-between items-center mb-4">
                                   <CalendarClock size={20} style={{ color: brandColor }} />
                                   <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Program Schedule</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                   <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: brandColor }}>Commences</p>
                                      <p className="text-sm font-semibold">{enrollment.batch.startDate}</p>
                                   </div>
                                   <div className="text-right">
                                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: brandColor }}>Concludes</p>
                                      <p className="text-sm font-semibold">{enrollment.batch.endDate}</p>
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
                 <div className="bg-white rounded-md p-20 text-center border-2 border-dashed border-gray-200">
                    <GraduationCap size={64} className="mx-auto text-gray-200 mb-6" strokeWidth={1} />
                    <h3 className="text-xl font-semibold text-gray-400 uppercase tracking-tight">No Active Enrollment</h3>
                    <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto">Please visit the Registrar's Office to complete your batch assignment and program registration.</p>
                 </div>
               )}

               {/* Treasury Summary */}
               <div className="bg-white rounded-md border border-gray-200 p-5 shadow-sm flex flex-col md:flex-row items-center gap-5">
                  <div className="flex-1 space-y-2">
                     <div className="flex items-center gap-2 text-rose-600 mb-2">
                        <Wallet size={20} />
                        <h4 className="text-sm font-semibold uppercase tracking-wide">Treasury Position</h4>
                     </div>
                     <p className="text-sm text-gray-500 leading-relaxed font-medium">
                        Your subsidiary ledger tracks all institutional invoices and collections. A positive balance indicates outstanding liabilities for current training blocks.
                     </p>
                  </div>
                  <div className="w-full md:w-64 space-y-4">
                     <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Balance Due</span>
                        <span
                          className={`text-lg font-mono font-semibold ${billing.balance > 0 ? 'text-rose-600' : ''}`}
                          style={billing.balance > 0 ? undefined : { color: brandColor }}
                        >
                           {"\u20B1"} {formatCurrency(billing.balance)}
                        </span>
                     </div>
                     <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full" style={{ backgroundColor: brandColor, width: billing.totalInvoiced > 0 ? `${(billing.totalPaid / billing.totalInvoiced) * 100}%` : '0%' }}></div>
                     </div>
                     <p className="text-xs font-semibold text-gray-400 uppercase text-center tracking-wide">
                        {billing.totalInvoiced > 0 ? `${((billing.totalPaid / billing.totalInvoiced) * 100).toFixed(0)}% Settle Rate` : 'No Invoices Recognition'}
                     </p>
                  </div>
               </div>
            </div>

            <div className="space-y-8">
               <div className="bg-gray-800 rounded-md p-5 text-white shadow-md relative overflow-hidden">
                  <h4 className="text-xs font-semibold uppercase tracking-wide mb-8" style={{ color: brandColor }}>Registry Compliance</h4>
                  <div className="space-y-6">
                     <div className="flex justify-between items-end">
                        <div>
                           <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Verified Items</p>
                           <p className="text-xl font-semibold tracking-tighter">{verifiedCount}<span className="text-xl text-gray-600"> / {complianceDocuments.length}</span></p>
                        </div>
                        <div className="text-right">
                           <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</p>
                           <span className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase ${isFullyCompliant ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                              {isFullyCompliant ? 'Certified' : 'Incomplete'}
                           </span>
                        </div>
                     </div>
                     <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full transition-all duration-1000" style={{ backgroundColor: brandColor, width: `${progressPercent}%` }}></div>
                     </div>
                  </div>
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <ShieldCheck size={120} />
                  </div>
               </div>

               <div className="bg-white rounded border border-gray-200 p-8 shadow-sm">
                  <div className="flex gap-4">
                     <Info size={24} className="shrink-0" style={{ color: brandColor }} />
                     <div>
                        <h4 className="text-xs font-semibold text-gray-800 uppercase">Self-Service Note</h4>
                        <p className="text-xs text-gray-500 leading-relaxed font-bold mt-2">
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
           {complianceDocuments.map((doc, docIndex) => (
              <div key={`${doc.id}-${doc.name}-${docIndex}`} className="bg-white rounded-md border border-gray-200 p-8 space-y-6 flex flex-col group hover:shadow-md transition-all">
                 <div className="flex justify-between items-start">
                    <div className="p-4 rounded transition-all" style={{ backgroundColor: withAlpha(brandColor, 0.08), color: brandColor }}>
                       <FileText size={28}/>
                   </div>
                   <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${
                     doc.status === 'VERIFIED' ? 'bg-emerald-50 border-emerald-100' : 
                     doc.status === 'UPLOADED' ? 'border-orange-100' :
                     'bg-gray-50 text-gray-400 border-gray-200'
                   }`} style={doc.status === 'VERIFIED' || doc.status === 'UPLOADED' ? { color: brandColor, backgroundColor: withAlpha(brandColor, doc.status === 'VERIFIED' ? 0.1 : 0.12) } : undefined}>
                     {doc.status}
                   </span>
                 </div>
                 <h3 className="text-base font-semibold text-gray-800 uppercase tracking-tight flex-1">{doc.name}</h3>
                 {doc.fileData && (
                  <div className="rounded-md border border-gray-200 bg-gray-50 overflow-hidden">
                     {isImageDataUrl(doc.fileData) ? (
                       <div className="space-y-3 p-3">
                          <div className="aspect-[4/3] w-full overflow-hidden rounded bg-white border border-gray-200">
                             <img src={doc.fileData} alt={doc.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                             <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Image attached</span>
                             <a
                               href={doc.fileData}
                               target="_blank"
                               rel="noreferrer"
                               className="text-[11px] font-semibold uppercase tracking-wide"
                               style={{ color: brandColor }}
                             >
                               Open file
                             </a>
                          </div>
                       </div>
                     ) : (
                       <div className="p-4 flex items-center justify-between gap-3">
                          <div>
                             <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                     {isPdfDataUrl(doc.fileData) ? 'PDF attached' : 'Document attached'}
                             </p>
                             <p className="text-[11px] text-gray-500 mt-1">
                             </p>
                          </div>
                          <a
                            href={doc.fileData}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded text-[11px] font-semibold uppercase tracking-wide text-white"
                            style={{ backgroundColor: brandColor }}
                          >
                            <ArrowRight size={14} /> Open
                          </a>
                       </div>
                     )}
                  </div>
                 )}
                 {doc.status !== 'VERIFIED' && (
                  <div className="flex gap-3">
                     {doc.name.toLowerCase().includes('photo') && (
                       <button onClick={() => startCamera(doc.id)} className="flex-1 py-3.5 bg-gray-800 text-white rounded text-xs font-semibold uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-black transition-all">
                         <Camera size={14} /> Identity Capture
                       </button>
                     )}
                     <button onClick={() => { setSelectedDocId(doc.id); fileInputRef.current?.click(); }} className="flex-1 py-3.5 text-white rounded text-xs font-semibold uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-gray-100 transition-all" style={{ backgroundColor: brandColor }}>
                        <Upload size={14} /> File Sync
                     </button>
                  </div>
                )}
                {doc.status === 'VERIFIED' && (
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: brandColor }}>
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
               <div className="bg-white p-8 rounded-md border border-gray-200 shadow-sm flex flex-col items-center text-center">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Total Assessments</p>
                  <p className="text-lg font-mono font-semibold text-gray-800">{"\u20B1"} {formatCurrency(billing.totalInvoiced)}</p>
               </div>
               <div className="bg-white p-8 rounded-md border border-gray-200 shadow-sm flex flex-col items-center text-center">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Payments Made</p>
                  <p className="text-lg font-mono font-semibold" style={{ color: brandColor }}>{"\u20B1"} {formatCurrency(billing.totalPaid)}</p>
               </div>
               <div className="bg-white p-8 rounded-md border border-gray-200 shadow-sm flex flex-col items-center text-center">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Statement Balance</p>
                  <p className={`text-lg font-mono font-semibold ${billing.balance > 0 ? 'text-rose-600' : ''}`} style={billing.balance > 0 ? undefined : { color: brandColor }}>{"\u20B1"} {formatCurrency(billing.balance)}</p>
               </div>
            </div>

            {billing.hasActivity ? (
               <div className="bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm">
                  <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-gray-800 text-white rounded shadow-sm"><Landmark size={24} /></div>
                        <h3 className="text-xl font-semibold text-gray-800 uppercase tracking-tight">Institutional Account Ledger</h3>
                     </div>
                     <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded text-xs font-semibold uppercase tracking-wide hover:bg-gray-50 transition-all shadow-sm">
                        <Printer size={16} /> Print Advice
                     </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                       <thead className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b">
                          <tr>
                             <th className="px-5 py-5 text-left">Posting Date</th>
                             <th className="px-5 py-5 text-left">Transaction Reference</th>
                             <th className="px-5 py-5 text-right">Debit (Inv)</th>
                             <th className="px-5 py-5 text-right">Credit (Coll)</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100">
                          {billing.history.map(({entry, line}, i) => (
                             <tr key={i} className="hover:bg-gray-50 transition-colors">
                                <td className="px-5 py-6 text-xs font-bold text-gray-500">{entry?.date}</td>
                                <td className="px-5 py-6">
                                   <p className="text-sm font-semibold text-gray-800 uppercase tracking-tight">{entry?.description}</p>
                                   <p className="text-xs font-mono font-bold mt-0.5" style={{ color: brandColor }}>{entry?.reference}</p>
                                </td>
                                <td className="px-5 py-6 text-right font-mono text-sm font-bold text-gray-600">
                                   {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                                </td>
                                <td className="px-5 py-6 text-right font-mono text-sm font-semibold" style={{ color: brandColor }}>
                                   {line.credit > 0 ? `+ ${formatCurrency(line.credit)}` : '—'}
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>
               </div>
            ) : (
               <div className="p-20 text-center bg-white rounded-md border-2 border-dashed border-gray-200 text-gray-300">
                  <Receipt size={64} strokeWidth={1} className="mx-auto mb-6 opacity-20"/>
                  <h3 className="text-xl font-semibold text-gray-400 uppercase tracking-tight">Record Is Empty</h3>
                  <p className="text-sm text-gray-400 mt-2">No tuition charges or payment receipts have been recognized against this learner ID.</p>
               </div>
            )}

            <div className="bg-gray-800 rounded-md p-5 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-5">
               <div className="relative z-10 flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                     <CreditCard size={28} style={{ color: brandColor }} />
                     <h4 className="text-lg font-semibold tracking-tight uppercase">Digital Settlement</h4><span className="italic text-red-600">to be implemented soon *</span>
                  </div>
                  <p className="text-sm leading-relaxed font-medium" style={{ color: withAlpha(brandColor, 0.45) }}>
                    "Securely settle your outstanding dues via institutional bank transfer or digital wallet. All payments are verified by our treasury department within 24 hours."
                  </p>
               </div>
               <button className="relative z-10 px-12 py-5 bg-white rounded-md text-xs font-semibold uppercase tracking-wide shadow-sm hover:scale-105 active:scale-95 transition-all" style={{ color: brandColor }}>
                  Open Payment Gateway
               </button>
               <div className="absolute top-0 right-0 p-12 opacity-10">
                  <Building size={140} />
               </div>
            </div>
         </div>
      )}

      {activeTab === 'PROFILE' && (
        <div className="max-w-4xl mx-auto bg-white rounded-md border border-gray-200 shadow-md overflow-hidden animate-in zoom-in-95 duration-500">
           <div className="p-8 border-b bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-gray-800 text-white rounded shadow-sm"><ShieldCheck size={24}/></div>
                 <h3 className="text-xl font-semibold text-gray-800 uppercase tracking-tight">Registry Synchronization</h3>
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Version 4.1.0</p>
           </div>
           
           <div className="p-5 bg-amber-50 border-b border-amber-100 flex gap-6">
              <AlertCircle size={28} className="text-amber-600 shrink-0" />
              <div>
                 <h5 className="text-xs font-semibold text-amber-900 uppercase">Registry Lock Protocol</h5>
                 <p className="text-xs text-amber-800 leading-relaxed font-bold mt-1">
                   Updating residency or contact data will trigger a re-verification alert for the Institutional Registrar. Ensure all fields are verifiable against government identification.
                 </p>
              </div>
           </div>

           <div className="p-5 space-y-12 opacity-60 pointer-events-none">
              <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded bg-gray-50">
                 <Lock size={40} className="mx-auto text-gray-300 mb-4" />
                 <p className="text-sm font-semibold uppercase text-gray-400 tracking-wide">Updates Locked By Registrar</p>
                 <p className="text-xs font-bold text-gray-400 mt-2 px-5">Verification of current enrollment cycle is active. Modification of registry data is restricted until completion.</p>
              </div>
           </div>
        </div>
      )}

      {/* Camera Overlay */}
      {showCamera && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-900/95 backdrop-blur-xl flex flex-col items-center justify-center z-[100] p-4">
          <div className="w-full max-w-md space-y-12 text-white">
             <div className="text-center">
                <h3 className="text-lg font-semibold uppercase tracking-tight">Biometric Verification</h3>
                <p className="text-gray-500 text-sm font-medium mt-1">Align your face within the frame for institutional identification.</p>
             </div>
             <div className="relative aspect-square w-full bg-gray-800 rounded-md overflow-hidden border-4 border-white/20 shadow-md" style={{ boxShadow: `0 0 0 8px ${withAlpha(brandColor, 0.1)}` }}>
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                   <div className="w-3/4 h-3/4 border-2 border-dashed border-white/40 rounded-md"></div>
                </div>
             </div>
             <div className="flex items-center justify-center gap-12">
                <button onClick={stopCamera} className="w-16 h-16 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-all"><X size={28} /></button>
                <button onClick={capturePhoto} className="w-24 h-24 flex items-center justify-center bg-white text-gray-900 rounded-full hover:scale-110 active:scale-90 transition-all shadow-md ring-8 ring-white/10"><Camera size={40} /></button>
             </div>
          </div>
        </div>
</ModalPortal>
      )}
    </div>
  );
};

const TabButton: React.FC<{ active: boolean, label: string, onClick: () => void, icon: React.ReactNode, brandColor: string }> = ({ active, label, onClick, icon, brandColor }) => (
  <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded text-xs font-semibold uppercase tracking-wide transition-all ${active ? 'text-white shadow-sm shadow-gray-300/30' : 'text-gray-400 hover:text-gray-600'}`} style={active ? { backgroundColor: brandColor } : undefined}>{icon} {label}</button>
);

export default StudentPortalView;

