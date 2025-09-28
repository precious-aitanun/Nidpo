// Fix: Manually define Vite's `import.meta.env` types to resolve TypeScript errors
// when the triple-slash directive `/// <reference types="vite/client" />` fails.
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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
