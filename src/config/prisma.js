// src/config/prisma.js
const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis; // aman untuk hot-reload dev

// Tambahkan parameter connection pool ke DATABASE_URL jika belum ada
let dbUrl = process.env.DATABASE_URL || "";
if (dbUrl && !dbUrl.includes("connection_limit")) {
  const separator = dbUrl.includes("?") ? "&" : "?";
  dbUrl += `${separator}connection_limit=5&pool_timeout=30`;
}

const prisma =
  globalForPrisma.__prisma__ ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: dbUrl,
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
        error.message?.includes("Timed out fetching a new connection") ||
        error.message?.includes("connection pool") ||
        error.message?.includes("ECONNREFUSED") ||
        error.message?.includes("ETIMEDOUT") ||
        error.code === "P1001" || // Prisma connection error
        error.code === "P1002" || // Connection timeout
        error.code === "P2024"; // Connection pool timeout

      if (isConnectionError && retries < MAX_RETRIES - 1) {
        retries++;
        console.warn(
          `⚠️ Database connection failed (${
            error.code || "unknown"
          }). Retry ${retries}/${MAX_RETRIES} in ${RETRY_DELAY * retries}ms...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY * retries)
        );
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

// Keep connection alive dengan periodic ping (setiap 5 menit)
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma__ = prisma;
}

// Ping database setiap 4 menit untuk menjaga koneksi
setInterval(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    console.warn("⚠️ Database keep-alive ping failed:", e.message);
  }
}, 4 * 60 * 1000);

module.exports = prisma; // <<< ekspor instance langsung (BUKAN { prisma })
