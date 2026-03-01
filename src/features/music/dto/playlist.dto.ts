import { StringOption } from 'necord';

/**
 * DTO for /playlist save command validation
 */
export class PlaylistSaveDto {
	@StringOption({
		name: 'name',
		description: 'Name for the playlist',
		required: true,
	})
	name!: string;
}

/**
 * DTO for /playlist load command validation
 */
export class PlaylistLoadDto {
	@StringOption({
		name: 'name',
		description: 'Name of the playlist to load',
		required: true,
	})
	name!: string;
}

/**
 * DTO for /playlist delete command validation
 */
export class PlaylistDeleteDto {
	@StringOption({
		name: 'name',
		description: 'Name of the playlist to delete',
		required: true,
	})
	name!: string;
}

/**
 * Interface representing a saved playlist with songs from database
 * Extends Prisma's Playlist type with the songs relation
 */
export interface SavedPlaylist {
	id: number;
	userId: string;
	name: string;
	createdAt: Date;
	updatedAt: Date;
	songs: Array<{
		id: number;
		playlistId: number;
		title: string;
		url: string;
		duration: number;
		thumbnail: string | null;
		uploader: string | null;
		position: number;
		createdAt: Date;
	}>;
}

/**
 * Interface for playlist save operation data payload
 */
export interface PlaylistSaveData {
	userId: string;
	username: string;
	playlistName: string;
	songs: Array<{
		title: string;
		url: string;
		duration: number;
		thumbnail?: string;
		uploader?: string;
	}>;
}
