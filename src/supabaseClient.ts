// Fix: Manually define Vite's `import.meta.env` types
declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
  }
}

import { createClient } from '@supabase/supabase-js';

// Load variables from Vite's environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be provided in the environment variables.");
}

// Custom fetch wrapper with timeout
const fetchWithTimeout = (url: string, options: any = {}, timeoutMs: number = 15000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    console.warn(`Request to ${url} timed out after ${timeoutMs}ms`);
    controller.abort();
  }, timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  })
    .then((response) => {
      clearTimeout(timeout);
      return response;
    })
    .catch((error) => {
      clearTimeout(timeout);
      throw error;
    });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // More secure
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js/2.0',
    },
    fetch: fetchWithTimeout, // Apply timeout to all requests
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
