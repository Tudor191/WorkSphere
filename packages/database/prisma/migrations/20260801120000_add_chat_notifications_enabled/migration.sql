-- Preferință individuală pentru a activa/dezactiva strict notificările
-- (in-app + push) la mesaje noi de chat, fără a afecta celelalte tipuri
-- de notificări (concedii, task-uri etc.).

ALTER TABLE "users" ADD COLUMN "chatNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
