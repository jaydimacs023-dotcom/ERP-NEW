
import React, { useState, useRef } from 'react';
import { Student, StudentDocument } from '../types';
import { 
  Search, Plus, Filter, User, Calendar, Mail, Phone, FileText, 
  Upload, CheckCircle, Clock, Trash2, X, Camera, RefreshCw,
  UserCircle, UploadCloud, ShieldCheck, AlertCircle, FileSpreadsheet,
  CheckCircle2, AlertTriangle, ArrowRight, MapPin, Fingerprint,
  GraduationCap, Globe, Building2, Baby, Eye, ShieldAlert,
  ThumbsUp, ThumbsDown, Check, BookOpen, Briefcase, Heart,
  Printer, MoreVertical, ExternalLink, Shield, Download,
  CheckSquare
} from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface StudentsViewProps {
  students: Student[];
  onAddStudent: (student: Student) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onBatchAddStudents: (students: Student[]) => void;
}

const MANDATORY_DOCS = [
  'TOR (Transcript of Records)',
  'Birth Certificate',
  'Application Form',
  'Passport Size Photo'
];

const CSV_HEADERS = [
  'Last Name', 'First Name', 'Middle Name', 'Extension Name', 'Contact Number',
  'E-mail Address', 'Street Address', 'Barangay', 'Municipality/City', 'District',
  'Province', 'Sex', 'Date of Birth (mm-dd-yy)', 'Age', 'Civil Status', 
  'Highest Educational Attainment', 'Nationality', 'ULI'
];

