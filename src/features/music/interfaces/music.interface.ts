import type {
	ChatInputCommandInteraction,
	VoiceBasedChannel,
} from 'discord.js';

/**
 * Result interface for music operations
 */
export interface MusicOperationResult {
	success: boolean;
	message: string;
	data?: any;
}

/**
 * Interface for play operation result
 */
export interface PlayResult extends MusicOperationResult {
	data?: {
		songName?: string;
		duration?: string;
		requester?: string;
		isPlaylist?: boolean;
		playlistName?: string;
		songsAdded?: number;
		queuePosition?: number;
		isNowPlaying?: boolean; // true if song starts playing immediately
		wasQueueEmpty?: boolean; // true if queue was empty before adding
		duplicateWarning?: string; // warning message for duplicate songs
	};
}

/**
 * Interface for queue operation result
 */
export interface QueueResult extends MusicOperationResult {
	data?: {
		currentSong?: any;
		queue?: any[];
		totalDuration?: string;
		queueLength?: number;
		currentTime?: number;
		duration?: number;
	};
}

/**
 * Interface for volume operation result
 */
export interface VolumeResult extends MusicOperationResult {
	data?: {
		oldVolume?: number;
		newVolume?: number;
	};
}

/**
 * Interface for skip operation result
 */
export interface SkipResult extends MusicOperationResult {
	data?: {
		skippedSong?: any;
		nextSong?: any;
		wasLastSong?: boolean; // true if this was the last song and playback stopped
	};
}

/**
 * Common parameters for music commands
 */
export interface MusicCommandParams {
	interaction: ChatInputCommandInteraction;
	voiceChannel?: VoiceBasedChannel;
	member?: any;
	guildId: string;
}
