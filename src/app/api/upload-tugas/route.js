import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();
const SUPABASE_URL = "https://wgdxgzraacfhfbxvxuzy.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZHhnenJhYWNmaGZieHZ4dXp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTAzNjM5OCwiZXhwIjoyMDU2NjEyMzk4fQ._dVS_wha-keEbaBb1xapdAeSpgJwwEAnWcrdnjDQ9nA";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const userId = formData.get("userId");
    const tugasId = formData.get("tugasId");

    if (!file || !userId || !tugasId) {
      return NextResponse.json(
        { error: "Data tidak lengkap." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileName = `submissions/${Date.now()}.pdf`;
    const { data, error } = await supabase.storage
      .from("submissions")
      .upload(fileName, buffer, {
        contentType: "application/pdf",
      });

    if (error) throw error;

    const pdfUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/submissions/${fileName}`;

    await prisma.assignmentSubmission.create({
      data: {
        siswaId: Number(userId),
        tugasId: Number(tugasId),
        pdfUrl: pdfUrl,
      },
    });

    await prisma.assignmentStatus.updateMany({
      where: { siswaId: Number(userId), tugasId: Number(tugasId) },
      data: { status: "SELESAI" },
    });

    return NextResponse.json({ message: "Tugas berhasil dikumpulkan!" });
  } catch (error) {
    console.error("Upload Error:", error);
    return NextResponse.json(
      { error: "Gagal mengunggah tugas." },
      { status: 500 }
    );
  }
}
