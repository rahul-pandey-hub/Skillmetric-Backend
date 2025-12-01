import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotFoundException } from '@nestjs/common';
import { SuspendOrganizationCommand } from '../impl/suspend-organization.command';
import { Organization, OrganizationStatus } from '../../schemas/organization.schema';

@CommandHandler(SuspendOrganizationCommand)
export class SuspendOrganizationHandler
  implements ICommandHandler<SuspendOrganizationCommand>
{
  constructor(
    @InjectModel(Organization.name)
    private organizationModel: Model<Organization>,
  ) {}

  async execute(command: SuspendOrganizationCommand) {
    const { organizationId } = command;

    const organization = await this.organizationModel.findById(organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    organization.status = OrganizationStatus.SUSPENDED;
    await organization.save();

    return {
      id: organization._id.toString(),
      name: organization.name,
      status: organization.status,
      message: 'Organization suspended successfully',
    };
  }
}
