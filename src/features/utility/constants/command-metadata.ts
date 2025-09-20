export interface CommandMetadata {
	name: string;
	description: string;
	helpValue?: string;
	inline?: boolean;
}

export const MUSIC_COMMAND_METADATA: Record<string, CommandMetadata> = {
	play: {
		name: 'play',
		description: 'Play music from YouTube URL or search by keywords',
		helpValue:
			'Play music from URL or search keywords\n`/play song: Imagine Dragons`',
		inline: false,
	},
	skip: {
		name: 'skip',
		description: 'Skip the current song',
		helpValue: 'Skip the current song',
		inline: true,
	},
	stop: {
		name: 'stop',
		description: 'Stop music playback and clear queue',
		helpValue: 'Stop playback and clear queue',
		inline: true,
	},
	queue: {
		name: 'queue',
		description: 'Show current music queue',
		helpValue: 'Show current music queue',
		inline: true,
	},
	nowplaying: {
		name: 'nowplaying',
		description: 'Show currently playing song information',
		helpValue: 'Show current song info',
		inline: true,
	},
	volume: {
		name: 'volume',
		description: 'Set music volume (1-100)',
		helpValue: 'Set volume (1-100)\n`/volume level: 50`',
		inline: true,
	},
	remove: {
		name: 'remove',
		description: 'Remove a song from the queue by position or name',
		helpValue: 'Remove song from queue\n`/remove position: 3`',
		inline: true,
	},
	loop: {
		name: 'loop',
		description: 'Toggle loop mode: OFF/SONG/QUEUE',
		helpValue: 'Toggle loop: OFF/SONG/QUEUE\n`/loop mode: song`',
		inline: true,
	},
	shuffle: {
		name: 'shuffle',
		description: 'Randomly shuffle the queue order',
		helpValue: 'Randomly shuffle queue order',
		inline: true,
	},
};

export const UTILITY_COMMAND_METADATA: Record<string, CommandMetadata> = {
	ping: {
		name: 'ping',
		description: "Checks the bot's latency.",
		helpValue: 'Check bot latency and responsiveness',
		inline: true,
	},
	help: {
		name: 'help',
		description: 'Show available bot commands',
		helpValue: 'Show this help message',
		inline: true,
	},
};

export const HELP_CONSTANTS = {
	COLORS: {
		MAIN: 0x0099ff,
		MUSIC: 0xff6b6b,
		UTILITY: 0x4ecdc4,
		TIPS: 0x95e1d3,
	},
	TITLES: {
		MAIN: '🤖 Thunder Jr Bot - Help Center',
		MUSIC: '🎵 Music Commands',
		UTILITY: '🛠️ Utility Commands',
		TIPS: '🔗 Important Notes & Tips',
	},
	DESCRIPTIONS: {
		MAIN: 'Welcome to Thunder Jr! Here are all available commands organized by category.',
		MUSIC: 'Control your music playbook with these commands:',
		UTILITY: 'General bot utilities and information:',
		TIPS: 'Here are some helpful tips for using the bot:',
	},
	FOOTERS: {
		MAIN: 'Use the commands below to see detailed help for each category',
		MUSIC: '💡 You must be in a voice channel to use music commands',
	},
};
