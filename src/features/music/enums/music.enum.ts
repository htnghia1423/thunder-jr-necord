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
	SONG_PLAYING = '🎵 **Đang phát:** {songName}',
	SONG_ADDED = '✅ **Đã thêm vào hàng đợi:** {songName}',
	SONG_SKIPPED = '⏭️ **Đã bỏ qua bài hát**', // Removed placeholder, handled dynamically
	PLAYBACK_STOPPED = '⏹️ **Đã dừng phát nhạc và xóa hàng đợi**',
	QUEUE_CLEARED = '🗑️ **Đã xóa hàng đợi**',
	VOLUME_CHANGED = '🔊 **Âm lượng đã được điều chỉnh:** {volume}%',

	// Error messages
	NOT_IN_VOICE_CHANNEL = '❌ Bạn cần ở trong một voice channel để sử dụng lệnh này!',
	BOT_NO_PERMISSIONS = '❌ Tôi không có quyền Connect hoặc Speak trong voice channel này!',
	NO_QUEUE = '❌ Không có hàng đợi nào!',
	QUEUE_EMPTY = '❌ Hàng đợi trống!',
	SONG_NOT_FOUND = '❌ Không tìm thấy bài hát nào với từ khóa này!',
	INVALID_POSITION = '❌ Vị trí không hợp lệ trong hàng đợi!',
	NO_CURRENT_SONG = '❌ Không có bài hát nào đang phát!',
	PLAY_ERROR = '❌ Có lỗi khi phát nhạc. Vui lòng thử lại!',
	SKIP_ERROR = '❌ Có lỗi khi bỏ qua bài hát!',
	INVALID_VOLUME = '❌ Âm lượng phải từ 0 đến 100!',
	GENERIC_ERROR = '❌ Có lỗi xảy ra khi thực hiện lệnh. Vui lòng thử lại sau!',
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
}
