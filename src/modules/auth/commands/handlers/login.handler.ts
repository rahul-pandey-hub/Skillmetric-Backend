import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { LoginCommand } from '../impl/login.command';
import { User } from '../../../users/schemas/user.schema';

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
  ) {}

  async execute(command: LoginCommand) {
    const { email, password } = command;

    // Find user
    const user = await this.userModel.findOne({ email, isActive: true });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    // For multi-org support: use first organization as default, or null if none
    const defaultOrgId = user.organizationIds && user.organizationIds.length > 0
      ? user.organizationIds[0]
      : null;

    const payload = {
      sub: user._id,
      userId: user._id,
      email: user.email,
      role: user.role,
      organizationId: defaultOrgId, // Default org for backward compatibility
      organizationIds: user.organizationIds, // Full list of orgs
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      user: {
        id: user._id,
        fullName: user.name,
        email: user.email,
        role: user.role,
        candidateId: user.candidateId,
        organizationId: defaultOrgId?.toString(), // Default org
        organizationIds: user.organizationIds.map(id => id.toString()), // All orgs
      },
      accessToken,
      refreshToken,
    };
  }
}
