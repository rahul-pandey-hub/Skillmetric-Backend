import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

export interface StudentWelcomeEmailData {
  name: string;
  email: string;
  tempPassword?: string; // Optional - only for new users
  examTitle?: string;
  examId?: string; // Exam ID for direct link
  isNewUser?: boolean; // Flag to indicate if this is a new user
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectQueue('email') private emailQueue: Queue,
    private configService: ConfigService,
  ) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpUser = this.configService.get('SMTP_USER');
    const smtpPass = this.configService.get('SMTP_PASS');

    // Log for debugging (remove password from logs)
    this.logger.log(`Initializing email with user: ${smtpUser}`);
    this.logger.log(`Password length: ${smtpPass?.length || 0} characters`);

    const emailConfig = {
      host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
      port: parseInt(this.configService.get('SMTP_PORT', '587'), 10),
      secure: false, // Use STARTTLS for port 587
      requireTLS: true, // Force TLS
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false, // Less strict for testing
        ciphers: 'SSLv3',
      },
    } as any;

    this.transporter = nodemailer.createTransport(emailConfig);

    // Verify connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error('Email service initialization failed:', error);
      } else {
        this.logger.log('Email service is ready to send emails');
      }
    });
  }

  /**
   * Queue a student welcome email with credentials
   */
  async queueStudentWelcomeEmail(data: StudentWelcomeEmailData) {
    try {
      await this.emailQueue.add('student-welcome', data, {
        priority: 1, // High priority
      });
      this.logger.log(`Queued welcome email for ${data.email}`);
    } catch (error) {
      this.logger.error(`Failed to queue email for ${data.email}:`, error);
      throw error;
    }
  }

  /**
   * Queue bulk student welcome emails
   */
  async queueBulkStudentWelcomeEmails(students: StudentWelcomeEmailData[]) {
    try {
      const jobs = students.map((student, index) => ({
        name: 'student-welcome',
        data: student,
        opts: {
          priority: 2, // Normal priority for bulk
          delay: index * 100, // Stagger emails by 100ms to avoid rate limits
        },
      }));

      await this.emailQueue.addBulk(jobs);
      this.logger.log(`Queued ${students.length} welcome emails`);
    } catch (error) {
      this.logger.error('Failed to queue bulk emails:', error);
      throw error;
    }
  }

  /**
   * Send student welcome email (called by processor)
   */
  async sendStudentWelcomeEmail(data: StudentWelcomeEmailData) {
    const { name, email, tempPassword, examTitle, examId, isNewUser } = data;

    // Different content for new vs existing users
    const isNew = isNewUser || !!tempPassword;

    // Create exam access link if examId is provided
    const examLink = examId
      ? `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/student/exam/${examId}`
      : `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/student/dashboard`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9f9f9;
    }
    .header {
      background-color: #1976d2;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 5px 5px 0 0;
    }
    .content {
      background-color: white;
      padding: 30px;
      border-radius: 0 0 5px 5px;
    }
    .credentials {
      background-color: #f5f5f5;
      padding: 15px;
      border-left: 4px solid #1976d2;
      margin: 20px 0;
    }
    .credentials strong {
      color: #1976d2;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background-color: #1976d2;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      color: #666;
      font-size: 12px;
    }
    .warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 10px;
      margin: 15px 0;
    }
    .info {
      background-color: #e3f2fd;
      border-left: 4px solid #2196f3;
      padding: 10px;
      margin: 15px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${isNew ? 'Welcome to SkillMetric' : 'New Exam Enrollment'}</h1>
    </div>
    <div class="content">
      <h2>Hello ${name}!</h2>
      ${isNew ? `
      <p>You have been enrolled in the SkillMetric exam platform. ${examTitle ? `You've been added to the exam: <strong>${examTitle}</strong>` : ''}</p>

      <p>Your account has been created with the following credentials:</p>

      <div class="credentials">
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Temporary Password:</strong> ${tempPassword}</p>
      </div>

      <div class="warning">
        <p><strong>⚠️ Important:</strong> This is a temporary password. Please change it after your first login for security purposes.</p>
      </div>
      ` : `
      <p>Great news! You've been enrolled in a new exam: <strong>${examTitle || 'an upcoming exam'}</strong></p>

      <div class="info">
        <p><strong>ℹ️ Note:</strong> You can login with your existing credentials to access this exam.</p>
      </div>

      <p>Your login email is: <strong>${email}</strong></p>
      `}

      <p>You can now login to the platform and access your exam${examTitle ? ': ' + examTitle : 's'}.</p>

      ${examId ? `
      <a href="${examLink}" class="button">
        Access Exam Now
      </a>
      ` : `
      <a href="${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/login" class="button">
        Login to Platform
      </a>
      `}

      ${isNew ? `
      <h3>Getting Started:</h3>
      <ol>
        <li>Click the login button above or visit the platform</li>
        <li>Enter your email and temporary password</li>
        <li>Change your password on first login</li>
        <li>Access your enrolled exams</li>
      </ol>
      ` : ''}

      <p>If you have any questions or need assistance, please contact your administrator.</p>

      <p>Best regards,<br>The SkillMetric Team</p>
    </div>
    <div class="footer">
      <p>This is an automated email. Please do not reply to this message.</p>
      <p>&copy; ${new Date().getFullYear()} SkillMetric. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = isNew ? `
Welcome to SkillMetric!

Hello ${name},

You have been enrolled in the exam platform. ${examTitle ? `You've been added to the exam: ${examTitle}` : ''}

Your account credentials:
Email: ${email}
Temporary Password: ${tempPassword}

IMPORTANT: This is a temporary password. Please change it after your first login.

${examId ? `Access Exam URL: ${examLink}` : `Login URL: ${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/login`}

Getting Started:
1. Visit the platform and login
2. Enter your email and temporary password
3. Change your password on first login
4. Access your enrolled exams

If you need assistance, please contact your administrator.

Best regards,
The SkillMetric Team
    ` : `
New Exam Enrollment

Hello ${name},

Great news! You've been enrolled in a new exam: ${examTitle || 'an upcoming exam'}

You can login with your existing credentials to access this exam.

Your login email: ${email}

${examId ? `Access Exam URL: ${examLink}` : `Login URL: ${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/login`}

If you need assistance, please contact your administrator.

Best regards,
The SkillMetric Team
    `;

    const mailOptions = {
      from: `"SkillMetric Platform" <${this.configService.get('SMTP_FROM', this.configService.get('SMTP_USER'))}>`,
      to: email,
      subject: isNew
        ? (examTitle ? `Welcome to SkillMetric - ${examTitle}` : 'Welcome to SkillMetric - Your Account Credentials')
        : `New Exam Enrollment - ${examTitle || 'SkillMetric'}`,
      text: textContent,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully to ${email}: ${info.messageId}`);
      return info;
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const waiting = await this.emailQueue.getWaitingCount();
    const active = await this.emailQueue.getActiveCount();
    const completed = await this.emailQueue.getCompletedCount();
    const failed = await this.emailQueue.getFailedCount();

    return {
      waiting,
      active,
      completed,
      failed,
    };
  }
}
