
/**
 * AccounTech ERP Configuration
 * Robust environment detection to handle Vite, Node, and browser-only contexts.
 * Supports Runtime Overrides for instant switching between Mock and Cloud.
 */

// Vite automatically exposes VITE_* env vars via import.meta.env
const env = import.meta.env;

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
const appEnv = (env.VITE_APP_ENV || '').toLowerCase();
const isLocalAppEnv = appEnv === 'local' || supabaseUrl.startsWith('http://127.0.0.1:54321');
const pointsToHostedSupabase = /^https:\/\/[^/]+\.supabase\.co\/?$/i.test(supabaseUrl);
const enableDebug = env.VITE_ENABLE_DEBUG === 'true' || env.DEV;

if (enableDebug) {
  console.info('[Config] Active Supabase runtime config:', {
    mode: env.MODE || env.NODE_ENV || 'development',
    VITE_APP_ENV: env.VITE_APP_ENV || 'MISSING',
    VITE_SUPABASE_URL: supabaseUrl || 'MISSING',
    VITE_SUPABASE_ANON_KEY: supabaseKey || 'MISSING',
    isLocalSupabase: supabaseUrl.startsWith('http://127.0.0.1:54321'),
    loadedViteKeys: Object.keys(env).filter(k => k.startsWith('VITE_')),
  });
}

if (isLocalAppEnv && pointsToHostedSupabase) {
  throw new Error(
    `[Config] Refusing to start: VITE_APP_ENV is local but VITE_SUPABASE_URL points to hosted Supabase (${supabaseUrl}).`
  );
}

export const config = {
  mode: env.MODE || env.NODE_ENV || 'development',
  isDev: (env.MODE || env.NODE_ENV || 'development') === 'development',
  isProv: isProduction,
  
  /**
   * SUPABASE-ONLY MODE
   * All data is fetched from Supabase REST API
   * Empty tables show "No data available" fallback
   * No mock data fallback
   */
  useMockData: false,
    
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

console.log(`%c[ERP System] Data Strategy: ${config.useMockData ? 'MOCK_LOCAL' : 'SUPABASE_LOCAL_OR_CONFIGURED'}`,
  `color: white; background: ${config.useMockData ? '#4f46e5' : '#059669'}; padding: 2px 8px; border-radius: 4px; font-weight: bold;`);
