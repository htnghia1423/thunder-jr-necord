import { Logger } from '@nestjs/common';

import { BotGateway } from './bot.gateway';

describe('BotGateway.onReady', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('logs the connected bot username taken from the ready event payload', () => {
		const logSpy = jest
			.spyOn(Logger.prototype, 'log')
			.mockImplementation(() => undefined);
		const gateway = new BotGateway();

		gateway.onReady([{ user: { username: 'ThunderBot' } }] as any);

		expect(logSpy).toHaveBeenCalledTimes(1);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ThunderBot'));
	});

	it('does not throw when the ready client has no user', () => {
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		const gateway = new BotGateway();

		expect(() => gateway.onReady([{ user: null }] as any)).not.toThrow();
	});
});
