/*
  Warnings:

  - Added the required column `webhookSecret` to the `Repository` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Repository" ADD COLUMN     "webhookSecret" TEXT NOT NULL;
