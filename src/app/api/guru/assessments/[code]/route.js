export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(_req, ctx) {
  try {
    const { code } = await ctx.params;
    const decoded = decodeURIComponent(code);

    // Ambil langsung dari public."Assessment"
    const rows = await prisma.$queryRawUnsafe(
      `
      SELECT "id","guruId","code","title","className","description","timeClose"
      FROM public."Assessment"
      WHERE "code" = $1
      LIMIT 1;
      `,
      decoded
    );

    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!row) {
      return NextResponse.json(
        { ok: false, message: "Assessment tidak ditemukan" },
        { status: 404 }
      );
    }

    // Parse description → { questions: [...] }
    let questions = [];
    if (row.description) {
      try {
        const parsed =
          typeof row.description === "string"
            ? JSON.parse(row.description)
            : row.description;
        if (parsed && Array.isArray(parsed.questions))
          questions = parsed.questions;
      } catch {
        // jika gagal parse, biarkan kosong
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        assessment: {
          id: row.id,
          guruId: row.guruId,
          code: row.code,
          title: row.title,
          className: row.className,
          timeClose: row.timeClose,
        },
        questions, // array JSON yang kamu simpan di description
      },
    });
  } catch (e) {
    console.error("[GET /api/guru/assessments/[code]] error:", e);
    return NextResponse.json(
      { ok: false, message: "Gagal memuat assessment." },
      { status: 500 }
    );
  }
}
