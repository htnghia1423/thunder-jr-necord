import { createMockInteraction } from '@test/helpers/discord';

import { HelpCommand } from './help.command';

const makeInteraction = (options: Record<string, unknown> = {}): any => {
	const interaction = createMockInteraction(options);
	interaction.isChatInputCommand = jest.fn().mockReturnValue(true);
	return interaction;
};

describe('HelpCommand', () => {
	let command: HelpCommand;

	beforeEach(() => {
		command = new HelpCommand();
	});

	it('defers then replies with the four categorized help embeds', async () => {
		const interaction = makeInteraction();

		await command.execute([interaction] as any);

		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
		expect(interaction.editReply).toHaveBeenCalledTimes(1);
		const payload = interaction.editReply.mock.calls[0][0];
		expect(payload.embeds).toHaveLength(4);
		expect(payload.embeds[0].data.title).toBe(
			'🤖 Thunder Jr Bot - Help Center',
		);
		expect(payload.embeds[1].data.title).toBe('🎵 Music Commands');
		// The music embed should list the /play command as a field
		const musicFields = payload.embeds[1].data.fields;
		expect(musicFields.some((field: any) => field.name.includes('/play'))).toBe(
			true,
		);
	});

	it('does nothing for non chat-input interactions', async () => {
		const interaction = makeInteraction();
		interaction.isChatInputCommand = jest.fn().mockReturnValue(false);

		await command.execute([interaction] as any);

		expect(interaction.deferReply).not.toHaveBeenCalled();
		expect(interaction.editReply).not.toHaveBeenCalled();
	});
});
