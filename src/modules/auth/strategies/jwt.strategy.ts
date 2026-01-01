import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { User } from '../../users/schemas/user.schema';

/**
 * Custom JWT extractor that checks both cookies and Authorization header
 * Priority: Cookie-based token (more secure) -> Authorization header (backward compatible)
 */
const cookieExtractor = (req: Request): string | null => {
  if (req && req.cookies) {
    return req.cookies['accessToken'] || null;
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private configService: ConfigService,
  ) {
    super({
      // Support both cookie-based and header-based JWT extraction
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor, // Try cookie first (more secure)
        ExtractJwt.fromAuthHeaderAsBearerToken(), // Fallback to Authorization header
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
    });
  }

  async validate(payload: any) {
    // Handle invitation-based JWT (temporary tokens for guest access)
    if (payload.type === 'INVITATION') {
      return {
        type: 'INVITATION',
        invitationId: payload.invitationId,
        examId: payload.examId,
        email: payload.candidateEmail,
        candidateName: payload.candidateName,
        isGuest: true,
      };
    }

    // Handle regular user JWT
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
      candidateId: user.candidateId,
      organizationId: defaultOrgId?.toString() || null, // Default org for backward compatibility
      organizationIds: user.organizationIds.map(id => id.toString()), // All orgs
    };
  }
}
