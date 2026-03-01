/**
 * Enum for DisTube loop modes
 */
export enum LoopMode {
	OFF = 0,
	SONG = 1,
	QUEUE = 2,
}

/**
 * Enum for music command responses
 */
export enum MusicResponse {
	// Success messages
	SONG_PLAYING = '🎵 **Now Playing:** {songName}',
	SONG_ADDED = '✅ **Added to Queue:** {songName}',
	SONG_SKIPPED = '⏭️ **Song Skipped**', // Removed placeholder, handled dynamically
	PLAYBACK_STOPPED = '⏹️ **Playback stopped and queue cleared**',
	QUEUE_CLEARED = '🗑️ **Queue cleared**',
	VOLUME_CHANGED = '🔊 **Volume set to:** {volume}%',

	// Error messages
	NOT_IN_VOICE_CHANNEL = '❌ You need to be in a voice channel to use this command!',
	BOT_NO_PERMISSIONS = "❌ I don't have Connect or Speak permissions in this voice channel!",
	NO_QUEUE = '❌ No queue found!',
	QUEUE_EMPTY = '❌ Queue is empty!',
	SONG_NOT_FOUND = '❌ No song found with that search term!',
	INVALID_POSITION = '❌ Invalid position in queue!',
	NO_CURRENT_SONG = '❌ No song is currently playing!',
	PLAY_ERROR = '❌ Error playing music. Please try again!',
	PLAY_ERROR_AGE_RESTRICTED = '❌ This video is age-restricted and cannot be played.',
	PLAY_ERROR_PRIVATE = '❌ This video is private or unavailable.',
	PLAY_ERROR_REGION_BLOCKED = '❌ This video is not available in your region.',
	PLAY_ERROR_UNAVAILABLE = '❌ This video is unavailable or has been removed.',
	SKIP_ERROR = '❌ Error skipping song!',
	INVALID_VOLUME = '❌ Volume must be between 0 and 100!',
	GENERIC_ERROR = '❌ An error occurred while executing the command. Please try again later!',
}

/**
 * Enum for DisTube events we handle
 */
export enum DisTubeEvents {
	PLAY_SONG = 'playSong',
	ADD_SONG = 'addSong',
	ADD_LIST = 'addList',
	PLAY_LIST = 'playList',
	FINISH = 'finish',
	ERROR = 'error',
	NO_RELATED = 'noRelated',
	EMPTY = 'empty',
	DISCONNECT = 'disconnect',
}
