-- CreateEnum
CREATE TYPE "Role" AS ENUM ('guru', 'siswa');

-- CreateEnum
CREATE TYPE "Kelas" AS ENUM ('guru', 'XTKJ1', 'XTKJ2', 'XITKJ1', 'XITKJ2', 'XIITKJ1', 'XIITKJ2');

-- CreateEnum
CREATE TYPE "TugasStatus" AS ENUM ('BELUM_SELESAI', 'SELESAI');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL DEFAULT '',
    "role" "Role" NOT NULL,
    "kelas" "Kelas" NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" SERIAL NOT NULL,
    "kode" TEXT NOT NULL,
    "guruId" INTEGER NOT NULL,
    "judul" TEXT NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "lampirkanPDF" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentStatus" (
    "id" SERIAL NOT NULL,
    "siswaId" INTEGER NOT NULL,
    "tugasId" INTEGER NOT NULL,
    "status" "TugasStatus" NOT NULL DEFAULT 'BELUM_SELESAI',

    CONSTRAINT "AssignmentStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentSubmission" (
    "id" SERIAL NOT NULL,
    "siswaId" INTEGER NOT NULL,
    "tugasId" INTEGER NOT NULL,
    "pdfUrl" TEXT,
    "status" "TugasStatus" NOT NULL DEFAULT 'SELESAI',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_kode_key" ON "Assignment"("kode");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_guruId_fkey" FOREIGN KEY ("guruId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentStatus" ADD CONSTRAINT "AssignmentStatus_siswaId_fkey" FOREIGN KEY ("siswaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentStatus" ADD CONSTRAINT "AssignmentStatus_tugasId_fkey" FOREIGN KEY ("tugasId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_siswaId_fkey" FOREIGN KEY ("siswaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_tugasId_fkey" FOREIGN KEY ("tugasId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
