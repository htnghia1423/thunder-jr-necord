import { Test } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { ConfigModule } from '@nestjs/config';
import { NecordModule } from 'necord';
import { BotModule } from '@/bot.module';

describe('AppModule', () => {
  it('should compile the module', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(ConfigModule)
      .useModule({
        module: class MockConfigModule {},
        global: true,
      })
      .overrideModule(NecordModule)
      .useModule({
        module: class MockNecordModule {},
      })
      .overrideModule(BotModule)
      .useModule({
        module: class MockBotModule {},
      })
      .compile();

    expect(module).toBeDefined();
  });
});
