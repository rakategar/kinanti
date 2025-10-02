const { createClient } = require("@supabase/supabase-js");

require("dotenv").config();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;


// 🔥 Validasi biar ga kosong
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "❌ SUPABASE_URL atau SUPABASE_KEY belum diatur di file .env!"
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = { supabase, SUPABASE_URL };
