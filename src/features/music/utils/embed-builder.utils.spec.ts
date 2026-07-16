import type { ServerStatsData, UserStatsData } from '../dto/stats.dto';
import type { ExtendedSong } from '../interfaces/distube-types.interface';
import { MusicConstants } from '../music.constants';
import { EmbedBuilder } from 'discord.js';

import { EmbedBuilderUtils, type QueueLike } from './embed-builder.utils';

const makeUser = (over: Record<string, any> = {}): ExtendedSong['user'] =>
	({
		id: 'user-1',
		username: 'Requester',
		displayAvatarURL: jest.fn().mockReturnValue('https://cdn/avatar.png'),
		...over,
	}) as unknown as ExtendedSong['user'];

const makeSong = (over: Record<string, any> = {}): ExtendedSong => {
	const base: Record<string, any> = {
		name: 'Test Song',
		url: 'https://youtu.be/abc',
		duration: 200,
		formattedDuration: '03:20',
		thumbnail: 'https://img/thumb.png',
		uploader: { name: 'Cool Artist' },
		user: makeUser(),
	};
	return { ...base, ...over } as unknown as ExtendedSong;
};

const makeQueue = (over: Partial<QueueLike> = {}): QueueLike => ({
	songs: [],
	volume: 50,
	repeatMode: 0,
	...over,
});

const getField = (embed: EmbedBuilder, label: string) =>
	embed.data.fields?.find((field) => field.name.includes(label));

describe('EmbedBuilderUtils.createPlayEmbed', () => {
	it('renders a "Now Playing" embed when no position is provided', () => {
		const song = makeSong({ name: 'Hello', url: 'https://youtu.be/hello' });

		const embed = EmbedBuilderUtils.createPlayEmbed(song);

		expect(embed.data.title).toContain('Now Playing');
		expect(embed.data.description).toBe('[Hello](https://youtu.be/hello)');
		expect(embed.data.color).toBe(MusicConstants.COLOR_SUCCESS);
		expect(getField(embed, 'Uploader')?.value).toBe('Cool Artist');
		expect(getField(embed, 'Duration')?.value).toBe('03:20');
		expect(getField(embed, 'Position')).toBeUndefined();
		expect(embed.data.thumbnail?.url).toBe('https://img/thumb.png');
		expect(embed.data.footer?.text).toContain('Requester');
		expect(embed.data.footer?.icon_url).toBe('https://cdn/avatar.png');
	});

	it('renders an "Added to Queue" embed with a position field when position > 1', () => {
		const embed = EmbedBuilderUtils.createPlayEmbed(makeSong(), 3);

		expect(embed.data.title).toContain('Added to Queue');
		expect(getField(embed, 'Position')?.value).toBe('#3');
	});

	it('treats position 1 as now playing (no position field)', () => {
		const embed = EmbedBuilderUtils.createPlayEmbed(makeSong(), 1);

		expect(embed.data.title).toContain('Now Playing');
		expect(getField(embed, 'Position')).toBeUndefined();
	});

	it('falls back to defaults and omits footer/thumbnail when metadata is missing', () => {
		const song = makeSong({
			name: undefined,
			url: undefined,
			uploader: undefined,
			user: undefined,
			thumbnail: undefined,
			formattedDuration: undefined,
		});

		const embed = EmbedBuilderUtils.createPlayEmbed(song);

		expect(embed.data.description).toBe('[Unknown Song]()');
		expect(getField(embed, 'Uploader')?.value).toBe(
			MusicConstants.DEFAULT_UPLOADER_NAME,
		);
		expect(getField(embed, 'Duration')?.value).toBe('00:00');
		expect(embed.data.thumbnail).toBeUndefined();
		expect(embed.data.footer).toBeUndefined();
	});
});

describe('EmbedBuilderUtils.createNowPlayingEmbed', () => {
	it('returns an error embed when the queue has no songs', () => {
		const embed = EmbedBuilderUtils.createNowPlayingEmbed(makeQueue());

		expect(embed.data.title).toContain('Error');
		expect(embed.data.description).toBe('No song is currently playing');
		expect(embed.data.color).toBe(MusicConstants.COLOR_ERROR);
	});

	it('renders duration, loop, volume and a progress bar for the current song', () => {
		const queue = makeQueue({
			songs: [makeSong()],
			formattedCurrentTime: '01:00',
			currentTime: 60,
			volume: 75,
			repeatMode: 0,
		});

		const embed = EmbedBuilderUtils.createNowPlayingEmbed(queue);

		expect(embed.data.title).toContain('Now Playing');
		expect(getField(embed, 'Duration')?.value).toBe('01:00 / 03:20');
		expect(getField(embed, 'Loop Mode')?.value).toBe('Off');
		expect(getField(embed, 'Volume')?.value).toBe('75%');
		expect(getField(embed, 'Progress')?.value).toContain('%');
		expect(embed.data.footer?.text).toContain('Requester');
	});

	it('maps repeatMode 2 to "Queue" and repeatMode 1 to "Song"', () => {
		const queueLoop = makeQueue({ songs: [makeSong()], repeatMode: 2 });
		const songLoop = makeQueue({ songs: [makeSong()], repeatMode: 1 });

		expect(
			getField(EmbedBuilderUtils.createNowPlayingEmbed(queueLoop), 'Loop Mode')
				?.value,
		).toBe('Queue');
		expect(
			getField(EmbedBuilderUtils.createNowPlayingEmbed(songLoop), 'Loop Mode')
				?.value,
		).toBe('Song');
	});
});

