import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { OrganizationsController } from './controllers/organizations.controller';
import {
  Organization,
  OrganizationSchema,
} from './schemas/organization.schema';
import { CommandHandlers } from './commands/handlers';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
    ]),
    CqrsModule,
  ],
  controllers: [OrganizationsController],
  providers: [...CommandHandlers],
  exports: [MongooseModule],
})
export class OrganizationsModule {}
