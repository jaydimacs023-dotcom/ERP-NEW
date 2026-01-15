
import React, { useState, useRef } from 'react';
import { Student, StudentDocument } from '../types';
import { 
  Search, Plus, Filter, User, Calendar, Mail, Phone, FileText, 
  Upload, CheckCircle, Clock, Trash2, X, Camera, RefreshCw,
  UserCircle, UploadCloud, ShieldCheck, AlertCircle, FileSpreadsheet,
  CheckCircle2, AlertTriangle, ArrowRight, MapPin, Fingerprint,
  GraduationCap, Globe, Building2, Baby
} from 'lucide-react';

interface StudentsViewProps {
  students: Student[];
  onAddStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onBatchAddStudents: (students: Student[]) => void;
}

const MANDATORY_DOCS = [
  'TOR (Transcript of Records)',
  'Birth Certificate',
  'Application Form',
  'Passport Size Photo'
];

const StudentsView: React.FC<StudentsViewProps> = ({ students, onAddStudent, onDeleteStudent, onBatchAddStudents }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<Student[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  
  const [mandatoryDocStatuses, setMandatoryDocStatuses] = useState<Record<string, 'PENDING' | 'UPLOADED' | 'VERIFIED'>>({
    'TOR (Transcript of Records)': 'PENDING',
    'Birth Certificate': 'PENDING',
    'Application Form': 'PENDING',
    'Passport Size Photo': 'PENDING'
  });

  const [mandatoryDocFiles, setMandatoryDocFiles] = useState<Record<string, string>>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Student>>({
    uli: '',
    lastName: '',
    firstName: '',
    middleName: '',
    extension: '',
    sex: 'Male',
    dateOfBirth: '',
    age: 0,
    birthRegion: '',
    birthProvince: '',
    birthCity: '',
    civilStatus: 'Single',
    educationalAttainment: '',
    nationality: 'Filipino',
    email: '',
    contactNumber: '',
    street: '',
    barangay: '',
    city: '',
    district: '',
    province: '',
    guardian: '',
  });

  const filteredStudents = students.filter(s => 
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.uli.includes(searchTerm)
  );

  const triggerFileInput = (docName: string) => {
    fileInputRefs.current[docName]?.click();
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/);
      const studentData: Student[] = [];
      
      // MIS 03-02 Parsing Logic (v3.0.2)
      for (let i = 8; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (cols.length < 40) continue; 

        const lastName = cols[15]?.replace(/"/g, '').trim();
        const firstName = cols[16]?.replace(/"/g, '').trim();
        const middleName = cols[17]?.replace(/"/g, '').trim() === '.' ? '' : cols[17]?.replace(/"/g, '').trim();
        const extension = cols[18]?.replace(/"/g, '').trim();
        const contact = cols[19]?.replace(/"/g, '').trim();
        const email = cols[20]?.replace(/"/g, '').trim();
        
        // Address parts
        const street = cols[21]?.replace(/"/g, '').trim();
        const barangay = cols[22]?.replace(/"/g, '').trim();
        const city = cols[23]?.replace(/"/g, '').trim();
        const district = cols[24]?.replace(/"/g, '').trim();
        const province = cols[25]?.replace(/"/g, '').trim();

        // Birth Place info (Assuming typical MIS columns 32, 33, 34 for Birth Region, Province, City)
        const bRegion = cols[32]?.replace(/"/g, '').trim() || '';
        const bProvince = cols[33]?.replace(/"/g, '').trim() || '';
        const bCity = cols[34]?.replace(/"/g, '').trim() || '';

        const sexStr = cols[26]?.replace(/"/g, '').trim();
        const sex: 'Male' | 'Female' = (sexStr?.toLowerCase().startsWith('f')) ? 'Female' : 'Male';
        
        const dob = cols[27]?.replace(/"/g, '').trim();
        const age = parseInt(cols[28]?.replace(/"/g, '').trim()) || 0;
        const civilStatus = cols[29]?.replace(/"/g, '').trim();
        const educationalAttainment = cols[30]?.replace(/"/g, '').trim();
        const nationality = cols[31]?.replace(/"/g, '').trim();
        const uli = cols[46]?.replace(/"/g, '').trim();

        if (lastName && firstName && uli) {
          studentData.push({
            id: `imported-${uli}-${Date.now()}-${i}`,
            orgId: 'temp',
            uli,
            lastName,
            firstName,
            middleName: middleName || '',
            extension: extension || '',
            sex,
            dateOfBirth: dob,
            age,
            birthRegion: bRegion,
            birthProvince: bProvince,
            birthCity: bCity,
            civilStatus: civilStatus || 'Single',
            educationalAttainment: educationalAttainment || '',
            nationality: nationality || 'Filipino',
            email,
            contactNumber: contact,
            street: street || '',
            barangay: barangay || '',
            city: city || '',
            district: district || '',
            province: province || '',
            guardian: '',
            documents: MANDATORY_DOCS.map((doc, dIdx) => ({
              id: `doc-${dIdx}-${Date.now()}-${i}`,
              name: doc,
              status: 'PENDING'
            })),
            createdAt: new Date().toISOString()
          });
        }
      }

      if (studentData.length > 0) {
        setImportPreview(studentData);
        setShowImportModal(true);
      } else {
        alert("No valid learner data found. Ensure you are using the MIS 03-02 CSV format.");
      }
    };
    reader.readAsText(file);
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const executeBatchImport = () => {
    onBatchAddStudents(importPreview);
    setShowImportModal(false);
    setImportPreview([]);
  };

  const calculateAge = (dob: string) => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age < 0 ? 0 : age;
  };

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dob = e.target.value;
    const age = calculateAge(dob);
    setFormData({ ...formData, dateOfBirth: dob, age });
  };

  const startCamera = async () => {
    setShowCamera(true);
    setPhotoPreview(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } } 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Camera access denied.");
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
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
        if (docName === 'Passport Size Photo') setPhotoPreview(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const documents: StudentDocument[] = MANDATORY_DOCS.map((doc, idx) => ({
      id: `doc-${idx}-${Date.now()}`,
      name: doc,
      status: mandatoryDocStatuses[doc],
      fileData: mandatoryDocFiles[doc]
    }));

    const newStudent: Student = {
      ...formData as Student,
      id: `stud-${Date.now()}`,
      orgId: 'temp',
      documents,
      createdAt: new Date().toISOString()
    };
    onAddStudent(newStudent);
    setShowModal(false);
    resetLocalState();
  };

  const resetLocalState = () => {
    setFormData({ 
      age: 0, 
      sex: 'Male', 
      civilStatus: 'Single', 
      nationality: 'Filipino',
      extension: '',
      middleName: '',
      street: '',
      barangay: '',
      city: '',
      district: '',
      province: '',
      birthRegion: '',
      birthProvince: '',
      birthCity: '',
      guardian: ''
    });
    setPhotoPreview(null);
    setMandatoryDocStatuses({
      'TOR (Transcript of Records)': 'PENDING',
      'Birth Certificate': 'PENDING',
      'Application Form': 'PENDING',
      'Passport Size Photo': 'PENDING'
    });
    setMandatoryDocFiles({});
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Learner Ledger</h2>
          <p className="text-sm text-slate-500 font-normal italic">Comprehensive TESDA MIS Registry (v3.0.2)</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="file" ref={csvInputRef} className="hidden" accept=".csv" onChange={handleCsvFileChange} />
          <button 
            onClick={() => csvInputRef.current?.click()}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all border border-slate-200 font-bold text-sm active:scale-95"
          >
            <FileSpreadsheet size={18} className="text-emerald-600" /> Batch MIS Upload
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold text-sm active:scale-95"
          >
            <Plus size={18} /> Register Learner
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-3xl border shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by ULI or Name..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors text-xs font-black uppercase tracking-widest">
          <Filter size={14} /> Filter Compliance
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Learner Identification</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Birth & Profile</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Permanent Address</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Docs</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStudents.length > 0 ? filteredStudents.map(student => (
              <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-indigo-50 flex items-center justify-center border border-indigo-100 shadow-sm shrink-0">
                      {student.documents.find(d => d.name === 'Passport Size Photo')?.fileData ? (
                        <img src={student.documents.find(d => d.name === 'Passport Size Photo')?.fileData} alt="Student" className="w-full h-full object-cover" />
                      ) : (
                        <UserCircle className="text-indigo-300" size={24} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-800 leading-tight">
                        {student.lastName.toUpperCase()}, {student.firstName} {student.extension}
                      </div>
                      <div className="text-[10px] font-mono font-bold text-indigo-600 mt-1">ULI: {student.uli}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex flex-col gap-1">
                     <div className="text-xs font-bold text-slate-700">{student.sex} • {student.age} yrs</div>
                     <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                        <Baby size={10} className="text-indigo-400" /> {student.birthCity || 'N/A'}, {student.birthProvince || 'N/A'}
                     </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-start gap-2">
                     <MapPin size={12} className="text-indigo-500 shrink-0 mt-0.5" />
                     <div className="min-w-0">
                        <p className="text-[10px] text-slate-600 font-bold leading-tight truncate">{student.city}, {student.province}</p>
                        <p className="text-[9px] text-slate-400 font-medium truncate uppercase tracking-tighter">{student.barangay}</p>
                     </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex gap-1">
                    {student.documents.slice(0, 4).map(doc => (
                      <div key={doc.id} title={`${doc.name}: ${doc.status}`} className={`w-3.5 h-1.5 rounded-full ${
                        doc.status === 'UPLOADED' || doc.status === 'VERIFIED' ? 'bg-indigo-500 shadow-sm shadow-indigo-100' : 'bg-slate-200'
                      }`} />
                    ))}
                  </div>
                </td>
                <td className="px-6 py-5 text-right">
                  {confirmDelete === student.id ? (
                    <div className="flex items-center justify-end gap-2 animate-in fade-in slide-in-from-right-2">
                       <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">Cancel</button>
                       <button onClick={() => { onDeleteStudent(student.id); setConfirmDelete(null); }} className="px-3 py-1 text-[10px] font-bold uppercase text-white bg-rose-600 rounded-lg">Delete</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(student.id)} className="p-2 hover:bg-rose-50 text-slate-300 hover:text-rose-600 rounded-xl transition-all">
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="py-24 text-center text-slate-400 italic">No registered learners found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[90] overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in duration-300 border border-slate-200 my-8">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-200"><FileSpreadsheet size={24} /></div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Review Batch Import (MIS 03-02)</h3>
                    <p className="text-sm text-slate-500 font-medium">Extracted <span className="text-emerald-600 font-bold">{importPreview.length}</span> learner profiles from the file.</p>
                  </div>
               </div>
               <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={28} /></button>
            </div>
            
            <div className="p-8 max-h-[60vh] overflow-y-auto bg-slate-50/30">
               <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       <th className="px-4 pb-2 text-left">Learner Name</th>
                       <th className="px-4 pb-2 text-left">Identification</th>
                       <th className="px-4 pb-2 text-left">Birth Place</th>
                       <th className="px-4 pb-2 text-left">Residency (V-Z)</th>
                       <th className="px-4 pb-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((s, idx) => {
                      const isDuplicate = students.some(existing => existing.uli === s.uli);
                      return (
                        <tr key={idx} className="bg-white group">
                           <td className="px-6 py-4 rounded-l-2xl border-y border-l border-slate-100">
                             <div className="text-sm font-bold text-slate-800">{s.lastName}, {s.firstName} {s.extension}</div>
                             <div className="text-[10px] text-slate-400 font-medium">{s.dateOfBirth} • {s.age} yrs</div>
                           </td>
                           <td className="px-6 py-4 border-y border-slate-100">
                             <div className="font-mono text-xs font-bold text-indigo-600">{s.uli}</div>
                             <div className="text-[10px] text-slate-400 font-medium">{s.nationality}</div>
                           </td>
                           <td className="px-6 py-4 border-y border-slate-100">
                             <div className="text-[10px] text-slate-600 font-bold">{s.birthCity}</div>
                             <div className="text-[9px] text-slate-400 uppercase font-black">{s.birthProvince}</div>
                           </td>
                           <td className="px-6 py-4 border-y border-slate-100">
                             <p className="text-[10px] text-slate-700 font-bold">{s.city}, {s.province}</p>
                             <p className="text-[9px] text-slate-400 uppercase tracking-tighter">{s.barangay}</p>
                           </td>
                           <td className="px-6 py-4 border-y border-r border-slate-100 rounded-r-2xl text-center">
                             {isDuplicate ? (
                               <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100 text-[10px] font-black uppercase">
                                  <AlertTriangle size={12} /> Exists
                               </div>
                             ) : (
                               <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 text-[10px] font-black uppercase">
                                  <CheckCircle2 size={12} /> Ready
                               </div>
                             )}
                           </td>
                        </tr>
                      );
                    })}
                  </tbody>
               </table>
            </div>

            <div className="p-10 bg-white border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
               <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl max-w-lg">
                  <ShieldCheck size={24} className="text-blue-600 shrink-0" />
                  <p className="text-[11px] text-blue-900 leading-relaxed font-medium">
                    Importing these records will populate the Registry and automatically create individual compliance folders for each learner. Birthplace data from the MIS 03-02 file will be mapped to each profile.
                  </p>
               </div>
               <div className="flex gap-4 w-full md:w-auto">
                  <button onClick={() => setShowImportModal(false)} className="flex-1 px-8 py-4 text-sm font-black text-slate-500 hover:bg-slate-100 rounded-2xl transition-all">Discard</button>
                  <button onClick={executeBatchImport} className="flex-1 px-12 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black shadow-2xl shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-3">
                    Batch Enroll <ArrowRight size={20} />
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8 flex flex-col md:flex-row h-full max-h-[95vh]">
            <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100"><User size={20} /></div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Manual Registry Entry</h3>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-10 pb-10">
                {/* Personal Information Section */}
                <section>
                   <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"><Fingerprint size={16} /></div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Personal Identification</h4>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Last Name</label>
                      <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                    </div>
                    <div className="md:col-span-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">First Name</label>
                      <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                    </div>
                    <div className="md:col-span-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Middle Name</label>
                      <input className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800" value={formData.middleName} onChange={e => setFormData({...formData, middleName: e.target.value})} />
                    </div>
                    <div className="md:col-span-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Extension</label>
                      <input placeholder="Jr / III" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800" value={formData.extension} onChange={e => setFormData({...formData, extension: e.target.value})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex justify-between">
                           Birth Date <span className="text-slate-300 font-normal italic lowercase">(mm-dd-yy)</span>
                        </label>
                        <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800" value={formData.dateOfBirth} onChange={handleDobChange} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Sex</label>
                        <select className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800" value={formData.sex} onChange={e => setFormData({...formData, sex: e.target.value as any})}>
                           <option value="Male">Male</option>
                           <option value="Female">Female</option>
                        </select>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Civil Status</label>
                        <select className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800" value={formData.civilStatus} onChange={e => setFormData({...formData, civilStatus: e.target.value})}>
                           <option value="Single">Single</option>
                           <option value="Married">Married</option>
                           <option value="Widowed">Widowed</option>
                           <option value="Separated">Separated</option>
                        </select>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nationality</label>
                        <input className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800" value={formData.nationality} onChange={e => setFormData({...formData, nationality: e.target.value})} />
                     </div>
                  </div>

                  {/* Birth Info Section */}
                  <div className="mt-8 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                     <div className="flex items-center gap-2 mb-4">
                        <Baby size={16} className="text-indigo-600" />
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Place of Birth (MIS Requirements)</h4>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                           <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Birth Region</label>
                           <input placeholder="e.g. Region IV-A" className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-600 outline-none text-xs font-bold" value={formData.birthRegion} onChange={e => setFormData({...formData, birthRegion: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Birth Province</label>
                           <input placeholder="e.g. Batangas" className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-600 outline-none text-xs font-bold" value={formData.birthProvince} onChange={e => setFormData({...formData, birthProvince: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Birth City/Municipality</label>
                           <input placeholder="e.g. Lipa City" className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-600 outline-none text-xs font-bold" value={formData.birthCity} onChange={e => setFormData({...formData, birthCity: e.target.value})} />
                        </div>
                     </div>
                  </div>
                </section>

                {/* Educational Attainment Section */}
                <section>
                   <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"><GraduationCap size={16} /></div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Education & Compliance</h4>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Highest Educational Attainment</label>
                        <input placeholder="e.g. High School Graduate" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800" value={formData.educationalAttainment} onChange={e => setFormData({...formData, educationalAttainment: e.target.value})} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">TESDA ULI Reference</label>
                        <input placeholder="24-703-xxx-xxxxx" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-mono font-black text-indigo-600 uppercase" value={formData.uli} onChange={e => setFormData({...formData, uli: e.target.value})} />
                     </div>
                   </div>
                </section>

                {/* Granular Address Section */}
                <section>
                   <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"><Globe size={16} /></div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Residency & Mailing (MIS 03-02 Table)</h4>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Contact Number</label>
                            <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800" value={formData.contactNumber} onChange={e => setFormData({...formData, contactNumber: e.target.value})} />
                         </div>
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Email Address</label>
                            <input type="email" required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                         </div>
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Emergency Contact / Guardian</label>
                            <input className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800" value={formData.guardian} onChange={e => setFormData({...formData, guardian: e.target.value})} />
                         </div>
                      </div>

                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                         <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Building2 size={12}/> Complete Permanent Address</div>
                         <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2 space-y-1">
                               <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Street / House No.</label>
                               <input className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold" value={formData.street} onChange={e => setFormData({...formData, street: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                               <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Barangay</label>
                               <input className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold" value={formData.barangay} onChange={e => setFormData({...formData, barangay: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                               <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">City/Municipality</label>
                               <input className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                               <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">District</label>
                               <input className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold" value={formData.district} onChange={e => setFormData({...formData, district: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                               <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Province</label>
                               <input className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold" value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})} />
                            </div>
                         </div>
                      </div>
                   </div>
                </section>

                <div className="pt-4">
                  <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-3xl text-sm font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">Commit Registry Entry</button>
                </div>
              </form>
            </div>

            <div className="w-full md:w-[450px] bg-slate-50 overflow-y-auto p-8 flex flex-col border-l border-slate-100">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <FileText size={16} className="text-indigo-600" /> Compliance Folder
              </h4>

              <div className="space-y-4 flex-1">
                {MANDATORY_DOCS.map(doc => {
                  const status = mandatoryDocStatuses[doc];
                  const hasFile = status === 'UPLOADED' || status === 'VERIFIED';
                  
                  return (
                    <div key={doc} className={`p-4 rounded-3xl border transition-all ${hasFile ? 'bg-white border-indigo-100 shadow-sm' : 'bg-slate-100/50 border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 overflow-hidden">
                          {hasFile ? <CheckCircle size={18} className="text-emerald-500 shrink-0" /> : <Clock size={18} className="text-slate-300 shrink-0" />}
                          <span className={`text-[11px] font-black uppercase tracking-tight truncate ${hasFile ? 'text-slate-800' : 'text-slate-400'}`}>{doc}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {doc === 'Passport Size Photo' && (
                          <button onClick={startCamera} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase text-slate-600 hover:border-indigo-600 transition-colors">
                            <Camera size={14} /> Capture
                          </button>
                        )}
                        <button onClick={() => triggerFileInput(doc)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase text-slate-600 hover:border-indigo-600 transition-colors`}>
                          <Upload size={14} /> {hasFile ? 'Replace' : 'Attach'}
                        </button>
                      </div>
                      
                      <input 
                        type="file" 
                        className="hidden" 
                        ref={el => { if (el) fileInputRefs.current[doc] = el; }} 
                        onChange={(e) => handleDocumentUpload(doc, e)}
                        accept={doc === 'Passport Size Photo' ? "image/*" : ".pdf,.jpg,.jpeg,.png"}
                      />
                    </div>
                  );
                })}

                {photoPreview && (
                  <div className="relative w-full aspect-square rounded-3xl overflow-hidden border-2 border-indigo-600 shadow-2xl animate-in fade-in zoom-in duration-300">
                    <img src={photoPreview} className="w-full h-full object-cover" alt="Passport Preview" />
                    <div className="absolute top-2 right-2 flex gap-1">
                       <button onClick={() => { setPhotoPreview(null); setMandatoryDocStatuses(p => ({...p, 'Passport Size Photo': 'PENDING'})); }} className="p-2 bg-black/50 text-white rounded-xl hover:bg-black/70"><X size={16} /></button>
                    </div>
                  </div>
                )}
              </div>

              {showCamera && (
                <div className="fixed inset-0 bg-slate-900/95 flex flex-col items-center justify-center z-[100] p-4 backdrop-blur-md">
                  <div className="relative w-full max-w-sm aspect-square bg-slate-800 rounded-[3rem] overflow-hidden border-4 border-white shadow-2xl">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                       <div className="w-3/4 h-3/4 border-2 border-dashed border-white/50 rounded-full" />
                    </div>
                  </div>
                  <div className="mt-12 flex items-center gap-8">
                    <button onClick={stopCamera} className="w-16 h-16 flex items-center justify-center bg-white/10 text-white rounded-full hover:bg-white/20 transition-all"><X size={28} /></button>
                    <button onClick={capturePhoto} className="w-24 h-24 flex items-center justify-center bg-white text-slate-900 rounded-full hover:scale-110 active:scale-90 transition-all shadow-2xl ring-8 ring-white/10"><Camera size={40} /></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentsView;
