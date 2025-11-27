import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './services/email.service';
import { EmailProcessor } from './processors/email.processor';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: 'email',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
