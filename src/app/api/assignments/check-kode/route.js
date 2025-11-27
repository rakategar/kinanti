import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const g = globalThis;
const prisma = g.prisma || new PrismaClient({});
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const kode = searchParams.get("kode");

    if (!kode) {
      return NextResponse.json(
        { error: "Kode tidak diberikan" },
        { status: 400 }
      );
    }

    const existing = await prisma.assignment.findUnique({
      where: { kode: kode.toUpperCase() },
    });

    return NextResponse.json({
      available: !existing,
      message: existing ? "Kode sudah digunakan" : "Kode tersedia",
    });
  } catch (error) {
    console.error("Error checking kode:", error);
    return NextResponse.json(
      { error: "Gagal memeriksa kode" },
      { status: 500 }
    );
  }
}
