CREATE TABLE "CookiePreference" ("id" TEXT NOT NULL,"publicReference" TEXT NOT NULL,"userId" TEXT,"anonymousSubjectHash" TEXT,"schemaVersion" TEXT NOT NULL,"necessary" BOOLEAN NOT NULL DEFAULT true,"functional" BOOLEAN NOT NULL DEFAULT false,"analytics" BOOLEAN NOT NULL DEFAULT false,"marketing" BOOLEAN NOT NULL DEFAULT false,"source" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "CookiePreference_pkey" PRIMARY KEY("id"));
CREATE TABLE "CookiePreferenceEvent" ("id" TEXT NOT NULL,"cookiePreferenceId" TEXT NOT NULL,"operationId" TEXT NOT NULL,"actorUserId" TEXT,"source" TEXT NOT NULL,"schemaVersion" TEXT NOT NULL,"stateSnapshot" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "CookiePreferenceEvent_pkey" PRIMARY KEY("id"));
CREATE UNIQUE INDEX "CookiePreference_publicReference_key" ON "CookiePreference"("publicReference");
CREATE UNIQUE INDEX "CookiePreference_userId_schemaVersion_key" ON "CookiePreference"("userId", "schemaVersion");
CREATE UNIQUE INDEX "CookiePreference_anonymousSubjectHash_schemaVersion_key" ON "CookiePreference"("anonymousSubjectHash", "schemaVersion");
CREATE UNIQUE INDEX "CookiePreferenceEvent_operationId_key" ON "CookiePreferenceEvent"("operationId");
CREATE INDEX "CookiePreference_userId_updatedAt_idx" ON "CookiePreference"("userId", "updatedAt");
CREATE INDEX "CookiePreferenceEvent_cookiePreferenceId_createdAt_idx" ON "CookiePreferenceEvent"("cookiePreferenceId", "createdAt");
ALTER TABLE "CookiePreferenceEvent" ADD CONSTRAINT "CookiePreferenceEvent_cookiePreferenceId_fkey" FOREIGN KEY ("cookiePreferenceId") REFERENCES "CookiePreference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
