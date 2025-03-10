import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function fetchAssignments() {
  try {
    const assignments = await prisma.assignment.findMany({
      select: {
        id: true,
        judul: true,
        status: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return assignments;
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return [];
  }
}
