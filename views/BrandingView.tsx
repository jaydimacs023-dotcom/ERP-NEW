import React, { useRef, useState } from 'react';
import { Building2, Check, Trash2, Upload } from 'lucide-react';
import { Organization } from '../types';

interface BrandingViewProps {
  organization: Organization;
  onUpdate: (org: Organization) => void;
}

const PALETTES = [
  { name: 'Endonela Teal', color: '#0d9488', desc: 'Official brand motif' },
  { name: 'Royal Indigo', color: '#4f46e5', desc: 'Professional default' },
  { name: 'Accounting Rose', color: '#e11d48', desc: 'Financial clarity' },
  { name: 'Midnight Slate', color: '#0f172a', desc: 'Formal and steady' },
  { name: 'Neutral Gray', color: '#4b5563', desc: 'Minimal and balanced' },
  { name: 'Forest Emerald', color: '#059669', desc: 'Growth and trust' },
  { name: 'Academic Maroon', color: '#991b1b', desc: 'Institutional heritage' },
  { name: 'Vibrant Violet', color: '#7c3aed', desc: 'Modern accent' },
  { name: 'Oceanic Blue', color: '#0284c7', desc: 'Reliable and clear' },
  { name: 'Golden Amber', color: '#d97706', desc: 'Warm emphasis' },
];

const BrandingView: React.FC<BrandingViewProps> = ({ organization, onUpdate }) => {
  const [selectedColor, setSelectedColor] = useState(organization.primaryColor || '#0d9488');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedPalette = PALETTES.find(palette => palette.color === selectedColor);

  const handleColorSelect = (hex: string) => {
    setSelectedColor(hex);
    onUpdate({ ...organization, primaryColor: hex });
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Logo file is too large. Maximum size is 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      onUpdate({ ...organization, logoUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    onUpdate({ ...organization, logoUrl: undefined });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-full space-y-6 pb-20">
      <header className="border-b border-gray-200 pb-5">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900">Branding & Motif</h2>
        <p className="mt-1 text-sm italic text-gray-500">Set the organization logo and primary interface color.</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Primary Color</h3>
                <p className="mt-1 text-xs text-gray-500">Used for active navigation, buttons, and selected states.</p>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-gray-200 px-2.5 py-2">
                <span className="h-5 w-5 rounded-sm border border-black/10" style={{ backgroundColor: selectedColor }} />
                <span className="font-mono text-xs text-gray-600">{selectedColor.toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div className="p-6">
              <div className="grid grid-cols-1 gap-2">
                {PALETTES.map(palette => {
                  const active = selectedColor === palette.color;
                  return (
                    <button
                      key={palette.color}
                      type="button"
                      onClick={() => handleColorSelect(palette.color)}
                      className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
                        active ? 'border-gray-900 bg-gray-50' : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="h-7 w-7 shrink-0 rounded-sm border border-black/10" style={{ backgroundColor: palette.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">{palette.name}</span>
                        <span className="block truncate text-xs text-gray-500">{palette.desc}</span>
                      </span>
                      {active && <Check size={16} className="text-gray-900" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Logo</h3>
                  <p className="mt-1 text-xs text-gray-500">SVG, PNG, or JPG. Maximum 5MB.</p>
                </div>
                {organization.logoUrl && (
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={13} />
                    Remove
                  </button>
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/png, image/jpeg, image/svg+xml"
                onChange={handleLogoUpload}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-5 flex min-h-48 w-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white px-6 py-8 text-center transition-colors hover:border-gray-400 hover:bg-gray-50"
              >
                {organization.logoUrl ? (
                  <>
                    <img src={organization.logoUrl} alt="Organization logo" className="max-h-24 max-w-full object-contain" />
                    <span className="mt-4 text-xs font-medium text-gray-500">Click to replace</span>
                  </>
                ) : (
                  <>
                    <Upload size={22} className="text-gray-400" />
                    <span className="mt-3 text-sm font-medium text-gray-900">Upload logo</span>
                    <span className="mt-1 text-xs text-gray-500">Recommended square image</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        <aside className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Preview</h3>
            <span className="text-xs text-gray-500">{selectedPalette?.name || 'Custom'}</span>
          </div>

          <div className="mt-6 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border bg-white" style={{ borderColor: selectedColor }}>
                {organization.logoUrl ? (
                  <img src={organization.logoUrl} className="h-full w-full object-cover" alt="Preview" />
                ) : (
                  <Building2 size={22} style={{ color: selectedColor }} />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{organization.name}</p>
                <p className="text-xs text-gray-500">Workspace identity</p>
              </div>
            </div>

            <div className="space-y-3 p-4">
              <div className="h-2 rounded-full bg-gray-100">
                <div className="h-full w-2/3 rounded-full" style={{ backgroundColor: selectedColor }} />
              </div>
              <div className="h-2 w-1/2 rounded-full bg-gray-100" />
              <button
                type="button"
                className="mt-2 h-9 w-full rounded-md text-sm font-medium text-white"
                style={{ backgroundColor: selectedColor }}
              >
                Primary Action
              </button>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-gray-500">
            Changes apply across navigation, buttons, highlights, and selected states for this organization.
          </p>
        </aside>
      </div>
    </div>
  );
};

export default BrandingView;
