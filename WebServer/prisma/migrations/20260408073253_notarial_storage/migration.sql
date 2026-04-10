-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SystemSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "maintainanceMode" BOOLEAN NOT NULL DEFAULT false,
    "systemAnnouncement" TEXT,
    "smtpHost" TEXT DEFAULT 'smtp.gmail.com',
    "smtpPort" INTEGER DEFAULT 587,
    "senderName" TEXT DEFAULT 'RTC Notifications',
    "senderEmail" TEXT DEFAULT 'noreply@rtc.com',
    "senderPassword" TEXT,
    "garageHost" TEXT DEFAULT 'localhost',
    "garagePort" INTEGER DEFAULT 3900,
    "garageIsHttps" BOOLEAN NOT NULL DEFAULT false,
    "garageAccessKey" TEXT,
    "garageSecretKey" TEXT,
    "garageBucket" TEXT,
    "backupFrequency" TEXT NOT NULL DEFAULT 'MANUAL',
    "logRetention" TEXT NOT NULL DEFAULT 'THREE_MONTHS',
    "passwordExpiration" TEXT NOT NULL DEFAULT 'NEVER',
    "lockoutThreshold" TEXT NOT NULL DEFAULT 'NONE',
    "sessionTimeout" TEXT NOT NULL DEFAULT 'NEVER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SystemSettings" ("backupFrequency", "createdAt", "id", "lockoutThreshold", "logRetention", "maintainanceMode", "passwordExpiration", "senderEmail", "senderName", "senderPassword", "sessionTimeout", "smtpHost", "smtpPort", "systemAnnouncement", "updatedAt") SELECT "backupFrequency", "createdAt", "id", "lockoutThreshold", "logRetention", "maintainanceMode", "passwordExpiration", "senderEmail", "senderName", "senderPassword", "sessionTimeout", "smtpHost", "smtpPort", "systemAnnouncement", "updatedAt" FROM "SystemSettings";
DROP TABLE "SystemSettings";
ALTER TABLE "new_SystemSettings" RENAME TO "SystemSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
