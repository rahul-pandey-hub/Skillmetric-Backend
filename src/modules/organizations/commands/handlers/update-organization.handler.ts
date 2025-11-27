import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateOrganizationCommand } from '../impl/update-organization.command';
import {
  Organization,
  OrganizationDocument,
} from '../../schemas/organization.schema';
import { NotFoundException } from '@nestjs/common';

@CommandHandler(UpdateOrganizationCommand)
export class UpdateOrganizationHandler
  implements ICommandHandler<UpdateOrganizationCommand>
{
  constructor(
    @InjectModel(Organization.name)
    private organizationModel: Model<OrganizationDocument>,
  ) {}

  async execute(
    command: UpdateOrganizationCommand,
  ): Promise<OrganizationDocument> {
    const { id, updateOrganizationDto } = command;

    const updatedOrganization = await this.organizationModel.findByIdAndUpdate(
      id,
      { $set: updateOrganizationDto },
      { new: true, runValidators: true },
    );

    if (!updatedOrganization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    return updatedOrganization;
  }
}
