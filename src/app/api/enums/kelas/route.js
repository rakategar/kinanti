export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function isPg() {
  const u = process.env.DATABASE_URL || "";
  return u.startsWith("postgres");
}

export async function GET() {
  try {
    const pg = isPg();

    // 1) Coba deteksi enum langsung dari kolom "className" pada tabel penilaian (nama tabel fleksibel)
    const tableCandidates = [
      "Assessment",
      "assessment",
      "assessments",
      "Penilaian",
      "penilaian",
    ];
    const colCandidates = ["className", "kelas", "kelasName", "class"];

    let values = [];
    let foundEnumType = null;

    if (pg) {
      // Prioritas: enum "Kelas" milik schema public (Prisma). Hindari enum lain
      // (Role/TugasStatus, atau enum bawaan schema storage/net di Supabase).
      try {
        const kelasRows = await prisma.$queryRawUnsafe(
          `
          SELECT e.enumlabel AS label
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public' AND t.typname = 'Kelas'
          ORDER BY e.enumsortorder;
          `
        );
        if (Array.isArray(kelasRows) && kelasRows.length) {
          values = kelasRows.map((r) => r.label);
          foundEnumType = "Kelas";
        }
      } catch (_) {}

      // POSTGRES: cari tipe user-defined (enum) dari kolomnya
      if (!values.length)
      outer: for (const tbl of tableCandidates) {
        for (const col of colCandidates) {
          try {
            const info = await prisma.$queryRawUnsafe(
              `
              SELECT data_type, udt_name
              FROM information_schema.columns
              WHERE table_schema = current_schema()
                AND (table_name = $1 OR table_name = $2)
                AND column_name = $3
              LIMIT 1;
              `,
              tbl,
              tbl.toLowerCase(),
              col
            );
            if (Array.isArray(info) && info.length) {
              const row = info[0];
              if (row.data_type === "USER-DEFINED" && row.udt_name) {
                foundEnumType = row.udt_name; // nama tipe enum di pg_type
                break outer;
              }
            }
          } catch (_) {}
        }
      }

      if (foundEnumType) {
        const rows = await prisma.$queryRawUnsafe(
          `
          SELECT e.enumlabel AS label
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = $1
          ORDER BY e.enumsortorder;
          `,
          foundEnumType
        );
        values = rows.map((r) => r.label);
      }
    } else {
      // MYSQL: cari kolom enum pada tabel kandidat
      outer: for (const tbl of tableCandidates) {
        for (const col of colCandidates) {
          try {
            const row = await prisma.$queryRawUnsafe(
              `
              SELECT COLUMN_TYPE AS ct
              FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = ?
                AND COLUMN_NAME = ?
              LIMIT 1;
              `,
              tbl,
              col
            );
            const ct = Array.isArray(row) ? row[0]?.ct : row?.ct;
            if (ct && /^enum\(/i.test(ct)) {
              const inner = ct.slice(5, -1);
              values = inner
                .split(",")
                .map((s) => s.trim().replace(/^'/, "").replace(/'$/, ""))
                .filter(Boolean);
              break outer;
            }
          } catch (_) {}
        }
      }
    }

    // 2) Fallback: kumpulkan semua enum di DB bila langkah 1 gagal (biar dropdown tetap ada)
    if (!values.length) {
      if (pg) {
        const rows = await prisma.$queryRawUnsafe(
          `
          SELECT t.typname AS enum_name, e.enumlabel AS label, e.enumsortorder
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public' AND t.typname = 'Kelas'
          ORDER BY t.typname, e.enumsortorder;
          `
        );
        const set = new Set();
        rows.forEach((r) => set.add(r.label));
        values = Array.from(set);
      } else {
        // MYSQL: ambil semua kolom ENUM di schema aktif dan gabungkan nilainya
        const cols = await prisma.$queryRawUnsafe(
          `
          SELECT TABLE_NAME AS tbl, COLUMN_NAME AS col, COLUMN_TYPE AS ct
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND DATA_TYPE = 'enum';
          `
        );
        const set = new Set();
        (cols || []).forEach((c) => {
          if (c.ct && /^enum\(/i.test(c.ct)) {
            const inner = c.ct.slice(5, -1);
            inner.split(",").forEach((s) => {
              const v = s.trim().replace(/^'/, "").replace(/'$/, "");
              if (v) set.add(v);
            });
          }
        });
        values = Array.from(set);
      }
    }

    return NextResponse.json({ ok: true, data: values });
  } catch (e) {
    console.error("[/api/enums/kelas] error:", e);
    return NextResponse.json(
      { ok: false, message: "Gagal membaca enum kelas." },
      { status: 500 }
    );
  }
}
