import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { MigrationController } from './controllers/migration.controller';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([]), // Using @InjectConnection() for direct DB access
  ],
  controllers: [MigrationController],
  providers: [],
  exports: [],
})
export class AdminModule {}
