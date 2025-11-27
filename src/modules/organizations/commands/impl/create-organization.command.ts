import { CreateOrganizationDto } from '../../dto/create-organization.dto';

export class CreateOrganizationCommand {
  constructor(public readonly createOrganizationDto: CreateOrganizationDto) {}
}
