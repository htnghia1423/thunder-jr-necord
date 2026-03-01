/**
 * Represents a video item from YouTube playlist with all required metadata
 */
export interface PlaylistVideoItem {
	name: string;
	id: string;
	url: string;
	thumbnail?: string;
	uploader?: string;
	duration: number;
}

/**
 * YouTube API: Snippet metadata for a playlist item
 */
export interface YouTubePlaylistItemSnippet {
	title: string;
	videoOwnerChannelTitle?: string;
	thumbnails?: {
		default?: { url: string };
		medium?: { url: string };
		high?: { url: string };
	};
	resourceId: {
		videoId: string;
	};
}

/**
 * YouTube API: Single playlist item response structure
 */
export interface YouTubePlaylistItem {
	snippet: YouTubePlaylistItemSnippet;
}

/**
 * YouTube API: Playlist items response with pagination
 */
export interface YouTubePlaylistResponse {
	items: YouTubePlaylistItem[];
	nextPageToken?: string;
}

/**
 * YouTube API: Video content details (duration in ISO 8601)
 */
export interface YouTubeVideoContentDetails {
	duration: string; // ISO 8601 format (e.g., PT4M13S)
}

/**
 * YouTube API: Single video item response structure
 */
export interface YouTubeVideoItem {
	id: string;
	contentDetails: YouTubeVideoContentDetails;
}

/**
 * YouTube API: Videos response structure
 */
export interface YouTubeVideosResponse {
	items: YouTubeVideoItem[];
}
