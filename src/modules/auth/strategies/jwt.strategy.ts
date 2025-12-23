import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../../users/schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
    });
  }

  async validate(payload: any) {
    const user = await this.userModel.findById(payload.sub || payload.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    // For multi-org support: use first organization as default
    const defaultOrgId = user.organizationIds && user.organizationIds.length > 0
      ? user.organizationIds[0]
      : null;

    return {
      userId: user._id.toString(),
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      studentId: user.studentId,
      organizationId: defaultOrgId?.toString() || null, // Default org for backward compatibility
      organizationIds: user.organizationIds.map(id => id.toString()), // All orgs
    };
  }
}
