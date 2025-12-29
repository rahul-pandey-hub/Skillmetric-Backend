import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';

/**
 * Interceptor to log security-relevant events for audit trail
 * Logs authentication attempts, authorization failures, and sensitive operations
 */
@Injectable()
export class SecurityLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Security');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const user = (request as any).user;

    // Extract real IP if behind proxy
    const clientIp = this.getClientIp(request);

    // Log authentication and invitation access attempts
    if (this.isAuthenticationAttempt(url)) {
      this.logger.log({
        event: 'AUTH_ATTEMPT',
        method,
        url: this.sanitizeUrl(url),
        ip: clientIp,
        userAgent,
        timestamp: new Date().toISOString(),
      });
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;

        // Log successful security-sensitive operations
        if (this.isSecuritySensitive(url)) {
          this.logger.log({
            event: 'SECURITY_OPERATION_SUCCESS',
            method,
            url: this.sanitizeUrl(url),
            ip: clientIp,
            user: user?.email || 'guest',
            userId: user?.id,
            role: user?.role,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
          });
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        // Log authentication/authorization failures
        if (error.status === 401) {
          this.logger.warn({
            event: 'UNAUTHORIZED_ACCESS_ATTEMPT',
            method,
            url: this.sanitizeUrl(url),
            ip: clientIp,
            userAgent,
            error: error.message,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
          });
        } else if (error.status === 403) {
          this.logger.warn({
            event: 'FORBIDDEN_ACCESS_ATTEMPT',
            method,
            url: this.sanitizeUrl(url),
            ip: clientIp,
            user: user?.email || 'unknown',
            role: user?.role || 'none',
            error: error.message,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
          });
        } else if (error.status === 429) {
          this.logger.warn({
            event: 'RATE_LIMIT_EXCEEDED',
            method,
            url: this.sanitizeUrl(url),
            ip: clientIp,
            userAgent,
            timestamp: new Date().toISOString(),
          });
        } else if (this.isSecuritySensitive(url)) {
          // Log errors on security-sensitive endpoints
          this.logger.error({
            event: 'SECURITY_OPERATION_ERROR',
            method,
            url: this.sanitizeUrl(url),
            ip: clientIp,
            user: user?.email || 'guest',
            error: error.message,
            statusCode: error.status,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
          });
        }

        throw error;
      }),
    );
  }

  private getClientIp(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];

    if (forwardedFor) {
      const ips = (forwardedFor as string).split(',');
      return ips[0].trim();
    }

    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  private isAuthenticationAttempt(url: string): boolean {
    const authPatterns = [
      '/auth/login',
      '/auth/register',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/invitation/',
    ];
    return authPatterns.some((pattern) => url.includes(pattern));
  }

  private isSecuritySensitive(url: string): boolean {
    const sensitivePatterns = [
      '/invitation',
      '/submit',
      '/results',
      '/recruitment-results',
      '/shortlist',
      '/export',
      '/enroll',
      '/users',
      '/organizations',
      '/admin',
    ];
    return sensitivePatterns.some((pattern) => url.includes(pattern));
  }

  private sanitizeUrl(url: string): string {
    // Remove query parameters and tokens from logged URLs to prevent token leakage
    try {
      const urlObj = new URL(url, 'http://localhost');
      return urlObj.pathname;
    } catch {
      // If URL parsing fails, just return the path without query string
      return url.split('?')[0];
    }
  }
}