const StudentsView: React.FC<StudentsViewProps> = ({ students, onAddStudent, onUpdateStudent, onDeleteStudent, onBatchAddStudents }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [importPreview, setImportPreview] = useState<Student[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [showEditCamera, setShowEditCamera] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const [auditStudent, setAuditStudent] = useState<Student | null>(null);

  const [mandatoryDocStatuses, setMandatoryDocStatuses] = useState<Record<string, 'PENDING' | 'UPLOADED' | 'VERIFIED'>>({
    'TOR (Transcript of Records)': 'PENDING',
    'Birth Certificate': 'PENDING',
    'Application Form': 'PENDING',
    'Passport Size Photo': 'PENDING'
  });

  const [mandatoryDocFiles, setMandatoryDocFiles] = useState<Record<string, string>>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editVideoRef = useRef<HTMLVideoElement>(null);
  const editCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const csvInputRef = useRef<HTMLInputElement>(null);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Student>>({
    uli: '', lastName: '', firstName: '', middleName: '', extension: '', sex: 'Male',
    dateOfBirth: '', age: 0, birthRegion: '', birthProvince: '', birthCity: '',
    civilStatus: 'Single', educationalAttainment: 'College Graduate', nationality: 'Filipino',
    email: '', contactNumber: '', street: '', barangay: '', city: '', district: '',
    province: '', guardian: '',
  });

  const filteredStudents = students.filter(s => 
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.uli.includes(searchTerm)
  );

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," + CSV_HEADERS.join(",");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Learner_Batch_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) return;

      const studentData: Student[] = [];
      const headers = lines[0].split(',').map(h => h.trim());

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        
        // Mapping based on MIS file format:
        // 0: Last Name, 1: First Name, 2: Middle Name, 3: Extension Name, 4: Contact Number,
        // 5: E-mail Address, 6: Street Address, 7: Barangay, 8: Municipality/City, 9: District,
        // 10: Province, 11: Sex, 12: Date of Birth, 13: Age, 14: Civil Status, 
        // 15: Educational Attainment, 16: Nationality, 17: ULI
        const getVal = (idx: number) => cols[idx] || '';

        // Parse date - handle mm-dd-yy or mm/dd/yyyy format
        const dobRaw = getVal(12);
        let dob = '';
        if (dobRaw) {
          const dateParts = dobRaw.split(/[\/\-]/);
          if (dateParts.length === 3) {
            const month = dateParts[0].padStart(2, '0');
            const day = dateParts[1].padStart(2, '0');
            let year = dateParts[2];
            if (year.length === 2) {
              year = parseInt(year) > 50 ? '19' + year : '20' + year;
            }
            dob = `${year}-${month}-${day}`;
          }
        }
        const age = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : parseInt(getVal(13)) || 0;

        studentData.push({
          id: `batch-${Date.now()}-${i}`,
          orgId: 'temp',
          uli: getVal(17),
          lastName: getVal(0),
          firstName: getVal(1),
          middleName: getVal(2),
          extension: getVal(3),
          sex: (getVal(11) as any) || 'Male',
          dateOfBirth: dob,
          age: Math.max(0, age),
          birthRegion: '',
          birthProvince: '',
          birthCity: '',
          civilStatus: getVal(14) || 'Single',
          educationalAttainment: getVal(15),
          nationality: getVal(16) || 'Filipino',
          email: getVal(5),
          contactNumber: getVal(4),
          street: getVal(6),
          barangay: getVal(7),
          city: getVal(8),
          district: getVal(9),
          province: getVal(10),
          guardian: '',
          locationId: undefined,
          sponsorId: undefined,
          documents: MANDATORY_DOCS.map((doc, dIdx) => ({
            id: `doc-${dIdx}-${Date.now()}-${i}`,
            name: doc,
            status: 'PENDING'
          })),
          createdAt: new Date().toISOString()
        });
      }
      setImportPreview(studentData);
      setShowImportModal(true);
      if (csvInputRef.current) csvInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const commitBatch = () => {
    onBatchAddStudents(importPreview);
    showToast(`${importPreview.length} students imported successfully!`, 'success');
    setImportPreview([]);
    setShowImportModal(false);
  };

  const handleDocumentAudit = (docId: string, action: 'VERIFY' | 'REJECT') => {
    if (!auditStudent) return;
    try {
      const nextDocs = auditStudent.documents.map(d => 
        d.id === docId ? { ...d, status: action === 'VERIFY' ? 'VERIFIED' as const : 'REJECTED' as const } : d
      );
      const updated = { ...auditStudent, documents: nextDocs };
      onUpdateStudent(updated);
      setAuditStudent(updated);
      const docName = auditStudent.documents.find(d => d.id === docId)?.name || 'Document';
      showToast(`${docName} ${action === 'VERIFY' ? 'verified' : 'rejected'} successfully!`, 'success');
    } catch (error) {
      showToast(`Failed to update document: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleToggleOverride = () => {
    if (!auditStudent) return;
    try {
      const updated = { ...auditStudent, isEnrollmentOverridden: !auditStudent.isEnrollmentOverridden };
      onUpdateStudent(updated);
      setAuditStudent(updated);
      showToast(`Enrollment override ${updated.isEnrollmentOverridden ? 'enabled' : 'disabled'} successfully!`, 'success');
    } catch (error) {
      showToast(`Failed to update enrollment override: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dob = e.target.value;
    const age = new Date().getFullYear() - new Date(dob).getFullYear();
    setFormData({ ...formData, dateOfBirth: dob, age: Math.max(0, age) });
  };

  const startCamera = () => {
    setShowCamera(true);
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } } 
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        alert("Camera access denied.");
        setShowCamera(false);
      }
    }, 100);
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
        setPhotoPreview(dataUrl);
        setMandatoryDocStatuses(prev => ({ ...prev, 'Passport Size Photo': 'UPLOADED' }));
        setMandatoryDocFiles(prev => ({ ...prev, 'Passport Size Photo': dataUrl }));
        stopCamera();
      }
    }
  };

  const handleDocumentUpload = (docName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setMandatoryDocStatuses(prev => ({ ...prev, [docName]: 'UPLOADED' }));
        setMandatoryDocFiles(prev => ({ ...prev, [docName]: dataUrl }));
      };
      reader.readAsDataURL(file);
    }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const documents: StudentDocument[] = MANDATORY_DOCS.map((doc, idx) => ({
        id: `doc-${idx}-${Date.now()}`,
        name: doc,
        status: mandatoryDocStatuses[doc],
        fileData: mandatoryDocFiles[doc]
      }));
      onAddStudent({ ...formData as Student, id: `stud-${Date.now()}`, orgId: 'temp', documents, createdAt: new Date().toISOString() });
      showToast(`Student ${formData.firstName} ${formData.lastName} registered successfully!`, 'success');
      setShowModal(false);
      // Reset form
      setFormData({
        uli: '', lastName: '', firstName: '', middleName: '', extension: '', sex: 'Male',
        dateOfBirth: '', age: 0, birthRegion: '', birthProvince: '', birthCity: '',
        civilStatus: 'Single', educationalAttainment: 'College Graduate', nationality: 'Filipino',
        email: '', contactNumber: '', street: '', barangay: '', city: '', district: '',
        province: '', guardian: '',
      });
    } catch (error) {
      showToast(`Failed to register student: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
    setShowModal(false);
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
              toast.type === 'success'
                ? 'bg-emerald-50 border border-teal-200 text-teal-800'
                : toast.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-teal-50 border border-teal-200 text-teal-800'
            }`}
          >
            {toast.type === 'success' && <CheckCircle size={18} className="flex-shrink-0 text-teal-600" />}
            {toast.type === 'error' && <AlertCircle size={18} className="flex-shrink-0 text-red-600" />}
            {toast.type === 'info' && <AlertCircle size={18} className="flex-shrink-0 text-teal-600" />}
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

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Learner Ledger</h2>
          <p className="text-sm text-slate-500 font-normal italic">Institutional Compliance & Enrollment Oversight (v4.0.1)</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2.5 text-slate-500 hover:text-teal-600 transition-colors text-xs font-black uppercase tracking-widest">
            <Download size={16} /> Template
          </button>
          <input type="file" ref={csvInputRef} className="hidden" accept=".csv" onChange={handleCsvFileChange} />
          <button onClick={() => csvInputRef.current?.click()} className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all border border-slate-200 font-bold text-sm">
            <FileSpreadsheet size={18} className="text-teal-600" /> MIS Batch
          </button>
          <button onClick={() => { setShowModal(true); setPhotoPreview(null); }} className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-all shadow-lg font-bold text-sm">
            <Plus size={18} /> Register Learner
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Learner Identification</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compliance Status</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Residence</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStudents.map(student => {
              const pendingDocs = student.documents.filter(d => d.status === 'UPLOADED').length;
              const verifiedDocs = student.documents.filter(d => d.status === 'VERIFIED').length;
              const isCompliant = verifiedDocs === student.documents.length || student.isEnrollmentOverridden;

              return (
                <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-teal-50 flex items-center justify-center border border-teal-100 shadow-sm shrink-0">
                        {student.documents.find(d => d.name === 'Passport Size Photo')?.fileData ? (
                          <img src={student.documents.find(d => d.name === 'Passport Size Photo')?.fileData} alt="S" className="w-full h-full object-cover" />
                        ) : (
                          <UserCircle className="text-teal-300" size={24} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-black text-slate-800 leading-tight">
                          {student.lastName.toUpperCase()}, {student.firstName}
                        </div>
                        <div className="text-[9px] font-mono font-bold text-teal-600 mt-1 uppercase">ULI: {student.uli}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1.5">
                       {isCompliant ? (
                         <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-teal-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 w-fit">
                            <Check size={10} /> Qualified
                         </span>
                       ) : pendingDocs > 0 ? (
                         <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 w-fit animate-pulse">
                            <ShieldAlert size={10} /> {pendingDocs} Audit Pending
                         </span>
                       ) : (
                         <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 w-fit">
                            Incomplete
                         </span>
                       )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-[10px] text-slate-600 font-bold leading-tight">{student.city}</div>
                    <div className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">{student.province}</div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditingStudent(student); setShowEditModal(true); setFormData(student); }} className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-600 hover:text-white transition-all" title="Edit Student">
                        <RefreshCw size={16} />
                      </button>
                      <button onClick={() => setAuditStudent(student)} className="p-2 bg-teal-50 text-teal-600 rounded-xl hover:bg-teal-600 hover:text-white transition-all" title="View Audit">
                        <Eye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Batch Import Preview Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in duration-300 border border-slate-200 my-8 flex flex-col h-full max-h-[90vh]">
            <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center shrink-0">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-100"><FileSpreadsheet size={24} /></div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Batch Import Preview</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Found {importPreview.length} Institutional Records</p>
                  </div>
               </div>
               <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={28}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-0 scrollbar-hide">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50 sticky top-0 z-10">
                   <tr>
                     <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Identities</th>
                     <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Personal Info</th>
                     <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact & Residence</th>
                     <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Registry Data</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                   {importPreview.map((p, idx) => (
                     <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                       <td className="px-8 py-5">
                          <p className="text-sm font-black text-slate-800 uppercase">{p.lastName}, {p.firstName}</p>
                          <p className="text-[10px] font-mono font-bold text-teal-600 uppercase mt-0.5">{p.uli}</p>
                       </td>
                       <td className="px-8 py-5">
                          <p className="text-xs font-bold text-slate-600">{p.dateOfBirth} ({p.age}y)</p>
                          <p className="text-[10px] text-slate-400 uppercase font-black">{p.sex} • {p.civilStatus}</p>
                       </td>
                       <td className="px-8 py-5">
                          <p className="text-xs font-bold text-slate-600 truncate max-w-[200px]">{p.email}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-black">{p.city}, {p.province}</p>
                       </td>
                       <td className="px-8 py-5">
                          <p className="text-xs font-bold text-slate-600">{p.educationalAttainment}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-black">Guardian: {p.guardian || 'N/A'}</p>
                       </td>
                     </tr>
                   ))}
                </tbody>
              </table>
            </div>

            <div className="p-8 bg-slate-900 flex flex-col md:flex-row justify-between items-center gap-6 border-t border-white/5">
               <div className="flex items-center gap-4 text-white">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
                     <ShieldCheck size={24} className="text-brand" />
                  </div>
                  <div>
                     <p className="text-sm font-black uppercase tracking-tight">Integrity Verification</p>
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Full registry alignment checked against institutional schema.</p>
                  </div>
               </div>
               <div className="flex gap-4 w-full md:w-auto">
                  <button onClick={() => setShowImportModal(false)} className="flex-1 px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-white transition-colors">Discard Batch</button>
                  <button onClick={commitBatch} className="flex-1 px-12 py-4 bg-brand text-white rounded-3xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-brand/20 hover:scale-[1.02] active:scale-95 transition-all">Commit {importPreview.length} Records</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Audit Modal (View Function) */}
      {auditStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] overflow-y-auto">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in duration-300 border border-slate-200 my-8 flex flex-col h-full max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center shrink-0">
               <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-[1.5rem] overflow-hidden bg-white border-4 border-white shadow-xl flex items-center justify-center shrink-0">
                    {auditStudent.documents.find(d => d.name === 'Passport Size Photo')?.fileData ? (
                      <img src={auditStudent.documents.find(d => d.name === 'Passport Size Photo')?.fileData} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle size={32} className="text-slate-300" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">
                      {auditStudent.lastName.toUpperCase()}, {auditStudent.firstName}
                    </h3>
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] font-mono font-black text-teal-600 uppercase tracking-widest bg-teal-50 px-2 py-0.5 rounded">ULI: {auditStudent.uli}</span>
                       <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                         (auditStudent.documents.filter(d => d.status === 'VERIFIED').length === auditStudent.documents.length || auditStudent.isEnrollmentOverridden)
                         ? 'bg-emerald-50 text-teal-600 border-emerald-100'
                         : 'bg-amber-50 text-amber-600 border-amber-100'
                       }`}>
                         {auditStudent.isEnrollmentOverridden ? 'ADMIN OVERRIDE ACTIVE' : 'STANDARD REGISTRY'}
                       </span>
                    </div>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <button className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 text-slate-400 hover:text-slate-800 transition-colors"><Printer size={20} /></button>
                  <button onClick={() => setAuditStudent(null)} className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-colors"><X size={20} /></button>
               </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
               {/* Left Column: Comprehensive Profile */}
               <div className="flex-1 overflow-y-auto p-10 space-y-12 scrollbar-hide border-r border-slate-100 bg-white">
                  <section className="space-y-6">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-teal-50 text-teal-600 rounded-xl"><User size={18}/></div>
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Personal Registry Details</h4>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                       <DataPoint label="Birth Date" value={auditStudent.dateOfBirth} />
                       <DataPoint label="Sex" value={auditStudent.sex} />
                       <DataPoint label="Civil Status" value={auditStudent.civilStatus} />
                       <DataPoint label="Nationality" value={auditStudent.nationality} />
                       <DataPoint label="Birth Region" value={auditStudent.birthRegion} />
                       <DataPoint label="Birth City" value={auditStudent.birthCity} />
                       <DataPoint label="Educational Attainment" value={auditStudent.educationalAttainment} isSpan2 />
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-teal-50 text-teal-600 rounded-xl"><MapPin size={18}/></div>
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Residence & Contact</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <DataPoint label="Official Email" value={auditStudent.email} />
                       <DataPoint label="Contact Number" value={auditStudent.contactNumber} />
                    </div>
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                       <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Detailed Address</div>
                       <p className="text-sm font-bold text-slate-800 uppercase leading-relaxed">
                          {auditStudent.street}, {auditStudent.barangay}, {auditStudent.city}, {auditStudent.district}, {auditStudent.province}
                       </p>
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-teal-50 text-teal-600 rounded-xl"><Heart size={18}/></div>
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Family Background</h4>
                    </div>
                    <DataPoint label="Primary Guardian / Parent" value={auditStudent.guardian || 'Not Declared'} />
                  </section>
               </div>

               {/* Right Column: Compliance Ledger & Audit */}
               <div className="w-full md:w-[450px] bg-slate-50 overflow-y-auto p-10 flex flex-col shrink-0">
                  <div className="flex items-center justify-between mb-8">
                     <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <ShieldCheck size={18} className="text-teal-600" />
                        Compliance Audit
                     </h4>
                     <button 
                       onClick={handleToggleOverride}
                       className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                         auditStudent.isEnrollmentOverridden 
                         ? 'bg-rose-600 text-white shadow-lg' 
                         : 'bg-white border border-slate-200 text-slate-400 hover:text-rose-600'
                       }`}
                     >
                       {auditStudent.isEnrollmentOverridden ? 'Revoke Override' : 'Force Qualify'}
                     </button>
                  </div>

                  <div className="space-y-6">
                     {auditStudent.documents.map(doc => {
                       const isUploaded = doc.status === 'UPLOADED' || doc.status === 'VERIFIED';
                       const isVerified = doc.status === 'VERIFIED';
                       const isRejected = doc.status === 'REJECTED';

                       return (
                         <div key={doc.id} className={`p-6 rounded-[2rem] border transition-all ${
                           isVerified ? 'bg-emerald-50/50 border-emerald-100 shadow-sm' :
                           isRejected ? 'bg-rose-50 border-rose-100' :
                           isUploaded ? 'bg-white border-teal-100 shadow-xl' : 'bg-slate-100/50 border-slate-200 opacity-60'
                         }`}>
                            <div className="flex justify-between items-start mb-4">
                               <div className="flex items-center gap-3 min-w-0">
                                  {isVerified ? <CheckCircle2 size={20} className="text-emerald-500 shrink-0"/> : 
                                   isRejected ? <ShieldAlert size={20} className="text-rose-500 shrink-0"/> :
                                   isUploaded ? <UploadCloud size={20} className="text-teal-500 shrink-0 animate-bounce"/> :
                                   <Clock size={20} className="text-slate-300 shrink-0"/>}
                                  <div className="min-w-0">
                                     <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{doc.name}</p>
                                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Status: {doc.status}</p>
                                  </div>
                               </div>
                               {doc.fileData && (
                                 <button className="p-2 hover:bg-slate-100 rounded-lg text-teal-600"><ExternalLink size={16}/></button>
                               )}
                            </div>

                            {doc.fileData && doc.status === 'UPLOADED' && (
                              <div className="flex gap-2 pt-4 border-t border-slate-100">
                                 <button onClick={() => handleDocumentAudit(doc.id, 'REJECT')} className="flex-1 py-2.5 bg-white border border-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-600 hover:text-white transition-all">
                                    <ThumbsDown size={14}/> Reject
                                 </button>
                                 <button onClick={() => handleDocumentAudit(doc.id, 'VERIFY')} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">
                                    <ThumbsUp size={14}/> Verify
                                 </button>
                              </div>
                            )}

                            {isVerified && (
                               <div className="text-[9px] font-black text-teal-600 uppercase italic mt-1 text-center">System Validated • Audit Verified</div>
                            )}
                         </div>
                       )
                     })}
                  </div>

                  <div className="mt-auto pt-10">
                     <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-2xl relative overflow-hidden">
                        <div className="relative z-10 flex items-center gap-4">
                           <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
                              <Shield size={24} className="text-brand" />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-brand uppercase tracking-widest">Enrollment Status</p>
                              <p className="text-base font-black uppercase">
                                 {(auditStudent.documents.filter(d => d.status === 'VERIFIED').length === auditStudent.documents.length || auditStudent.isEnrollmentOverridden)
                                 ? 'Qualified for Deployment'
                                 : 'Incomplete Compliance'}
                              </p>
                           </div>
                        </div>
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                           <CheckCircle size={100} />
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Registration Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8 flex flex-col md:flex-row h-full max-h-[95vh]">
            <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-teal-600 text-white rounded-2xl shadow-xl shadow-teal-100"><User size={20} /></div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Manual Registry Entry</h3>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-12 pb-10">
                {/* 1. Personal Identity */}
                <section className="space-y-6">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"><Fingerprint size={16} /></div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">I. Personal Identification</h4>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">ULI (Learner ID)</label>
                      <input required placeholder="24-XXX-XXX-XXXX" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-black text-teal-600 font-mono" value={formData.uli} onChange={e => setFormData({...formData, uli: e.target.value})} />
                    </div>
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Last Name</label>
                      <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                    </div>
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">First Name</label>
                      <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Middle</label>
                      <input className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800" value={formData.middleName} onChange={e => setFormData({...formData, middleName: e.target.value})} />
                    </div>
                    <div className="md:col-span-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Ext.</label>
                      <input placeholder="Jr" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800" value={formData.extension} onChange={e => setFormData({...formData, extension: e.target.value})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Birth Date</label>
                        <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800" value={formData.dateOfBirth} onChange={handleDobChange} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Computed Age</label>
                        <input readOnly className="w-full px-4 py-3 bg-slate-100 border border-slate-100 rounded-2xl text-sm font-black text-slate-500" value={formData.age} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Sex</label>
                        <select className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800" value={formData.sex} onChange={e => setFormData({...formData, sex: e.target.value as any})}>
                           <option value="Male">Male</option>
                           <option value="Female">Female</option>
                        </select>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Civil Status</label>
                        <select className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800" value={formData.civilStatus} onChange={e => setFormData({...formData, civilStatus: e.target.value})}>
                           <option value="Single">Single</option>
                           <option value="Married">Married</option>
                           <option value="Widowed">Widowed</option>
                           <option value="Separated">Separated</option>
                        </select>
                     </div>
                  </div>
                </section>

                {/* 2. Contact & Address */}
                <section className="space-y-6">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"><MapPin size={16} /></div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">II. Contact & Residence</h4>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Institutional Email</label>
                         <input required type="email" placeholder="learner@manila.edu.ph" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Contact Number</label>
                         <input required placeholder="09XX XXX XXXX" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800" value={formData.contactNumber} onChange={e => setFormData({...formData, contactNumber: e.target.value})} />
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
                      <div className="md:col-span-4 space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">House # / Street</label>
                         <input required placeholder="Kalsada St. / Bldg 123" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800" value={formData.street} onChange={e => setFormData({...formData, street: e.target.value})} />
                      </div>
                      <div className="md:col-span-3 space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Barangay</label>
                         <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800" value={formData.barangay} onChange={e => setFormData({...formData, barangay: e.target.value})} />
                      </div>
                      <div className="md:col-span-3 space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">City / Municipality</label>
                         <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Province</label>
                         <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800" value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})} />
                      </div>
                   </div>
                </section>

                {/* 3. Education & Guardian */}
                <section className="space-y-6">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"><BookOpen size={16} /></div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">III. Background & Guardian</h4>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Educational Attainment</label>
                         <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800" value={formData.educationalAttainment} onChange={e => setFormData({...formData, educationalAttainment: e.target.value})}>
                            <option value="Elementary Graduate">Elementary Graduate</option>
                            <option value="High School Graduate">High School Graduate</option>
                            <option value="College Level">College Level</option>
                            <option value="College Graduate">College Graduate</option>
                            <option value="TVET Graduate">TVET Graduate</option>
                            <option value="Masteral/PhD">Masteral/PhD</option>
                         </select>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nationality</label>
                         <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800" value={formData.nationality} onChange={e => setFormData({...formData, nationality: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1"><Heart size={10} className="text-rose-500" /> Primary Guardian</label>
                         <input required placeholder="Name of parent or guardian" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800" value={formData.guardian} onChange={e => setFormData({...formData, guardian: e.target.value})} />
                      </div>
                   </div>
                </section>

                <div className="pt-4">
                  <button type="submit" className="w-full py-5 bg-teal-600 text-white rounded-3xl text-sm font-black shadow-xl shadow-teal-100 hover:bg-teal-700 active:scale-95 transition-all">Commit Registry Entry</button>
                </div>
              </form>
            </div>

            <div className="w-full md:w-[450px] bg-slate-50 overflow-y-auto p-8 flex flex-col border-l border-slate-100">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <FileText size={16} className="text-teal-600" /> Compliance Folder
              </h4>
              
              {/* Camera Hero Section */}
              <div className="mb-8 p-6 bg-slate-900 rounded-3xl text-white shadow-2xl relative overflow-hidden group">
                 <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                       <h5 className="text-[10px] font-black text-teal-400 uppercase tracking-[0.2em]">Official Portrait</h5>
                       <span className="px-2 py-0.5 bg-white/10 rounded text-[8px] font-black uppercase">Standard: 2x2</span>
                    </div>
                    {photoPreview ? (
                      <div className="aspect-square w-32 mx-auto rounded-2xl border-2 border-teal-500/30 overflow-hidden bg-black shadow-2xl transition-transform group-hover:scale-105">
                         <img src={photoPreview} className="w-full h-full object-cover" alt="Passport" />
                      </div>
                    ) : (
                      <div className="aspect-square w-32 mx-auto rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-slate-500 group-hover:border-teal-400/50 transition-all">
                         <User size={32} />
                         <span className="text-[8px] font-black uppercase mt-2">No Photo</span>
                      </div>
                    )}
                    <button onClick={startCamera} className="w-full mt-6 py-3 bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-teal-500 transition-all shadow-xl shadow-teal-900/40">
                       <Camera size={14} /> Open System Camera
                    </button>
                 </div>
                 <div className="absolute top-0 right-0 p-8 opacity-5">
                    <ShieldCheck size={120} />
                 </div>
              </div>

              <div className="space-y-4 flex-1">
                {MANDATORY_DOCS.filter(d => d !== 'Passport Size Photo').map(doc => {
                  const status = mandatoryDocStatuses[doc];
                  const hasFile = status === 'UPLOADED' || status === 'VERIFIED';
                  return (
                    <div key={doc} className={`p-4 rounded-3xl border transition-all ${hasFile ? 'bg-white border-teal-100 shadow-sm' : 'bg-slate-100/50 border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 overflow-hidden">
                          {hasFile ? <CheckCircle size={18} className="text-emerald-500 shrink-0" /> : <Clock size={18} className="text-slate-300 shrink-0" />}
                          <span className={`text-[11px] font-black uppercase tracking-tight truncate ${hasFile ? 'text-slate-800' : 'text-slate-400'}`}>{doc}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => fileInputRefs.current[doc]?.click()} className={`flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase text-slate-600 hover:border-teal-600 transition-colors`}>
                          <Upload size={14} /> {hasFile ? 'Replace' : 'Attach'}
                        </button>
                      </div>
                      <input type="file" className="hidden" ref={el => { if (el) fileInputRefs.current[doc] = el; }} onChange={(e) => handleDocumentUpload(doc, e)} accept=".pdf,.jpg,.jpeg,.png" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditModal && editingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300 border border-slate-200 my-8">
            <div className="p-8 border-b bg-gradient-to-r from-amber-50 to-amber-100/50 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-600 text-white rounded-2xl shadow-xl shadow-amber-100"><RefreshCw size={24} /></div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Edit Student Record</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Update {editingStudent.firstName} {editingStudent.lastName}'s Information</p>
                </div>
              </div>
              <button onClick={() => { setShowEditModal(false); setEditingStudent(null); setEditPhotoPreview(null); setShowEditCamera(false); }} className="p-3 hover:bg-white rounded-xl transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              try {
                // Update documents with new photo if changed
                let updatedDocuments = editingStudent.documents || [];
                if (editPhotoPreview) {
                  const photoDocIndex = updatedDocuments.findIndex(d => d.name === 'Passport Size Photo');
                  const newPhotoDoc = {
                    id: photoDocIndex >= 0 ? updatedDocuments[photoDocIndex].id : `doc-photo-${Date.now()}`,
                    name: 'Passport Size Photo',
                    status: 'UPLOADED' as const,
                    fileData: editPhotoPreview
                  };
                  if (photoDocIndex >= 0) {
                    updatedDocuments = updatedDocuments.map((d, i) => i === photoDocIndex ? newPhotoDoc : d);
                  } else {
                    updatedDocuments = [...updatedDocuments, newPhotoDoc];
                  }
                }

                const updatedStudent: Student = {
                  ...editingStudent,
                  ...formData,
                  id: editingStudent.id,
                  orgId: editingStudent.orgId,
                  documents: updatedDocuments,
                  createdAt: editingStudent.createdAt,
                  createdBy: editingStudent.createdBy
                } as Student;
                onUpdateStudent(updatedStudent);
                showToast(`Student ${formData.firstName} ${formData.lastName} updated successfully!`, 'success');
                setShowEditModal(false);
                setEditingStudent(null);
                setEditPhotoPreview(null);
              } catch (error) {
                showToast(`Failed to update student: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
              }
            }} className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">

              {/* Student Photo */}
              <div className="flex flex-col items-center mb-4 gap-4">
                <div className="relative">
                  <div className="w-32 h-32 rounded-3xl border-4 border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center shadow-lg">
                    {showEditCamera ? (
                      <video ref={editVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    ) : editPhotoPreview ? (
                      <img src={editPhotoPreview} alt="New Photo" className="w-full h-full object-cover" />
                    ) : editingStudent.documents?.find(d => d.name === 'Passport Size Photo')?.fileData ? (
                      <img src={editingStudent.documents.find(d => d.name === 'Passport Size Photo')?.fileData} alt="Student" className="w-full h-full object-cover" />
                    ) : (
                      <User size={48} className="text-slate-300" />
                    )}
                  </div>
                  {editPhotoPreview && (
                    <button type="button" onClick={() => setEditPhotoPreview(null)} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <canvas ref={editCanvasRef} className="hidden" />
                <input type="file" ref={editPhotoInputRef} accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => setEditPhotoPreview(reader.result as string);
                    reader.readAsDataURL(file);
                  }
                }} />
                <div className="flex gap-2">
                  {showEditCamera ? (
                    <>
                      <button type="button" onClick={() => {
                        if (editVideoRef.current && editCanvasRef.current) {
                          const context = editCanvasRef.current.getContext('2d');
                          if (context) {
                            editCanvasRef.current.width = editVideoRef.current.videoWidth;
                            editCanvasRef.current.height = editVideoRef.current.videoHeight;
                            context.drawImage(editVideoRef.current, 0, 0);
                            const dataUrl = editCanvasRef.current.toDataURL('image/jpeg', 0.8);
                            setEditPhotoPreview(dataUrl);
                            if (editVideoRef.current?.srcObject) {
                              (editVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
                            }
                            setShowEditCamera(false);
                          }
                        }
                      }} className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-green-700 transition-colors flex items-center gap-2">
                        <Camera size={14} /> Capture
                      </button>
                      <button type="button" onClick={() => {
                        if (editVideoRef.current?.srcObject) {
                          (editVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
                        }
                        setShowEditCamera(false);
                      }} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-300 transition-colors">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => {
                        setShowEditCamera(true);
                        setTimeout(async () => {
                          try {
                            const stream = await navigator.mediaDevices.getUserMedia({ 
                              video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } } 
                            });
                            if (editVideoRef.current) editVideoRef.current.srcObject = stream;
                          } catch (err) {
                            alert("Camera access denied.");
                            setShowEditCamera(false);
                          }
                        }, 100);
                      }} className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-amber-200 transition-colors flex items-center gap-2">
                        <Camera size={14} /> Camera
                      </button>
                      <button type="button" onClick={() => editPhotoInputRef.current?.click()} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-200 transition-colors flex items-center gap-2">
                        <Upload size={14} /> Upload
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {/* Personal Information */}
              <section className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"><User size={16} /></div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">I. Personal Information</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">ULI</label>
                    <input disabled className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-bold text-slate-500 opacity-75 cursor-not-allowed" value={formData.uli} />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Last Name</label>
                    <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">First Name</label>
                    <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Middle Name</label>
                    <input className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.middleName} onChange={e => setFormData({...formData, middleName: e.target.value})} />
                  </div>
                  <div className="md:col-span-1 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Extension</label>
                    <input className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.extension} onChange={e => setFormData({...formData, extension: e.target.value})} />
                  </div>
                  <div className="md:col-span-1 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Sex</label>
                    <select className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.sex} onChange={e => setFormData({...formData, sex: e.target.value})}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Date of Birth</label>
                    <input required type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.dateOfBirth} onChange={handleDobChange} />
                  </div>
                </div>

                {/* Birth Address */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Birth Region</label>
                    <input className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.birthRegion || ''} onChange={e => setFormData({...formData, birthRegion: e.target.value})} placeholder="e.g. NCR, Region IV-A" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Birth Province</label>
                    <input className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.birthProvince || ''} onChange={e => setFormData({...formData, birthProvince: e.target.value})} placeholder="e.g. Metro Manila, Laguna" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Birth City/Municipality</label>
                    <input className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.birthCity || ''} onChange={e => setFormData({...formData, birthCity: e.target.value})} placeholder="e.g. Manila, Calamba" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Civil Status</label>
                    <select className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.civilStatus} onChange={e => setFormData({...formData, civilStatus: e.target.value})}>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Divorced">Divorced</option>
                      <option value="Separated">Separated</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Email</label>
                    <input type="email" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Contact Number</label>
                    <input type="tel" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.contactNumber} onChange={e => setFormData({...formData, contactNumber: e.target.value})} />
                  </div>
                </div>
              </section>

              {/* Address Information */}
              <section className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"><MapPin size={16} /></div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">II. Address Information</h4>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Street Address</label>
                    <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.street} onChange={e => setFormData({...formData, street: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Barangay</label>
                      <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.barangay} onChange={e => setFormData({...formData, barangay: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">City / Municipality</label>
                      <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Province</label>
                      <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})} />
                    </div>
                  </div>
                </div>
              </section>

              {/* Education & Guardian */}
              <section className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"><BookOpen size={16} /></div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">III. Background & Guardian</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Educational Attainment</label>
                    <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.educationalAttainment} onChange={e => setFormData({...formData, educationalAttainment: e.target.value})}>
                      <option value="Elementary Graduate">Elementary Graduate</option>
                      <option value="High School Graduate">High School Graduate</option>
                      <option value="College Level">College Level</option>
                      <option value="College Graduate">College Graduate</option>
                      <option value="TVET Graduate">TVET Graduate</option>
                      <option value="Masteral/PhD">Masteral/PhD</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nationality</label>
                    <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.nationality} onChange={e => setFormData({...formData, nationality: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1"><Heart size={10} className="text-rose-500" /> Primary Guardian</label>
                    <input placeholder="Name of parent or guardian (optional)" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-600 outline-none text-sm font-bold text-slate-800" value={formData.guardian || ''} onChange={e => setFormData({...formData, guardian: e.target.value})} />
                  </div>
                </div>
              </section>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => { setShowEditModal(false); setEditingStudent(null); setEditPhotoPreview(null); setShowEditCamera(false); }} className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-50 transition-all">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-amber-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-amber-100 hover:bg-amber-700 active:scale-95 transition-all">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera Overlay */}
      {showCamera && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center z-[100] p-4">
          <div className="w-full max-w-md space-y-12">
             <div className="text-center">
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">Identity Capture</h3>
                <p className="text-slate-500 text-sm font-medium mt-1">Position learner's face within the frame.</p>
             </div>
             <div className="relative aspect-square w-full bg-slate-900 rounded-[3rem] overflow-hidden border-4 border-white shadow-2xl ring-24 ring-teal-600/10">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                   <div className="w-3/4 h-3/4 border-2 border-dashed border-white/40 rounded-[2rem] relative">
                      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-1/2 h-1/2 border-2 border-white/20 rounded-full"></div>
                   </div>
                </div>
             </div>
             <div className="flex items-center justify-center gap-12">
                <button onClick={stopCamera} className="w-16 h-16 flex items-center justify-center bg-white/10 text-white rounded-full hover:bg-white/20 transition-all">
                  <X size={28} />
                </button>
                <button onClick={capturePhoto} className="w-24 h-24 flex items-center justify-center bg-white text-slate-900 rounded-full hover:scale-110 active:scale-90 transition-all shadow-2xl ring-8 ring-white/10">
                  <Camera size={40} />
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DataPoint: React.FC<{ label: string, value: string, isSpan2?: boolean }> = ({ label, value, isSpan2 }) => (
  <div className={isSpan2 ? 'md:col-span-2' : ''}>
     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
     <p className="text-sm font-black text-slate-800 leading-tight uppercase">{value || 'N/A'}</p>
  </div>
);

export default StudentsView;
