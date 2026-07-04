-- AlterEnum
ALTER TYPE "Kelas" ADD VALUE 'TPTUP';

-- DropForeignKey
ALTER TABLE "AssignmentStatus" DROP CONSTRAINT "AssignmentStatus_tugasId_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentSubmission" DROP CONSTRAINT "AssignmentSubmission_tugasId_fkey";

-- AddForeignKey
ALTER TABLE "AssignmentStatus" ADD CONSTRAINT "AssignmentStatus_tugasId_fkey" FOREIGN KEY ("tugasId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_tugasId_fkey" FOREIGN KEY ("tugasId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
