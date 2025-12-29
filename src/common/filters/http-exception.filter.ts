import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter that handles all exceptions
 * Sanitizes error messages in production and logs details server-side
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    // Get detailed error information
    const errorResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    // Extract user information if available
    const user = (request as any).user;

    // Log full error details server-side
    this.logger.error({
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      status,
      message,
      error: errorResponse,
      stack: exception instanceof Error ? exception.stack : undefined,
      user: user?.email || 'unauthenticated',
      ip: this.getClientIp(request),
      userAgent: request.headers['user-agent'],
    });

    // Determine if we should show detailed errors
    const isProduction = process.env.NODE_ENV === 'production';

    // Send sanitized error to client
    const clientResponse = this.buildClientResponse(
      status,
      message,
      errorResponse,
      isProduction,
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...clientResponse,
    });
  }

  private buildClientResponse(
    status: number,
    message: string,
    errorResponse: any,
    isProduction: boolean,
  ) {
    // In production, send generic messages for server errors
    if (isProduction && status >= 500) {
      return {
        message: 'An unexpected error occurred. Please try again later.',
        error: 'Internal Server Error',
      };
    }

    // For client errors (4xx), we can be more specific
    if (typeof errorResponse === 'object') {
      return {
        message: errorResponse.message || message,
        error: errorResponse.error,
        details: errorResponse.details,
      };
    }

    return {
      message,
    };
  }

  private getClientIp(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];

    if (forwardedFor) {
      const ips = (forwardedFor as string).split(',');
      return ips[0].trim();
    }

    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
