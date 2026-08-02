-- Preferință individuală, opt-in (default false — spre deosebire de
-- chatNotificationsEnabled), pentru notificări prin SMS (Twilio). Necesită
-- și un `phone` setat ca să aibă vreun efect.

ALTER TABLE "users" ADD COLUMN "smsNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;
