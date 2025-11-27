import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateOrganizationCommand } from '../impl/create-organization.command';
import {
  Organization,
  OrganizationDocument,
} from '../../schemas/organization.schema';
import { ConflictException } from '@nestjs/common';

@CommandHandler(CreateOrganizationCommand)
export class CreateOrganizationHandler
  implements ICommandHandler<CreateOrganizationCommand>
{
  constructor(
    @InjectModel(Organization.name)
    private organizationModel: Model<OrganizationDocument>,
  ) {}

  async execute(
    command: CreateOrganizationCommand,
  ): Promise<OrganizationDocument> {
    const { createOrganizationDto } = command;

    // Check if organization with same email already exists
    const existingOrg = await this.organizationModel.findOne({
      'contactInfo.email': createOrganizationDto.contactInfo.email,
    });

    if (existingOrg) {
      throw new ConflictException(
        'Organization with this email already exists',
      );
    }

    const newOrganization = new this.organizationModel(createOrganizationDto);
    return await newOrganization.save();
  }
}
