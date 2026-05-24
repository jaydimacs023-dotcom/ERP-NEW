import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Mail, MapPin, Phone, Save, User as UserIcon, X } from 'lucide-react';
import { User } from '../types';

interface UserProfileViewProps {
  currentUser: User;
  brandColor?: string;
  onUpdateProfile: (updates: Partial<User>) => Promise<void> | void;
}

const UserProfileView: React.FC<UserProfileViewProps> = ({
  currentUser,
  brandColor = '#059669',
  onUpdateProfile
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    name: currentUser.name || '',
    lastName: currentUser.lastName || '',
    email: currentUser.email || '',
    contactNumber: currentUser.contactNumber || '',
    address: currentUser.address || '',
    profilePhoto: currentUser.profilePhoto || ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: currentUser.name || '',
      lastName: currentUser.lastName || '',
      email: currentUser.email || '',
      contactNumber: currentUser.contactNumber || '',
      address: currentUser.address || '',
      profilePhoto: currentUser.profilePhoto || ''
    });
  }, [currentUser]);

  const initials = useMemo(() => {
    const first = form.name.trim().charAt(0);
    const last = form.lastName.trim().charAt(0);
    return `${first}${last || form.name.trim().charAt(1) || ''}`.toUpperCase() || 'U';
  }, [form.name, form.lastName]);

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({ ...prev, profilePhoto: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateProfile({
        name: form.name.trim(),
        lastName: form.lastName.trim() || undefined,
        email: form.email.trim(),
        contactNumber: form.contactNumber.trim() || undefined,
        address: form.address.trim() || undefined,
        profilePhoto: form.profilePhoto || undefined
      });
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = 'mt-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-emerald-500';
  const labelClass = 'text-xs font-bold uppercase tracking-wide text-slate-500';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">User Profile</h2>
        <p className="text-sm italic text-slate-500">Update your personal profile details.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div
              className="relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-full text-3xl font-black text-white shadow-sm"
              style={{ backgroundColor: brandColor }}
            >
              {form.profilePhoto ? (
                <img src={form.profilePhoto} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                title="Change photo"
              >
                <Camera size={16} />
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
            {form.profilePhoto && (
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, profilePhoto: '' }))}
                className="mt-4 inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                <X size={14} /> Remove Photo
              </button>
            )}

            <div className="mt-5 w-full rounded-md border border-slate-100 bg-slate-50 p-4 text-left">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Role</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{currentUser.role.replace(/_/g, ' ')}</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label>
              <span className={labelClass}>First Name</span>
              <div className="relative">
                <UserIcon size={15} className="pointer-events-none absolute left-3 top-[17px] text-slate-400" />
                <input className={`${inputClass} pl-9`} value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
              </div>
            </label>

            <label>
              <span className={labelClass}>Last Name</span>
              <input className={inputClass} value={form.lastName} onChange={e => setForm(prev => ({ ...prev, lastName: e.target.value }))} />
            </label>

            <label>
              <span className={labelClass}>Email</span>
              <div className="relative">
                <Mail size={15} className="pointer-events-none absolute left-3 top-[17px] text-slate-400" />
                <input className={`${inputClass} pl-9`} value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} />
              </div>
            </label>

            <label>
              <span className={labelClass}>Contact Number</span>
              <div className="relative">
                <Phone size={15} className="pointer-events-none absolute left-3 top-[17px] text-slate-400" />
                <input className={`${inputClass} pl-9`} value={form.contactNumber} onChange={e => setForm(prev => ({ ...prev, contactNumber: e.target.value }))} />
              </div>
            </label>

            <label className="md:col-span-2">
              <span className={labelClass}>Address</span>
              <div className="relative">
                <MapPin size={15} className="pointer-events-none absolute left-3 top-4 text-slate-400" />
                <textarea
                  className="mt-1 min-h-28 w-full resize-y rounded-md border border-slate-200 bg-white px-9 py-3 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-emerald-500"
                  value={form.address}
                  onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>
            </label>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex h-10 items-center gap-2 rounded-md px-5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: brandColor }}
            >
              <Save size={16} /> {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default UserProfileView;
