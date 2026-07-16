import { PlaylistDuplicateAction } from '../enums/playlist-duplicate.enum';
import { createMockInteraction } from '@test/helpers/discord';
import { ComponentType } from 'discord.js';

import { PlaylistInteractionUtils } from './playlist-interaction.utils';

type FakeCollector = {
	on: jest.Mock;
	emit: (event: string, arg?: any) => void;
};

const makeCollector = (): FakeCollector => {
	const handlers: Record<string, (arg?: any) => void> = {};
	return {
		on: jest.fn((event: string, cb: (arg?: any) => void) => {
			handlers[event] = cb;
		}),
		emit: (event: string, arg?: any) => handlers[event]?.(arg),
	};
};

const makeResponse = (over: Record<string, any> = {}) => ({
	createMessageComponentCollector: jest.fn(),
	delete: jest.fn().mockResolvedValue(undefined),
	edit: jest.fn().mockResolvedValue(undefined),
	...over,
});

const makeButton = (
	customId: string,
	userId: string,
	over: Record<string, any> = {},
) => ({
	customId,
	user: { id: userId },
	deferUpdate: jest.fn().mockResolvedValue(undefined),
	...over,
});

// Drain the microtask/macrotask queue so the async waitForUserChoice body has
// progressed past `await interaction.followUp(...)` and registered its handlers.
const flush = (): Promise<void> =>
	new Promise((resolve) => setImmediate(resolve));

describe('PlaylistInteractionUtils.generateResultMessage', () => {
	it('describes ADD_ALL with duplicates and a named playlist', () => {
		const message = PlaylistInteractionUtils.generateResultMessage(
			PlaylistDuplicateAction.ADD_ALL,
			5,
			2,
			3,
			'My List',
		);

		expect(message).toContain('**My List**');
		expect(message).toContain('5 songs');
		expect(message).toContain('Including 2 duplicates');
	});

	it('falls back to the generic "playlist" label when unnamed', () => {
		const message = PlaylistInteractionUtils.generateResultMessage(
			PlaylistDuplicateAction.ADD_ALL,
			5,
			2,
			3,
		);

		expect(message).toContain('Added playlist: 5 songs');
	});

	it('describes NEW_ONLY with skipped duplicates', () => {
		const message = PlaylistInteractionUtils.generateResultMessage(
			PlaylistDuplicateAction.NEW_ONLY,
			5,
			2,
			3,
		);

		expect(message).toContain('3 new songs');
		expect(message).toContain('Skipped 2 duplicates');
	});

	it('describes CANCEL as leaving the queue unchanged', () => {
		const message = PlaylistInteractionUtils.generateResultMessage(
			PlaylistDuplicateAction.CANCEL,
			5,
			2,
			3,
		);

		expect(message).toContain('Cancelled adding playlist');
		expect(message).toContain('unchanged');
	});

	it('falls back to a plain added message for unknown actions', () => {
		const message = PlaylistInteractionUtils.generateResultMessage(
			'something_else' as PlaylistDuplicateAction,
			5,
			2,
			3,
		);

		expect(message).toBe('📋 **Added playlist: 5 songs**');
	});
});

