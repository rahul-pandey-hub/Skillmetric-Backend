import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LoginCommand } from '../commands/impl/login.command';
import { RegisterCommand } from '../commands/impl/register.command';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  async login(@Body() loginDto: LoginDto) {
    return this.commandBus.execute(
      new LoginCommand(loginDto.email, loginDto.password),
    );
  }

  @Post('register/admin')
  @ApiOperation({ summary: 'Register admin user' })
  async registerAdmin(@Body() registerDto: RegisterDto) {
    return this.commandBus.execute(
      new RegisterCommand(
        registerDto.name,
        registerDto.email,
        registerDto.password,
        registerDto.role,
        registerDto.studentId,
      ),
    );
  }

  @Post('student/login')
  @ApiOperation({ summary: 'Student login' })
  async studentLogin(@Body() loginDto: LoginDto) {
    return this.commandBus.execute(
      new LoginCommand(loginDto.email, loginDto.password),
    );
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Request() req) {
    return req.user;
  }
}
