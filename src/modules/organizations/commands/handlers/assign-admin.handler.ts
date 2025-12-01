import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BadRequestException, NotFoundException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AssignAdminCommand } from '../impl/assign-admin.command';
import { Organization } from '../../schemas/organization.schema';
import { User, UserRole } from '../../../users/schemas/user.schema';
import { EmailService } from '../../../email/services/email.service';

@CommandHandler(AssignAdminCommand)
export class AssignAdminHandler implements ICommandHandler<AssignAdminCommand> {
  constructor(
    @InjectModel(Organization.name)
    private organizationModel: Model<Organization>,
    @InjectModel(User.name)
    private userModel: Model<User>,
    @Inject(forwardRef(() => EmailService))
    private emailService: EmailService,
  ) {}

  async execute(command: AssignAdminCommand) {
    const { organizationId, name, email, password } = command;

    // Check if organization exists
    const organization = await this.organizationModel.findById(organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Generate password if not provided
    const finalPassword = password || this.generateTemporaryPassword();

    // Hash password
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    // Create org admin user
    const admin = new this.userModel({
      name,
      email,
      password: hashedPassword,
      role: UserRole.ORG_ADMIN,
      organizationId: organization._id,
      isActive: true,
      emailVerified: true,
    });

    await admin.save();

    // Add admin to organization
    if (!organization.admins) {
      organization.admins = [];
    }
    organization.admins.push(admin._id as Types.ObjectId);
    await organization.save();

    // Send welcome email with credentials
    try {
      await this.emailService.queueOrgAdminWelcomeEmail({
        name: admin.name,
        email: admin.email,
        tempPassword: finalPassword,
        organizationName: organization.name,
        organizationId: organization._id.toString(),
      });
    } catch (emailError) {
      // Log error but don't fail the operation
      console.error('Failed to send org admin welcome email:', emailError);
    }

    return {
      id: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      role: admin.role,
      organizationId: admin.organizationId.toString(),
      temporaryPassword: password ? undefined : finalPassword, // Only return if auto-generated
    };
  }

  private generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
