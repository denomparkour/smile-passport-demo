-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "analysisJson" TEXT,
ADD COLUMN     "celebrityMatch" TEXT,
ADD COLUMN     "smileScore" INTEGER,
ALTER COLUMN "quoteShown" SET DEFAULT '';
