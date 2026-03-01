import { Module } from '@nestjs/common';

// Commands
import { LoopCommand } from './commands/loop.command';
import { NowPlayingCommand } from './commands/nowplaying.command';
import { PlayCommand } from './commands/play.command';
import { PlaylistCommand } from './commands/playlist.command';
import { QueueCommand } from './commands/queue.command';
import { RemoveCommand } from './commands/remove.command';
import { ShuffleCommand } from './commands/shuffle.command';
import { SkipCommand } from './commands/skip.command';
import { StatsCommand } from './commands/stats.command';
import { StopCommand } from './commands/stop.command';
import { VolumeCommand } from './commands/volume.command';
// Services
import { AudioControlService } from './services/audio-control.service';
import { DisTubeService } from './services/distube.service';
import { MusicStatsService } from './services/music-stats.service';
import { MusicService } from './services/music.service';
import { PlayMusicService } from './services/play-music.service';
import { PlayResultFormatterService } from './services/play-result-formatter.service';
import { PlaylistDuplicateService } from './services/playlist-duplicate.service';
import { PlaylistOptimizationService } from './services/playlist-optimization.service';
import { PlaylistStorageService } from './services/playlist-storage.service';
import { QueueManagementService } from './services/queue-management.service';
import { YoutubeApiService } from './services/youtube-api.service';

/**
 * MusicModule encapsulates all music-related functionality
 * Following NestJS best practices for separation of concerns
 *
 * Architecture:
 * - DisTubeService: Infrastructure layer (DisTube management)
 * - MusicService: Business logic layer
 * - Commands: Presentation layer (slash commands)
 */
@Module({
	providers: [
		// Services (order matters for dependency injection)
		DisTubeService,
		AudioControlService,
		QueueManagementService,
		PlaylistDuplicateService,
		PlaylistOptimizationService,
		PlaylistStorageService,
		MusicStatsService,
		PlayResultFormatterService,
		YoutubeApiService,
		PlayMusicService,
		MusicService,

		// Commands
		PlayCommand,
		SkipCommand,
		StopCommand,
		QueueCommand,
		RemoveCommand,
		NowPlayingCommand,
		VolumeCommand,
		LoopCommand,
		ShuffleCommand,
		PlaylistCommand,
		StatsCommand,
	],
	exports: [MusicService, DisTubeService], // Make services available across the app
})
export class MusicModule {}
