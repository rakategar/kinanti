// src/config/prisma.js
const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis; // aman untuk hot-reload dev

const prisma =
  globalForPrisma.__prisma__ ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    // Datasource configuration untuk connection pooling
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

// Middleware untuk retry otomatis saat koneksi gagal
prisma.$use(async (params, next) => {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 detik

  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      return await next(params);
    } catch (error) {
      // Cek apakah error koneksi database
      const isConnectionError =
        error.message?.includes("Can't reach database server") ||
        error.message?.includes("Connection refused") ||
        error.message?.includes("Connection timed out") ||
        error.message?.includes("ECONNREFUSED") ||
        error.message?.includes("ETIMEDOUT") ||
        error.code === "P1001" || // Prisma connection error
        error.code === "P1002"; // Connection timeout

      if (isConnectionError && retries < MAX_RETRIES - 1) {
        retries++;
        console.warn(
          `⚠️ Database connection failed. Retry ${retries}/${MAX_RETRIES} in ${RETRY_DELAY}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * retries));
        continue;
      }
      throw error;
    }
  }
});

// Graceful shutdown
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma__ = prisma;
}

module.exports = prisma; // <<< ekspor instance langsung (BUKAN { prisma })
