const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://wgdxgzraacfhfbxvxuzy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZHhnenJhYWNmaGZieHZ4dXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwMzYzOTgsImV4cCI6MjA1NjYxMjM5OH0.E81IkESQjwL8KLYYaiyYcGgZNiANWef3szZxtPusJz8";

// 🔥 Validasi biar ga kosong
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "❌ SUPABASE_URL atau SUPABASE_KEY belum diatur di file .env!"
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = { supabase, SUPABASE_URL };
