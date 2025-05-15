const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://wgdxgzraacfhfbxvxuzy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZHhnenJhYWNmaGZieHZ4dXp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTAzNjM5OCwiZXhwIjoyMDU2NjEyMzk4fQ._dVS_wha-keEbaBb1xapdAeSpgJwwEAnWcrdnjDQ9nA";

// 🔥 Validasi biar ga kosong
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "❌ SUPABASE_URL atau SUPABASE_KEY belum diatur di file .env!"
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = { supabase, SUPABASE_URL };
