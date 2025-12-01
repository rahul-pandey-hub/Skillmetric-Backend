import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotFoundException } from '@nestjs/common';
import { ActivateOrganizationCommand } from '../impl/activate-organization.command';
import { Organization, OrganizationStatus } from '../../schemas/organization.schema';

@CommandHandler(ActivateOrganizationCommand)
export class ActivateOrganizationHandler
  implements ICommandHandler<ActivateOrganizationCommand>
{
  constructor(
    @InjectModel(Organization.name)
    private organizationModel: Model<Organization>,
  ) {}

  async execute(command: ActivateOrganizationCommand) {
    const { organizationId } = command;

    const organization = await this.organizationModel.findById(organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    organization.status = OrganizationStatus.ACTIVE;
    await organization.save();

    return {
      id: organization._id.toString(),
      name: organization.name,
      status: organization.status,
      message: 'Organization activated successfully',
    };
  }
}
