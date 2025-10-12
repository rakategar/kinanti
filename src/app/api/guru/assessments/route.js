export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const guruId = searchParams.get("guruId");

    if (!guruId) {
      return NextResponse.json(
        { ok: false, message: "guruId wajib diisi" },
        { status: 400 }
      );
    }

    const assessments = await prisma.assessment.findMany({
      where: { guruId: Number(guruId) },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      data: assessments,
    });
  } catch (e) {
    console.error("[GET /api/guru/assessments] error:", e);
    return NextResponse.json(
      { ok: false, message: "Gagal mengambil data assessment" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { guruId, kode, title, className, timeClose, questions } = body || {};

    if (!guruId || !kode || !title || !className) {
      return NextResponse.json(
        { ok: false, message: "Data tidak lengkap." },
        { status: 400 }
      );
    }

    const code = String(kode).toUpperCase().trim();
    const questionsJson = JSON.stringify({
      questions: Array.isArray(questions) ? questions : [],
    });

    // Insert into the real table with explicit columns & safe defaults.
    // This avoids NOT NULL violations and ignores Prisma model mismatches.
    const rows = await prisma.$queryRawUnsafe(
      `
      INSERT INTO public."Assessment"
        ("guruId","code","title","className","description",
         "kkm","timeClose","createdAt","updatedAt","status",
         "maxAttempts","showKeyAfterClose","showScoreImmediately",
         "shuffleOptions","shuffleQuestions")
      VALUES
        ($1,$2,$3,$4,$5,
         $6,$7,now(),now(),$8,
         $9,$10,$11,
         $12,$13)
      RETURNING
        "id","guruId","code","title","className","status","kkm","timeClose","createdAt","updatedAt";
      `,
      Number(guruId),
      code,
      title,
      className,
      questionsJson,
      75, // kkm
      timeClose ? new Date(timeClose) : null, // timeClose (nullable)
      "DRAFT", // status
      1, // maxAttempts
      false, // showKeyAfterClose
      false, // showScoreImmediately
      false, // shuffleOptions
      false // shuffleQuestions
    );

    const inserted = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!inserted) {
      return NextResponse.json(
        { ok: false, message: "Insert assessment gagal." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: inserted.id,
        guruId: inserted.guruId,
        code: inserted.code,
        title: inserted.title,
        className: inserted.className,
        status: inserted.status,
        kkm: inserted.kkm,
        timeClose: inserted.timeClose,
        questionsStored: Array.isArray(questions) ? questions.length : 0,
      },
    });
  } catch (e) {
    console.error("[POST /api/guru/assessments] error:", e);
    return NextResponse.json(
      { ok: false, message: "Gagal membuat assessment." },
      { status: 500 }
    );
  }
}
