
/**
 * AccounTech ERP Configuration
 * Robust environment detection to handle Vite, Node, and browser-only contexts.
 * Supports Runtime Overrides for instant switching between Mock and Cloud.
 */

// Vite automatically exposes VITE_* env vars via import.meta.env
const env = import.meta.env;

console.debug('[Config] Vite import.meta.env:', {
  keys: Object.keys(env).filter(k => k.startsWith('VITE_')),
  VITE_SUPABASE_URL: env.VITE_SUPABASE_URL?.substring(0, 40) || 'MISSING',
  VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY ? 'PRESENT' : 'MISSING',
  VITE_FORCE_SUPABASE: env.VITE_FORCE_SUPABASE
});

// Check for runtime override in browser
const getRuntimeOverride = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem('AT_ERP_DATA_SOURCE'); // 'MOCK' | 'CLOUD'
  }
  return null;
};

const runtimeOverride = getRuntimeOverride();
const isProduction = (env.MODE || env.NODE_ENV) === 'production';

const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || '';
const hasSupabaseCreds = supabaseUrl.length > 0 && supabaseKey.length > 0;

export const config = {
  mode: env.MODE || env.NODE_ENV || 'development',
  isDev: (env.MODE || env.NODE_ENV || 'development') === 'development',
  isProd: isProduction,
  
  /**
   * Logic for Data Source Selection:
   * 1. FORCE Mock if credentials are missing (Safety Fallback)
   * 2. Check Runtime Override (localStorage)
   * 3. Check Force Flag (env variable)
   * 4. Default to Mock in Dev, Cloud in Prod
   */
  useMockData: !hasSupabaseCreds 
    ? true 
    : (runtimeOverride 
        ? runtimeOverride === 'MOCK' 
        : isProduction 
          ? false 
          : env.VITE_FORCE_SUPABASE !== 'true'),
    
  supabase: {
    url: supabaseUrl,
    anonKey: supabaseKey,
  },

  // Helper to trigger a switch
  switchDataSource: (source: 'MOCK' | 'CLOUD') => {
    localStorage.setItem('AT_ERP_DATA_SOURCE', source);
    window.location.reload();
  },

  clearOverride: () => {
    localStorage.removeItem('AT_ERP_DATA_SOURCE');
    window.location.reload();
  }
};

if (!hasSupabaseCreds && runtimeOverride === 'CLOUD') {
  console.warn("[ERP System] Cloud Mode was requested but credentials are missing. Falling back to MOCK_LOCAL.");
}

console.log(`%c[ERP System] Data Strategy: ${config.useMockData ? 'MOCK_LOCAL' : 'SUPABASE_CLOUD'}`, 
  `color: white; background: ${config.useMockData ? '#4f46e5' : '#059669'}; padding: 2px 8px; border-radius: 4px; font-weight: bold;`);
