-- CreateTable
CREATE TABLE "music_history" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "songTitle" TEXT NOT NULL,
    "songUrl" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "music_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "music_history_guildId_idx" ON "music_history"("guildId");

-- CreateIndex
CREATE INDEX "music_history_userId_idx" ON "music_history"("userId");

-- CreateIndex
CREATE INDEX "music_history_playedAt_idx" ON "music_history"("playedAt");

-- CreateIndex
CREATE INDEX "music_history_guildId_songUrl_idx" ON "music_history"("guildId", "songUrl");
