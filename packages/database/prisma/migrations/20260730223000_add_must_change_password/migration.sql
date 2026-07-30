-- Forțează setarea unei parole proprii la prima autentificare pentru
-- conturile create de un admin cu parolă temporară (vezi
-- EmployeesService.create). Default false — nu afectează conturile
-- existente sau cele înregistrate direct (auth/register).

ALTER TABLE users ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
