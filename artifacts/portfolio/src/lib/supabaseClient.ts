import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must both be set " +
      "(Vite env vars — see vite.config.ts / .env handling in this repo).",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
