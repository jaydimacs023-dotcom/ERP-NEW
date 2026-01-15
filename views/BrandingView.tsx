import React, { useState, useRef } from 'react';
import { Palette, ShieldCheck, Check, Sparkles, Image as ImageIcon, Building2, Upload, X, Trash2, Maximize2 } from 'lucide-react';
import { Organization } from '../types';

interface BrandingViewProps {
  organization: Organization;
  onUpdate: (org: Organization) => void;
}

const PALETTES = [
  { name: 'Royal Indigo', color: '#4f46e5', desc: 'Default Professional' },
  { name: 'Accounting Rose', color: '#e11d48', desc: 'Financial Clarity' },
  { name: 'Midnight Slate', color: '#0f172a', desc: 'Serious & Robust' },
  { name: 'Forest Emerald', color: '#059669', desc: 'Growth & Prosperity' },
  { name: 'Academic Maroon', color: '#991b1b', desc: 'Institutional Heritage' },
  { name: 'Vibrant Violet', color: '#7c3aed', desc: 'Innovative & Modern' },
  { name: 'Oceanic Blue', color: '#0284c7', desc: 'Trust & Reliability' },
  { name: 'Golden Amber', color: '#d97706', desc: 'Warm & Strategic' },
];

const BrandingView: React.FC<BrandingViewProps> = ({ organization, onUpdate }) => {
  const [selectedColor, setSelectedColor] = useState(organization.primaryColor || '#4f46e5');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleColorSelect = (hex: string) => {
    setSelectedColor(hex);
    onUpdate({ ...organization, primaryColor: hex });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Logo file is too large. Maximum size is 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      onUpdate({ ...organization, logoUrl: base64String });
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    onUpdate({ ...organization, logoUrl: undefined });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-brand-light text-brand rounded-lg shadow-sm">
            <Palette size={24} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Identity & Motif</h1>
        </div>
        <p className="text-slate-500 font-medium italic">Customize the system appearance to align with your institutional brand identity.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Motif Selection */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b bg-slate-50/50 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <Sparkles size={20} className="text-brand" />
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Primary Palette</h3>
             </div>
             <div className="w-8 h-8 rounded-full shadow-inner border-2 border-white" style={{ backgroundColor: selectedColor }} />
          </div>
          
          <div className="p-8 grid grid-cols-2 gap-4">
            {PALETTES.map(p => (
              <button 
                key={p.color}
                onClick={() => handleColorSelect(p.color)}
                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left group ${
                  selectedColor === p.color ? 'border-brand ring-2 ring-brand-light ring-offset-2' : 'border-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="w-10 h-10 rounded-xl shadow-sm border border-black/5 shrink-0 flex items-center justify-center text-white" style={{ backgroundColor: p.color }}>
                   {selectedColor === p.color && <Check size={18} strokeWidth={4} />}
                </div>
                <div>
                   <p className="text-xs font-black text-slate-800 leading-none mb-1">{p.name}</p>
                   <p className="text-[10px] text-slate-400 font-medium">{p.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-auto p-8 bg-slate-50/50 border-t border-slate-100">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400">
                  <ShieldCheck size={18} />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-bold">
                  Selecting a motif will automatically skin all dashboards, buttons, and interaction states for all authorized users in this organization.
                </p>
             </div>
          </div>
        </div>

        {/* Logo & Messaging */}
        <div className="space-y-8">
           <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b bg-slate-50/50 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <ImageIcon size={20} className="text-brand" />
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Brand Assets</h3>
                 </div>
                 {organization.logoUrl && (
                   <button 
                    onClick={removeLogo}
                    className="flex items-center gap-1.5 text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-600 transition-colors"
                   >
                     <Trash2 size={12} /> Remove
                   </button>
                 )}
              </div>
              <div className="p-8">
                 <input 
                   type="file" 
                   ref={fileInputRef} 
                   className="hidden" 
                   accept="image/png, image/jpeg, image/svg+xml"
                   onChange={handleLogoUpload}
                 />
                 
                 {organization.logoUrl ? (
                   <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="relative border-2 border-brand-light rounded-[2rem] p-12 flex flex-col items-center justify-center text-center group cursor-pointer overflow-hidden"
                   >
                      <img src={organization.logoUrl} alt="Org Logo" className="max-h-24 max-w-full object-contain relative z-10 transition-transform group-hover:scale-105" />
                      <div className="absolute inset-0 bg-brand/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <span className="bg-white px-4 py-2 rounded-full text-brand text-[10px] font-black uppercase tracking-widest shadow-xl">Change Image</span>
                      </div>
                   </div>
                 ) : (
                   <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center group hover:border-brand transition-all cursor-pointer bg-slate-50/30 hover:bg-white"
                   >
                      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-brand-light group-hover:text-brand transition-all mb-4">
                         <Upload size={24} />
                      </div>
                      <p className="text-sm font-black text-slate-800">Institutional Logo</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">SVG, PNG or JPG (Max 5MB). Recommended 512x512px.</p>
                   </div>
                 )}
              </div>
           </div>

           <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
                 <Building2 size={120} />
              </div>
              <div className="relative z-10">
                 <div className="flex justify-between items-center mb-6">
                    <h4 className="text-[10px] font-black text-brand uppercase tracking-[0.3em]">Live Preview</h4>
                    <div className="flex items-center gap-2 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                       <Maximize2 size={10} /> Physical Scale: 1" Circular
                    </div>
                 </div>
                 <div className="space-y-6">
                    <div className="flex items-center gap-6">
                       <div className="w-[1in] h-[1in] rounded-full border-4 border-brand bg-white flex items-center justify-center shadow-2xl shadow-brand/20 text-indigo-600 overflow-hidden shrink-0">
                          {organization.logoUrl ? (
                            <img src={organization.logoUrl} className="w-full h-full object-cover" alt="Preview" />
                          ) : (
                            <Building2 size={40} />
                          )}
                       </div>
                       <div className="flex-1">
                          <p className="text-sm font-black uppercase tracking-tight">Primary Sidebar</p>
                          <div className="mt-2 h-1 w-full bg-brand/30 rounded-full overflow-hidden">
                             <div className="h-full bg-brand w-3/4"></div>
                          </div>
                          <div className="mt-2 h-1 w-1/2 bg-slate-700 rounded-full"></div>
                       </div>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                       <p className="text-[10px] italic opacity-60 leading-relaxed font-medium">
                         "The institutional logo is rendered as a prominent circular medallion, ensuring consistency across the workspace navigation."
                       </p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default BrandingView;