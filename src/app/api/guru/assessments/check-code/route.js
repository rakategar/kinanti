export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Pakai raw SQL biar tidak tergantung nama model di Prisma
function provider() {
  const u = process.env.DATABASE_URL || "";
  if (u.startsWith("postgres")) return "pg";
  if (u.startsWith("mysql")) return "mysql";
  return "pg";
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const code = (searchParams.get("code") || "").toUpperCase().trim();
    if (!code) return NextResponse.json({ exists: null }, { status: 400 });

    const prov = provider();
    // UBAH kalau nama tabel aslinya beda
    const candidates = [
      "Assessment",
      "assessment",
      "assessments",
      "Penilaian",
      "penilaian",
    ];

    let exists = false;
    for (const tbl of candidates) {
      try {
        if (prov === "pg") {
          const rows = await prisma.$queryRawUnsafe(
            `SELECT 1 FROM "${tbl}" WHERE "code" = $1 LIMIT 1;`,
            code
          );
          if (Array.isArray(rows) && rows.length) {
            exists = true;
            break;
          }
        } else {
          const rows = await prisma.$queryRawUnsafe(
            `SELECT 1 AS ok FROM \`${tbl}\` WHERE \`code\` = ? LIMIT 1;`,
            code
          );
          if (Array.isArray(rows) && rows.length) {
            exists = true;
            break;
          }
        }
      } catch {}
    }
    return NextResponse.json({ exists });
  } catch (e) {
    console.error("[check-code] error:", e);
    return NextResponse.json({ exists: null }, { status: 500 });
  }
}
