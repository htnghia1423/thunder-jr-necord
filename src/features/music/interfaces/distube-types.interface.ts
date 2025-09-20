import { ChatInputCommandInteraction, User } from 'discord.js';
import { Queue, Song } from 'distube';

import type { PlayResult } from './music.interface';

// Extended DisTube Song interface with additional properties we use
export interface ExtendedSong extends Omit<Song, 'uploader'> {
	name: string;
	url: string;
	duration: number;
	formattedDuration: string;
	user: User;
	uploader?: {
		name?: string;
		url?: string;
	};
}

// Extended DisTube Queue interface with typed songs
export interface ExtendedQueue extends Omit<Queue, 'songs'> {
	songs: ExtendedSong[];
	currentTime: number;
	formattedCurrentTime: string;
}

// Duplicate analysis result interface
export interface DuplicateAnalysisResult {
	totalSongs: number;
	duplicateCount: number;
	duplicates: DuplicateSongEntry[];
	newSongs: ExtendedSong[];
}

// Individual duplicate song entry
export interface DuplicateSongEntry {
	song: ExtendedSong;
	existingPosition: number;
	matchType: 'url' | 'name' | 'both';
}

// Duplicate check result interface
export interface DuplicateCheckResult {
	isDuplicate: boolean;
	position?: number;
	matchType?: 'url' | 'name' | 'both';
}

// Type assertion helpers for safe casting
/**
 * Safely cast ExtendedSong to Song for DisTube utilities
 */
export function toSong(song: ExtendedSong | undefined): Song {
	return song as unknown as Song;
}

/**
 * Safely cast ExtendedSong array to Song array for DisTube utilities
 */
export function toSongArray(songs: ExtendedSong[]): Song[] {
	return songs as unknown as Song[];
}

/**
 * Safely cast ExtendedQueue to base Queue type
 */
export function toQueue(queue: ExtendedQueue): Queue {
	return queue as unknown as Queue;
}

// Parameter objects for reducing method parameter count (S107 compliance)

/**
 * Parameters for processPlaylistDuplicates method
 */
export interface ProcessPlaylistDuplicatesParams {
	interaction: ChatInputCommandInteraction;
	finalQueue: ExtendedQueue | null;
	songsAdded: number;
	originalQueueLength: number;
	currentSong: ExtendedSong | undefined;
	wasQueueEmpty: boolean;
	isPlaylist: boolean;
	existingQueue: ExtendedQueue | null;
	resolve: (result: PlayResult) => void;
}

/**
 * Parameters for handleSignificantPlaylistDuplicates method
 */
export interface HandleSignificantPlaylistDuplicatesParams {
	interaction: ChatInputCommandInteraction;
	duplicateAnalysis: DuplicateAnalysisResult;
	currentSong: ExtendedSong | undefined;
	wasQueueEmpty: boolean;
	isPlaylist: boolean;
	songsAdded: number;
	existingQueue: ExtendedQueue | null;
	resolve: (result: PlayResult) => void;
}
