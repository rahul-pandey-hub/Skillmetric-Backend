import { UpdateOrganizationDto } from '../../dto/update-organization.dto';

export class UpdateOrganizationCommand {
  constructor(
    public readonly id: string,
    public readonly updateOrganizationDto: UpdateOrganizationDto,
  ) {}
}
