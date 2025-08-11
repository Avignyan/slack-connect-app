-- CreateTable
CREATE TABLE "public"."SlackInstallation" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "SlackInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScheduledMessage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "installationId" TEXT NOT NULL,
    "sendAsUser" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ScheduledMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OAuthState" (
    "id" SERIAL NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlackInstallation_teamId_userId_key" ON "public"."SlackInstallation"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthState_state_key" ON "public"."OAuthState"("state");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_token_key" ON "public"."UserSession"("token");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_userId_teamId_key" ON "public"."UserSession"("userId", "teamId");

-- AddForeignKey
ALTER TABLE "public"."ScheduledMessage" ADD CONSTRAINT "ScheduledMessage_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "public"."SlackInstallation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
