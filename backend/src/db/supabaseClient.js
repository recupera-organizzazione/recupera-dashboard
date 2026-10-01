import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Server-only. SERVICE_ROLE mai esposta al frontend (solo ANON via VITE_*).
// Non-fatale senza chiavi: le route usano allora il fallback CSV locale
// (data/…csv), così test e dev funzionano anche senza progetto Supabase.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabaseKey = supabaseServiceKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  console.warn('AVVISO: SUPABASE_URL / API key mancanti — uso fallback CSV locale (nessuna scrittura DB).');
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

export const hasServiceRole = Boolean(supabaseUrl && supabaseServiceKey);
export const hasSupabase = Boolean(supabase);
