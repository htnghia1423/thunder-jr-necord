import { PrismaService } from './prisma.service';

describe('PrismaService.cleanDatabase', () => {
	const originalNodeEnv = process.env.NODE_ENV;

	afterEach(() => {
		if (originalNodeEnv === undefined) {
			delete process.env.NODE_ENV;
		} else {
			process.env.NODE_ENV = originalNodeEnv;
		}
	});

	it('constructs without connecting to a database', () => {
		expect(() => new PrismaService()).not.toThrow();
	});

	it('refuses to clean the database when NODE_ENV is production', async () => {
		process.env.NODE_ENV = 'production';
		const service = new PrismaService();

		await expect(service.cleanDatabase()).rejects.toThrow(
			'Deleting the database in production is not allowed!',
		);
	});

	it('throws the production guard before touching any model', async () => {
		process.env.NODE_ENV = 'production';
		const service = new PrismaService();

		// Spy on Reflect.ownKeys to prove the guard short-circuits before the
		// service ever enumerates models to call deleteMany on.
		const ownKeysSpy = jest.spyOn(Reflect, 'ownKeys');

		await expect(service.cleanDatabase()).rejects.toBeInstanceOf(Error);
		expect(ownKeysSpy).not.toHaveBeenCalled();

		ownKeysSpy.mockRestore();
	});
});
