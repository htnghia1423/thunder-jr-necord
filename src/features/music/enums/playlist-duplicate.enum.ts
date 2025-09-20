/**
 * Enum for playlist duplicate handling actions
 */
export enum PlaylistDuplicateAction {
	ADD_ALL = 'add_all', // Add all songs including duplicates
	NEW_ONLY = 'new_only', // Add only new songs (skip duplicates)
	CANCEL = 'cancel', // Cancel adding, keep current queue unchanged
}

/**
 * Interface for playlist duplicate interaction result
 */
export interface PlaylistDuplicateInteraction {
	action: PlaylistDuplicateAction;
	totalSongs: number;
	duplicateCount: number;
	newSongsCount: number;
}
