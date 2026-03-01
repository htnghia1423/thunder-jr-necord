import type {
	ChatInputCommandInteraction,
	VoiceBasedChannel,
} from 'discord.js';

/**
 * Result interface for music operations
 */
export interface MusicOperationResult<T = unknown> {
	success: boolean;
	message: string;
	data?: T;
}

/**
 * Data interface for play operation result
 */
export interface PlayData {
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
}

/**
 * Interface for play operation result
 */
export type PlayResult = MusicOperationResult<PlayData>;

/**
 * Data interface for queue operation result
 */
export interface QueueData {
	currentSong?: any;
	queue?: any[];
	totalDuration?: string;
	queueLength?: number;
	currentTime?: number;
	duration?: number;
}

/**
 * Interface for queue operation result
 */
export type QueueResult = MusicOperationResult<QueueData>;

/**
 * Data interface for volume operation result
 */
export interface VolumeData {
	oldVolume?: number;
	newVolume?: number;
}

/**
 * Interface for volume operation result
 */
export type VolumeResult = MusicOperationResult<VolumeData>;

/**
 * Data interface for skip operation result
 */
export interface SkipData {
	skippedSong?: any;
	nextSong?: any;
	wasLastSong?: boolean; // true if this was the last song and playback stopped
}

/**
 * Interface for skip operation result
 */
export type SkipResult = MusicOperationResult<SkipData>;

/**
 * Data interface for now playing operation result
 */
export interface NowPlayingData {
	song: any;
	queue: any;
	progress: number;
}

/**
 * Interface for now playing operation result
 */
export type NowPlayingResult = MusicOperationResult<NowPlayingData>;

/**
 * Common parameters for music commands
 */
export interface MusicCommandParams {
	interaction: ChatInputCommandInteraction;
	voiceChannel?: VoiceBasedChannel;
	member?: any;
	guildId: string;
}
