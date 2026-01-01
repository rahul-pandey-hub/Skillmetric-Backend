import { Controller, Post, Body, Get, UseGuards, Request, Res, Query } from '@nestjs/common';
import { Response } from 'express';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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
  @ApiQuery({
    name: 'useCookies',
    required: false,
    type: Boolean,
    description: 'Set to true to receive JWT tokens as secure httpOnly cookies'
  })
  async login(
    @Body() loginDto: LoginDto,
    @Query('useCookies') useCookies: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.commandBus.execute(
      new LoginCommand(loginDto.email, loginDto.password),
    );

    // If useCookies query param is 'true', set tokens as secure httpOnly cookies
    if (useCookies === 'true') {
      this.setAuthCookies(response, result.accessToken, result.refreshToken);

      // Return user info without tokens (tokens are in cookies)
      return {
        user: result.user,
        message: 'Login successful. Tokens set as secure cookies.',
      };
    }

    // Default: return tokens in response body (backward compatible)
    return result;
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
        registerDto.candidateId,
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

  @Post('logout')
  @ApiOperation({ summary: 'User logout (clears authentication cookies)' })
  async logout(@Res({ passthrough: true }) response: Response) {
    this.clearAuthCookies(response);
    return { message: 'Logged out successfully' };
  }

  /**
   * Set JWT tokens as secure httpOnly cookies
   * Security features:
   * - httpOnly: Prevents JavaScript access to cookies (XSS protection)
   * - secure: Only send cookies over HTTPS in production
   * - sameSite: 'strict' prevents CSRF attacks
   * - maxAge: Automatic expiration
   */
  private setAuthCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    const isProduction = process.env.NODE_ENV === 'production';

    // Access token cookie (expires in 24 hours by default)
    response.cookie('accessToken', accessToken, {
      httpOnly: true, // Prevent JavaScript access
      secure: isProduction, // HTTPS only in production
      sameSite: 'strict', // CSRF protection
      maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
      path: '/', // Available to all routes
    });

    // Refresh token cookie (expires in 7 days)
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      path: '/', // Available to all routes
    });
  }

  /**
   * Clear authentication cookies on logout
   */
  private clearAuthCookies(response: Response): void {
    const isProduction = process.env.NODE_ENV === 'production';

    response.cookie('accessToken', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    response.cookie('refreshToken', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 0, // Expire immediately
      path: '/',
    });
  }
}
