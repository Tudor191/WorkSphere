-- DropIndex
DROP INDEX "users_companyId_email_key";

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
