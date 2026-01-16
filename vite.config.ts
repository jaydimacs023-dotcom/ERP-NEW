
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all envs regardless of the `VITE_` prefix.
  // Fix: Cast process to any to access the cwd() method in environments where Node.js types are not correctly loaded
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Expose custom env variables if needed
      __APP_ENV__: JSON.stringify(env.APP_ENV),
    },
  };
});
