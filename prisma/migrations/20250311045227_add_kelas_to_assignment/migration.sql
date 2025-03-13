/*
  Warnings:

  - The values [guru] on the enum `Kelas` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `kelas` to the `Assignment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Kelas_new" AS ENUM ('XTKJ1', 'XTKJ2', 'XITKJ1', 'XITKJ2', 'XIITKJ1', 'XIITKJ2');
ALTER TABLE "User" ALTER COLUMN "kelas" TYPE "Kelas_new" USING ("kelas"::text::"Kelas_new");
ALTER TYPE "Kelas" RENAME TO "Kelas_old";
ALTER TYPE "Kelas_new" RENAME TO "Kelas";
DROP TYPE "Kelas_old";
COMMIT;

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "kelas" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "kelas" DROP NOT NULL;
