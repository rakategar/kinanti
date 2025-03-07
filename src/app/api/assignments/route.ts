import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assignments = await prisma.assignmentStatus.findMany({
    where: { siswaId: Number(session.user.id) },
    include: { tugas: true },
  });

  return NextResponse.json(
    assignments.map((a) => ({
      id: a.tugas.id,
      judul: a.tugas.judul,
      status: a.status,
    }))
  );
}
