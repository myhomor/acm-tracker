-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkspaceSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "authProvider" TEXT NOT NULL DEFAULT 'none',
    "authConfig" TEXT,
    "dailyCostTarget" REAL NOT NULL DEFAULT 2400
);
INSERT INTO "new_WorkspaceSettings" ("authConfig", "authProvider", "id") SELECT "authConfig", "authProvider", "id" FROM "WorkspaceSettings";
DROP TABLE "WorkspaceSettings";
ALTER TABLE "new_WorkspaceSettings" RENAME TO "WorkspaceSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
