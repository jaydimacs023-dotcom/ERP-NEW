
/**
 * AccounTech ERP Configuration
 * Robust environment detection to handle Vite, Node, and browser-only contexts.
 * Supports Runtime Overrides for instant switching between Mock and Cloud.
 */

const getEnv = () => {
  const meta = import.meta as any;
  if (meta && meta.env) return meta.env;
  if (typeof process !== 'undefined' && process.env) return process.env;
  return {};
};

const env = getEnv();

// Check for runtime override in browser
const getRuntimeOverride = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem('AT_ERP_DATA_SOURCE'); // 'MOCK' | 'CLOUD'
  }
  return null;
};

const runtimeOverride = getRuntimeOverride();
const isProduction = (env.MODE || env.NODE_ENV) === 'production';

export const config = {
  mode: env.MODE || env.NODE_ENV || 'development',
  isDev: (env.MODE || env.NODE_ENV || 'development') === 'development',
  isProd: isProduction,
  
  /**
   * Logic for Data Source Selection:
   * 1. Check Runtime Override (localStorage)
   * 2. Check Force Flag (env variable)
   * 3. Default to Mock in Dev, Cloud in Prod
   */
  useMockData: runtimeOverride 
    ? runtimeOverride === 'MOCK' 
    : isProduction 
      ? false 
      : env.VITE_FORCE_SUPABASE !== 'true',
    
  supabase: {
    url: env.VITE_SUPABASE_URL || '',
    anonKey: env.VITE_SUPABASE_ANON_KEY || '',
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

console.log(`%c[ERP System] Data Strategy: ${config.useMockData ? 'MOCK_LOCAL' : 'SUPABASE_CLOUD'}`, 
  `color: white; background: ${config.useMockData ? '#4f46e5' : '#059669'}; padding: 2px 8px; border-radius: 4px; font-weight: bold;`);
