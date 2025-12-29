import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import * as csurf from 'csurf';
import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:3001',
        'http://localhost:3000',
        process.env.CORS_ORIGIN,
      ].filter(Boolean), // Filter out undefined/null values
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    },
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Cookie parser (required for CSRF)
  app.use(cookieParser());

  // Compression middleware
  app.use(compression());

  // Security Headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Remove unsafe-inline in production
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: [
            "'self'",
            'http://localhost:5173',
            'http://localhost:3001',
            'http://localhost:3000',
            process.env.FRONTEND_URL,
          ].filter(Boolean),
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      frameguard: {
        action: 'deny',
      },
      referrerPolicy: {
        policy: 'no-referrer-when-downgrade',
      },
      noSniff: true,
      xssFilter: true,
    }),
  );

  // CSRF Protection (enabled in production)
  if (process.env.NODE_ENV === 'production' && process.env.CSRF_ENABLED === 'true') {
    app.use(
      csurf({
        cookie: {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
        },
      }),
    );

    // Add CSRF token endpoint
    app.use('/api/v1/csrf-token', (req, res) => {
      res.json({ csrfToken: req.csrfToken() });
    });
  }

  // Global Exception Filter (for secure error handling)
  // TODO: Implement HttpExceptionFilter provider
  // const httpExceptionFilter = app.get('HttpExceptionFilter');
  // if (httpExceptionFilter) {
  //   app.useGlobalFilters(httpExceptionFilter);
  // }

  // Global Security Logger Interceptor
  // TODO: Implement SecurityLoggerInterceptor provider
  // const securityLoggerInterceptor = app.get('SecurityLoggerInterceptor');
  // if (securityLoggerInterceptor) {
  //   app.useGlobalInterceptors(securityLoggerInterceptor);
  // }

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('SkillMetric API')
    .setDescription('Exam Proctoring System API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('exams', 'Exam management endpoints')
    .addTag('proctoring', 'Proctoring endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('students', 'Student management endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
