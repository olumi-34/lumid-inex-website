// ── SUPABASE CONFIG ─────────────────────────────────────────
// Fill in your own values below. Get these from:
// Supabase Dashboard → Project Settings → API
//
// SUPABASE_URL looks like: https://xxxxxxxxxxxx.supabase.co
// SUPABASE_ANON_KEY is the long "anon public" key (safe for frontend use)

const SUPABASE_URL = 'https://njtzfttguugurrkyhshp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_U8z0jAPx4fqt2DignoKihQ_qi6yPI8Q';

const supabaseClient = supabase.createClient ( SUPABASE_URL, SUPABASE_ANON_KEY );
 
