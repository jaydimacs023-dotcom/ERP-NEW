import React, { useEffect, useState } from 'react';
import { Type } from 'lucide-react';

export type FontScaleMode = 'auto' | 'compact' | 'standard' | 'comfortable' | 'large';

const STORAGE_KEY = 'at_erp_font_scale_mode';
const MODE_CHANGE_EVENT = 'at-erp-font-scale-change';

const MODE_SCALE: Record<Exclude<FontScaleMode, 'auto'>, number> = {
  compact: 0.96,
  standard: 1,
  comfortable: 1.08,
  large: 1.16
};

const isFontScaleMode = (value: string | null): value is FontScaleMode => {
  return value === 'auto' || value === 'compact' || value === 'standard' || value === 'comfortable' || value === 'large';
};

export const readStoredFontScaleMode = (): FontScaleMode => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isFontScaleMode(stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
};

export const applyFontScaleMode = (mode: FontScaleMode) => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.dataset.fontScaleMode = mode;

  if (mode === 'auto') {
    root.style.removeProperty('--app-font-scale');
    return;
  }

  root.style.setProperty('--app-font-scale', String(MODE_SCALE[mode]));
};

export const persistFontScaleMode = (mode: FontScaleMode) => {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures and keep the runtime scale active.
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(MODE_CHANGE_EVENT));
  }
};

export function FontScaleBootstrap() {
  useEffect(() => {
    applyFontScaleMode(readStoredFontScaleMode());

    const syncFromStorage = () => applyFontScaleMode(readStoredFontScaleMode());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) syncFromStorage();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(MODE_CHANGE_EVENT, syncFromStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(MODE_CHANGE_EVENT, syncFromStorage);
    };
  }, []);

  return null;
}

export default function FontScalePicker() {
  const [mode, setMode] = useState<FontScaleMode>(() => readStoredFontScaleMode());

  useEffect(() => {
    const syncFromStorage = () => setMode(readStoredFontScaleMode());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) syncFromStorage();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(MODE_CHANGE_EVENT, syncFromStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(MODE_CHANGE_EVENT, syncFromStorage);
    };
  }, []);

  const handleChange = (nextMode: FontScaleMode) => {
    setMode(nextMode);
    persistFontScaleMode(nextMode);
    applyFontScaleMode(nextMode);
  };

  return (
    <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <Type size={14} className="shrink-0 text-slate-400" />
      <span className="hidden lg:inline text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
        Text Size
      </span>
      <select
        aria-label="Interface text size"
        title="Auto follows your screen size. Comfortable is tuned for 16-inch wide screens."
        value={mode}
        onChange={e => handleChange(e.target.value as FontScaleMode)}
        className="min-w-[10rem] rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
      >
        <option value="auto">Auto</option>
        <option value="compact">Compact</option>
        <option value="standard">Standard</option>
        <option value="comfortable">Comfortable</option>
        <option value="large">Large</option>
      </select>
    </div>
  );
}