describe('EmbedBuilderUtils.createQueueEmbed', () => {
	it('renders the current song plus paginated up-next list', () => {
		const queue = makeQueue({
			songs: [
				makeSong({ name: 'Current', url: 'https://s/0' }),
				makeSong({ name: 'Next One', url: 'https://s/1' }),
				makeSong({ name: 'Next Two', url: 'https://s/2' }),
			],
			formattedDuration: '10:00',
			repeatMode: 0,
			volume: 60,
		});

		const embed = EmbedBuilderUtils.createQueueEmbed(queue, 1, 1);

		expect(embed.data.title).toContain('Page 1/1');
		expect(embed.data.description).toContain('Now Playing:');
		expect(embed.data.description).toContain('Current');
		expect(embed.data.description).toContain('Up Next:');
		expect(embed.data.description).toContain('Next One');
		expect(embed.data.description).toContain('Next Two');
		expect(embed.data.description).toContain('<@user-1>');
		expect(getField(embed, 'Queue Info')?.value).toContain('3 songs |');
		expect(getField(embed, 'Loop')?.value).toBe('Off');
		expect(getField(embed, 'Volume')?.value).toBe('60%');
		expect(embed.data.footer?.text).toContain('Page 1 of 1');
	});

	it('shows an empty-queue notice and singular count with a single song', () => {
		const queue = makeQueue({
			songs: [makeSong({ name: 'Only Song' })],
			formattedDuration: '03:20',
		});

		const embed = EmbedBuilderUtils.createQueueEmbed(queue, 1, 1);

		expect(embed.data.description).toContain('No songs in queue');
		expect(getField(embed, 'Queue Info')?.value).toContain('1 song |');
	});
});

describe('EmbedBuilderUtils.createErrorEmbed', () => {
	it('builds an error-colored embed with the supplied message', () => {
		const embed = EmbedBuilderUtils.createErrorEmbed('Something broke');

		expect(embed.data.title).toContain('Error');
		expect(embed.data.description).toBe('Something broke');
		expect(embed.data.color).toBe(MusicConstants.COLOR_ERROR);
	});
});

describe('EmbedBuilderUtils.createProgressBar', () => {
	it('returns an empty bar at 0% when total is non-positive', () => {
		const bar = EmbedBuilderUtils.createProgressBar(30, 0);

		expect(bar).toBe(`[${'░'.repeat(20)}] 0%`);
	});

	it('returns an empty bar at 0% when current is 0', () => {
		expect(EmbedBuilderUtils.createProgressBar(0, 100)).toBe(
			`[${'░'.repeat(20)}] 0%`,
		);
	});

	it('renders a half-filled bar for the midpoint', () => {
		expect(EmbedBuilderUtils.createProgressBar(50, 100, 10)).toBe(
			'[█████░░░░░] 50%',
		);
	});

	it('caps the bar at 100% when complete', () => {
		expect(EmbedBuilderUtils.createProgressBar(100, 100, 10)).toBe(
			'[██████████] 100%',
		);
	});

	it('uses the default 20-character length', () => {
		const bar = EmbedBuilderUtils.createProgressBar(25, 100);

		expect(bar).toBe(`[${'█'.repeat(5)}${'░'.repeat(15)}] 25%`);
	});
});

describe('EmbedBuilderUtils playlist embeds', () => {
	it('creates a playlist-saved embed with pluralized song count and load hint', () => {
		const embed = EmbedBuilderUtils.createPlaylistSavedEmbed(
			'Chill',
			5,
			'Alice',
		);

		expect(embed.data.title).toContain('Playlist Saved');
		expect(embed.data.description).toContain('Chill');
		expect(getField(embed, 'Songs')?.value).toBe('5 songs');
		expect(getField(embed, 'Owner')?.value).toBe('Alice');
		expect(embed.data.footer?.text).toContain('/playlist load Chill');
		expect(embed.data.color).toBe(MusicConstants.COLOR_SUCCESS);
	});

	it('uses a singular song label when the saved playlist has one song', () => {
		const embed = EmbedBuilderUtils.createPlaylistSavedEmbed('Solo', 1, 'Bob');

		expect(getField(embed, 'Songs')?.value).toBe('1 song');
	});

	it('creates a playlist-loaded embed describing the song count', () => {
		const embed = EmbedBuilderUtils.createPlaylistLoadedEmbed('Party', 3);

		expect(embed.data.title).toContain('Playlist Loaded');
		expect(embed.data.description).toContain('Party');
		expect(embed.data.description).toContain('3 songs');
	});

	it('creates a playlist-deleted embed naming the playlist', () => {
		const embed = EmbedBuilderUtils.createPlaylistDeletedEmbed('Old Mix');

		expect(embed.data.title).toContain('Playlist Deleted');
		expect(embed.data.description).toContain('Old Mix');
	});

	it('shows an empty-state message when the user has no playlists', () => {
		const embed = EmbedBuilderUtils.createPlaylistListEmbed([], 'Carol');

		expect(embed.data.title).toContain("Carol's Playlists");
		expect(embed.data.description).toContain('no saved playlists');
	});

	it('lists playlists with counts and a total footer', () => {
		const embed = EmbedBuilderUtils.createPlaylistListEmbed(
			[
				{ name: 'Focus', songCount: 3, updatedAt: new Date('2024-01-01') },
				{ name: 'Sleep', songCount: 1, updatedAt: new Date('2024-02-02') },
			],
			'Dave',
		);

		expect(embed.data.description).toContain('Focus');
		expect(embed.data.description).toContain('3 songs');
		expect(embed.data.description).toContain('Sleep');
		expect(embed.data.description).toContain('1 song');
		expect(embed.data.footer?.text).toContain('2 playlists total');
	});
});

