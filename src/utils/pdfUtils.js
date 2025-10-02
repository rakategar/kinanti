const { supabase, SUPABASE_URL } = require("../config/supabase");

async function uploadPDFtoSupabase(
  fileBuffer,
  fileName,
  mimeType = "application/pdf",
  subdir = "guru"
) {
  const objectPath = `${subdir}/${fileName}`;
  const { error } = await supabase.storage
    .from("assignments")
    .upload(objectPath, fileBuffer, { contentType: mimeType, upsert: true });

  if (error) {
    console.error("Supabase upload error:", error);
    throw new Error("Gagal upload PDF ke Supabase");
  }
  return `${SUPABASE_URL}/storage/v1/object/public/assignments/${objectPath}`;
}

module.exports = { uploadPDFtoSupabase };
