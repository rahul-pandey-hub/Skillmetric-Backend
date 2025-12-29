import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthController } from './controllers/auth.controller';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ExamInvitation, ExamInvitationSchema } from '../exams/schemas/exam-invitation.schema';
import { ExamSession, ExamSessionSchema } from '../proctoring/schemas/exam-session.schema';
import { LoginHandler } from './commands/handlers/login.handler';
import { RegisterHandler } from './commands/handlers/register.handler';
import { JwtStrategy } from './strategies/jwt.strategy';
import { InvitationJwtStrategy } from './strategies/invitation-jwt.strategy';

const CommandHandlers = [LoginHandler, RegisterHandler];

@Module({
  imports: [
    CqrsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'default-secret',
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRE') || '15m',
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ExamInvitation.name, schema: ExamInvitationSchema },
      { name: ExamSession.name, schema: ExamSessionSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [...CommandHandlers, JwtStrategy, InvitationJwtStrategy],
  exports: [JwtStrategy, PassportModule],
})
export class AuthModule {}