describe('EmbedBuilderUtils stats embeds', () => {
	const serverStats: ServerStatsData = {
		guildId: 'g1',
		totalPlays: 42,
		topSongs: [
			{ songTitle: 'Song One', songUrl: 'https://s/1', playCount: 10 },
			{ songTitle: 'Song Two', songUrl: 'https://s/2', playCount: 5 },
		],
		topDJs: [
			{ userId: 'u1', username: 'DJ Alpha', playCount: 20 },
			{ userId: 'u2', username: 'DJ Beta', playCount: 8 },
		],
	};

	it('renders total plays, top songs and top DJs for the server', () => {
		const embed = EmbedBuilderUtils.createServerStatsEmbed(serverStats);

		expect(embed.data.title).toContain('Server Music Statistics');
		expect(getField(embed, 'Total Plays')?.value).toContain('42');
		expect(getField(embed, 'Total Plays')?.value).toContain('played');
		const topSongs = getField(embed, 'Top Songs')?.value ?? '';
		expect(topSongs).toContain('Song One');
		expect(topSongs).toContain('https://s/1');
		expect(getField(embed, 'Top DJs')?.value).toContain('DJ Alpha');
	});

	it('omits the top-songs and top-DJs fields when there is no data', () => {
		const embed = EmbedBuilderUtils.createServerStatsEmbed({
			...serverStats,
			topSongs: [],
			topDJs: [],
		});

		expect(getField(embed, 'Total Plays')).toBeDefined();
		expect(getField(embed, 'Top Songs')).toBeUndefined();
		expect(getField(embed, 'Top DJs')).toBeUndefined();
	});

	it('renders user stats with a resolved rank', () => {
		const userStats: UserStatsData = {
			guildId: 'g1',
			userId: 'u1',
			totalPlays: 7,
			topSongs: [{ songTitle: 'Fav', songUrl: 'https://f/1', playCount: 3 }],
			rank: 5,
		};

		const embed = EmbedBuilderUtils.createUserStatsEmbed(userStats, 'Erin');

		expect(embed.data.title).toContain("Erin's Music Statistics");
		expect(getField(embed, 'Total Plays')?.value).toContain('7');
		expect(getField(embed, 'Server Rank')?.value).toBe('#5');
		expect(getField(embed, 'Top Songs')?.value).toContain('Fav');
	});

	it('shows N/A rank when the user has no rank', () => {
		const embed = EmbedBuilderUtils.createUserStatsEmbed(
			{
				guildId: 'g1',
				userId: 'u1',
				totalPlays: 0,
				topSongs: [],
				rank: undefined,
			},
			'Frank',
		);

		expect(getField(embed, 'Server Rank')?.value).toBe('N/A');
	});
});

describe('EmbedBuilderUtils.createLyricsEmbed', () => {
	it('renders lyrics with an attribution footer and no pagination by default', () => {
		const embed = EmbedBuilderUtils.createLyricsEmbed(
			'My Song',
			'My Artist',
			'la la la',
		);

		expect(embed.data.title).toContain('Lyrics: My Song');
		expect(embed.data.description).toBe('la la la');
		expect(getField(embed, 'Artist')?.value).toBe('My Artist');
		expect(embed.data.thumbnail).toBeUndefined();
		expect(embed.data.footer?.text).toBe(
			'Data provided by LRCLIB (lrclib.net)',
		);
	});

	it('includes the thumbnail and pagination footer when provided', () => {
		const embed = EmbedBuilderUtils.createLyricsEmbed(
			'My Song',
			'My Artist',
			'chunk',
			'https://art/thumb.png',
			2,
			5,
		);

		expect(embed.data.thumbnail?.url).toBe('https://art/thumb.png');
		expect(embed.data.footer?.text).toContain('Page 2 of 5');
		expect(embed.data.footer?.text).toContain('LRCLIB');
	});
});
