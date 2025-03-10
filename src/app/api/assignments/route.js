import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const assignments = await prisma.assignment.findMany(); // Ganti dengan nama tabel di database
    return NextResponse.json(assignments);
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return NextResponse.json(
      { error: "Gagal mengambil tugas" },
      { status: 500 }
    );
  }
}
