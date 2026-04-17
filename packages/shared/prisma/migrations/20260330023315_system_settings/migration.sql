-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "maintainanceMode" BOOLEAN NOT NULL DEFAULT false,
    "systemAnnouncement" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "senderEmail" TEXT,
    "backupFrequency" TEXT NOT NULL DEFAULT 'MANUAL',
    "logRetention" TEXT NOT NULL DEFAULT 'THREE_MONTHS',
    "passwordExpiration" TEXT NOT NULL DEFAULT 'NEVER',
    "lockoutThreshold" TEXT NOT NULL DEFAULT 'THREE_ATTEMPTS',
    "sessionTimeout" TEXT NOT NULL DEFAULT 'THIRTY_MINUTES',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);
