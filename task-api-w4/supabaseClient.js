require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_KEY in .env');
  process.exit(1);
}

// Use the anon key only — NEVER the service_role key here
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = { supabase };
