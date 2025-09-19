import {
	HELP_CONSTANTS,
	MUSIC_COMMAND_METADATA,
	UTILITY_COMMAND_METADATA,
} from './command-metadata';

export interface CommandInfo {
	name: string;
	value: string;
	inline?: boolean;
}

const COMMAND_ICONS = {
	play: '🎶',
	skip: '⏭️',
	stop: '⏹️',
	queue: '📋',
	nowplaying: '🎵',
	volume: '🔊',
	remove: '❌',
	loop: '🔄',
	shuffle: '🔀',
	ping: '�',
	help: '❓',
};

const formatCommandName = (
	commandName: string,
	hasParameters = false,
): string => {
	const icon = COMMAND_ICONS[commandName as keyof typeof COMMAND_ICONS] || '';
	const paramSuffix = hasParameters ? ' <...>' : '';
	return `${icon} \`/${commandName}${paramSuffix}\``;
};

export const MUSIC_COMMANDS: CommandInfo[] = Object.entries(
	MUSIC_COMMAND_METADATA,
).map(([key, metadata]) => ({
	name: formatCommandName(
		key,
		['play', 'volume', 'remove', 'loop'].includes(key),
	),
	value: metadata.helpValue || metadata.description,
	inline: metadata.inline,
}));

export const UTILITY_COMMANDS: CommandInfo[] = Object.entries(
	UTILITY_COMMAND_METADATA,
).map(([key, metadata]) => ({
	name: formatCommandName(key),
	value: metadata.helpValue || metadata.description,
	inline: metadata.inline,
}));

export { HELP_CONSTANTS };
