/**
 * Data Transfer Objects for Music Statistics Feature
 * Contains interfaces for server-wide and user-specific statistics
 */

/**
 * Represents a single top song entry with play count
 */
export interface TopSong {
	songTitle: string;
	songUrl: string;
	playCount: number;
}

/**
 * Represents a top DJ (user) with their play count
 */
export interface TopDJ {
	userId: string;
	username: string; // Resolved from Discord API
	playCount: number;
}

/**
 * Server-wide statistics data
 * Used by /stats server command
 */
export interface ServerStatsData {
	guildId: string;
	totalPlays: number;
	topSongs: TopSong[]; // Top 10 most played songs
	topDJs: TopDJ[]; // Top 5 users by play count
}

/**
 * User-specific statistics data
 * Used by /stats me command
 */
export interface UserStatsData {
	guildId: string;
	userId: string;
	totalPlays: number;
	topSongs: TopSong[]; // User's top 10 favorite songs
	rank?: number; // User's rank in the server (optional)
}