describe('PlaylistInteractionUtils.waitForUserChoice', () => {
	it('resolves with the clicked action and cleans up the prompt', async () => {
		const collector = makeCollector();
		const response = makeResponse({
			createMessageComponentCollector: jest.fn().mockReturnValue(collector),
		});
		const interaction = createMockInteraction();
		interaction.followUp = jest.fn().mockResolvedValue(response);

		const pending = PlaylistInteractionUtils.waitForUserChoice(
			interaction as any,
		);
		await flush();

		expect(interaction.followUp).toHaveBeenCalledTimes(1);
		expect(collector.on).toHaveBeenCalledWith('collect', expect.any(Function));
		expect(collector.on).toHaveBeenCalledWith('end', expect.any(Function));

		const button = makeButton(
			`playlist_duplicate_${PlaylistDuplicateAction.NEW_ONLY}`,
			interaction.user.id,
		);
		collector.emit('collect', button);

		await expect(pending).resolves.toBe(PlaylistDuplicateAction.NEW_ONLY);
		expect(button.deferUpdate).toHaveBeenCalledTimes(1);
		expect(response.delete).toHaveBeenCalledTimes(1);
	});

	it('configures the collector with the timeout and a same-user filter', async () => {
		const collector = makeCollector();
		const response = makeResponse({
			createMessageComponentCollector: jest.fn().mockReturnValue(collector),
		});
		const interaction = createMockInteraction();
		interaction.followUp = jest.fn().mockResolvedValue(response);

		const pending = PlaylistInteractionUtils.waitForUserChoice(
			interaction as any,
			12345,
		);
		await flush();

		const followUpArg = interaction.followUp.mock.calls[0][0];
		expect(followUpArg.content).toContain('What would you like to do');
		expect(followUpArg.components).toHaveLength(1);

		const options = response.createMessageComponentCollector.mock.calls[0][0];
		expect(options.componentType).toBe(ComponentType.Button);
		expect(options.time).toBe(12345);
		expect(options.filter({ user: { id: interaction.user.id } })).toBe(true);
		expect(options.filter({ user: { id: 'someone-else' } })).toBe(false);

		// Resolve the dangling promise so the test does not leak a pending timer.
		collector.emit('end');
		await pending;
	});

	it('resolves null when the collector ends without a selection', async () => {
		const collector = makeCollector();
		const response = makeResponse({
			createMessageComponentCollector: jest.fn().mockReturnValue(collector),
		});
		const interaction = createMockInteraction();
		interaction.followUp = jest.fn().mockResolvedValue(response);

		const pending = PlaylistInteractionUtils.waitForUserChoice(
			interaction as any,
		);
		await flush();

		collector.emit('end');

		await expect(pending).resolves.toBeNull();
		expect(response.delete).toHaveBeenCalledTimes(1);
	});

	it('still resolves the action even if deferUpdate fails', async () => {
		const collector = makeCollector();
		const response = makeResponse({
			createMessageComponentCollector: jest.fn().mockReturnValue(collector),
		});
		const interaction = createMockInteraction();
		interaction.followUp = jest.fn().mockResolvedValue(response);

		const pending = PlaylistInteractionUtils.waitForUserChoice(
			interaction as any,
		);
		await flush();

		const button = makeButton(
			`playlist_duplicate_${PlaylistDuplicateAction.ADD_ALL}`,
			interaction.user.id,
			{ deferUpdate: jest.fn().mockRejectedValue(new Error('no defer')) },
		);
		collector.emit('collect', button);

		await expect(pending).resolves.toBe(PlaylistDuplicateAction.ADD_ALL);
		expect(response.delete).not.toHaveBeenCalled();
	});

	it('disables the buttons as a fallback when the message cannot be deleted', async () => {
		const collector = makeCollector();
		const response = makeResponse({
			createMessageComponentCollector: jest.fn().mockReturnValue(collector),
			delete: jest.fn().mockRejectedValue(new Error('cannot delete')),
		});
		const interaction = createMockInteraction();
		interaction.followUp = jest.fn().mockResolvedValue(response);

		const pending = PlaylistInteractionUtils.waitForUserChoice(
			interaction as any,
		);
		await flush();

		const button = makeButton(
			`playlist_duplicate_${PlaylistDuplicateAction.CANCEL}`,
			interaction.user.id,
		);
		collector.emit('collect', button);

		await expect(pending).resolves.toBe(PlaylistDuplicateAction.CANCEL);
		expect(response.delete).toHaveBeenCalledTimes(1);
		expect(response.edit).toHaveBeenCalledTimes(1);
		const editArg = response.edit.mock.calls[0][0];
		expect(editArg.content).toContain('Choice made');
		expect(editArg.components).toHaveLength(1);
	});

	it('returns null when sending the prompt throws', async () => {
		const interaction = createMockInteraction();
		interaction.followUp = jest
			.fn()
			.mockRejectedValue(new Error('missing permissions'));

		await expect(
			PlaylistInteractionUtils.waitForUserChoice(interaction as any),
		).resolves.toBeNull();
	});
});
