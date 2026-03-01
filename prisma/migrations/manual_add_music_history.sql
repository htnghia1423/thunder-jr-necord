-- CreateTable: MusicHistory
-- This migration should be applied manually via Supabase Dashboard or psql
-- Due to connection timeout issues with Prisma CLI

CREATE TABLE IF NOT EXISTS "music_history" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "songTitle" TEXT NOT NULL,
    "songUrl" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "music_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "music_history_guildId_idx" ON "music_history"("guildId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "music_history_userId_idx" ON "music_history"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "music_history_playedAt_idx" ON "music_history"("playedAt");

-- CreateIndex (Compound index for top songs query optimization)
CREATE INDEX IF NOT EXISTS "music_history_guildId_songUrl_idx" ON "music_history"("guildId", "songUrl");
