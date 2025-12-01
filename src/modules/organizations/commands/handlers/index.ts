import { CreateOrganizationHandler } from './create-organization.handler';
import { UpdateOrganizationHandler } from './update-organization.handler';
import { AssignAdminHandler } from './assign-admin.handler';
import { SuspendOrganizationHandler } from './suspend-organization.handler';
import { ActivateOrganizationHandler } from './activate-organization.handler';

export const CommandHandlers = [
  CreateOrganizationHandler,
  UpdateOrganizationHandler,
  AssignAdminHandler,
  SuspendOrganizationHandler,
  ActivateOrganizationHandler,
];
