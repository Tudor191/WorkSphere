-- DropForeignKey
ALTER TABLE "calendar_events" DROP CONSTRAINT "calendar_events_createdById_fkey";

-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_authorId_fkey";

-- DropForeignKey
ALTER TABLE "crm_notes" DROP CONSTRAINT "crm_notes_authorId_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "task_comments" DROP CONSTRAINT "task_comments_authorId_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_createdById_fkey";

-- DropForeignKey
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_userId_fkey";

-- AlterTable
ALTER TABLE "calendar_events" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "chat_messages" ALTER COLUMN "authorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "crm_notes" ALTER COLUMN "authorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "uploadedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "task_comments" ALTER COLUMN "authorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "tasks" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "time_entries" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "account_deletion_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "scheduledDeletionAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_deletion_requests_userId_idx" ON "account_deletion_requests"("userId");

-- AddForeignKey
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security — tabel copil fără `companyId` propriu, exact ca
-- `password_reset_tokens`: izolare prin subquery pe `userId` -> `users."companyId"`,
-- plus `app.bypass_rls` pentru cron-ul zilnic de ștergere automată și
-- confirmarea publică de accelerare (ambele rulează fără context de tenant —
-- vezi `AccountDeletionService`).
ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_deletion_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON account_deletion_requests
  USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR "userId" IN (
      SELECT id FROM users WHERE "companyId" = current_setting('app.current_company_id', true)
    )
  );
