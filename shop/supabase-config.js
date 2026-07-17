// ── SUPABASE CONFIG ─────────────────────────────────────────
// Fill in your own values below. Get these from:
// Supabase Dashboard → Project Settings → API
//
// SUPABASE_URL looks like: https://xxxxxxxxxxxx.supabase.co
// SUPABASE_ANON_KEY is the long "anon public" key (safe for frontend use)

const SUPABASE_URL = 'https://njtzfttguugurrkyhshp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qdHpmdHRndXVndXJya3loc2hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMzY4NDgsImV4cCI6MjA5OTYxMjg0OH0.VtfXX0He3p577M_5fdvKJzgLwUfcNnGtAguf3Z32xWU';

const supabaseClient = supabase.createClient ( SUPABASE_URL, SUPABASE_ANON_KEY );
 
