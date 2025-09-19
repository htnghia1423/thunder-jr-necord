export interface CommandInfo {
	name: string;
	value: string;
	inline?: boolean;
}

export const MUSIC_COMMANDS: CommandInfo[] = [
	{
		name: '🎶 `/play <song>`',
		value:
			'Play music from URL or search keywords\n`/play song: Imagine Dragons`',
		inline: false,
	},
	{
		name: '⏭️ `/skip`',
		value: 'Skip the current song',
		inline: true,
	},
	{
		name: '⏹️ `/stop`',
		value: 'Stop playback and clear queue',
		inline: true,
	},
	{
		name: '📋 `/queue`',
		value: 'Show current music queue',
		inline: true,
	},
	{
		name: '🎵 `/nowplaying`',
		value: 'Show current song info',
		inline: true,
	},
	{
		name: '🔊 `/volume <level>`',
		value: 'Set volume (1-100)\n`/volume level: 50`',
		inline: true,
	},
	{
		name: '❌ `/remove <position|name>`',
		value: 'Remove song from queue\n`/remove position: 3`',
		inline: true,
	},
	{
		name: '🔄 `/loop [mode]`',
		value: 'Toggle loop: OFF/SONG/QUEUE\n`/loop mode: song`',
		inline: true,
	},
	{
		name: '🔀 `/shuffle`',
		value: 'Randomly shuffle queue order',
		inline: true,
	},
];

export const UTILITY_COMMANDS: CommandInfo[] = [
	{
		name: '🏓 `/ping`',
		value: 'Check bot latency and responsiveness',
		inline: true,
	},
	{
		name: '❓ `/help`',
		value: 'Show this help message',
		inline: true,
	},
];

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
