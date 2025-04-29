const { supabase, SUPABASE_URL } = require("../config/supabase");

async function uploadPDFtoSupabase(fileBuffer, fileName, mimeType) {
  const { data, error } = await supabase.storage
    .from("assignments")
    .upload(`assignments/${fileName}`, fileBuffer, { contentType: mimeType });

  if (error) throw new Error("Gagal upload PDF ke Supabase");

  return `${SUPABASE_URL}/storage/v1/object/public/assignments/${fileName}`;
}

module.exports = { uploadPDFtoSupabase };
