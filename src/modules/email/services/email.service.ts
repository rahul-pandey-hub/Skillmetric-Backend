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

export interface OrgAdminWelcomeEmailData {
  name: string;
  email: string;
  tempPassword: string;
  organizationName: string;
  organizationId: string;
}

export interface ResultNotificationEmailData {
  studentId: string;
  studentName: string;
  studentEmail: string;
  examId: string;
  examTitle: string;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  rank?: number;
  percentile?: number;
  shortlisted?: boolean;
  certificateUrl?: string;
  lateSubmission?: {
    isLate: boolean;
    lateByMinutes: number;
    penaltyApplied: number;
  };
}

export interface ExamReminderEmailData {
  studentId: string;
  studentName: string;
  studentEmail: string;
  examId: string;
  examTitle: string;
  examDescription?: string;
  startDate: Date;
  duration: number; // in minutes
  reminderType: '24h' | '1h';
}

export interface ExamInvitationEmailData {
  candidateName: string;
  candidateEmail: string;
  examTitle: string;
  examDescription?: string;
  invitationToken: string;
  invitationUrl: string;
  expiresAt: Date;
  duration: number; // in minutes
  organizationName?: string;
  invitedBy?: string;
  invitationNote?: string;
}

export interface InvitationReminderEmailData {
  candidateName: string;
  candidateEmail: string;
  examTitle: string;
  invitationToken: string;
  invitationUrl: string;
  expiresAt: Date;
  hoursUntilExpiry: number;
}

export interface RecruitmentResultEmailData {
  candidateName: string;
  candidateEmail: string;
  examTitle: string;
  score?: number;
  totalMarks?: number;
  percentage?: number;
  rank?: number;
  showScore: boolean;
  showRank: boolean;
  customMessage?: string;
  organizationName?: string;
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
   * Send organization admin welcome email with credentials
   */
  async sendOrgAdminWelcomeEmail(data: OrgAdminWelcomeEmailData) {
    const { name, email, tempPassword, organizationName, organizationId } = data;

    const loginLink = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/login`;
    const dashboardLink = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/admin/dashboard`;

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
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to SkillMetric</h1>
    </div>
    <div class="content">
      <h2>Hello ${name}!</h2>
      <p>You have been assigned as an Organization Administrator for <strong>${organizationName}</strong>.</p>

      <p>Your account has been created with the following credentials:</p>

      <div class="credentials">
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Temporary Password:</strong> ${tempPassword}</p>
        <p><strong>Organization:</strong> ${organizationName}</p>
      </div>

      <div class="warning">
        <p><strong>⚠️ Important:</strong> This is a temporary password. Please change it immediately after your first login for security purposes.</p>
      </div>

      <p>As an Organization Administrator, you have access to:</p>
      <ul>
        <li>Create and manage exams</li>
        <li>Manage questions and question pools</li>
        <li>Enroll and manage students</li>
        <li>View analytics and reports</li>
        <li>Configure organization settings</li>
      </ul>

      <a href="${loginLink}" class="button">
        Login to Platform
      </a>

      <h3>Getting Started:</h3>
      <ol>
        <li>Click the login button above</li>
        <li>Enter your email and temporary password</li>
        <li>Change your password on first login</li>
        <li>Explore the admin dashboard</li>
        <li>Start creating exams and managing your organization</li>
      </ol>

      <p>If you have any questions or need assistance, please contact the SkillMetric support team.</p>

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

    const textContent = `
Welcome to SkillMetric!

Hello ${name},

You have been assigned as an Organization Administrator for ${organizationName}.

Your account credentials:
Email: ${email}
Temporary Password: ${tempPassword}
Organization: ${organizationName}

IMPORTANT: This is a temporary password. Please change it immediately after your first login.

Login URL: ${loginLink}

As an Organization Administrator, you have access to:
- Create and manage exams
- Manage questions and question pools
- Enroll and manage students
- View analytics and reports
- Configure organization settings

Getting Started:
1. Visit the platform and login
2. Enter your email and temporary password
3. Change your password on first login
4. Explore the admin dashboard
5. Start creating exams and managing your organization

If you need assistance, please contact the SkillMetric support team.

Best regards,
The SkillMetric Team
    `;

    const mailOptions = {
      from: `"SkillMetric Platform" <${this.configService.get('SMTP_FROM', this.configService.get('SMTP_USER'))}>`,
      to: email,
      subject: `Welcome to SkillMetric - Organization Administrator Access`,
      text: textContent,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Org admin welcome email sent successfully to ${email}: ${info.messageId}`);
      return info;
    } catch (error) {
      this.logger.error(`Failed to send org admin welcome email to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Queue organization admin welcome email
   */
  async queueOrgAdminWelcomeEmail(data: OrgAdminWelcomeEmailData) {
    try {
      await this.emailQueue.add('org-admin-welcome', data, {
        priority: 1, // High priority
      });
      this.logger.log(`Queued org admin welcome email for ${data.email}`);
    } catch (error) {
      this.logger.error(`Failed to queue org admin email for ${data.email}:`, error);
      throw error;
    }
  }

  /**
   * Queue result notification email
   */
  async queueResultNotificationEmail(data: ResultNotificationEmailData) {
    try {
      await this.emailQueue.add('result-notification', data, {
        priority: 1, // High priority
      });
      this.logger.log(`Queued result notification email for ${data.studentEmail}`);
    } catch (error) {
      this.logger.error(`Failed to queue result notification for ${data.studentEmail}:`, error);
      throw error;
    }
  }

  /**
   * Queue bulk result notification emails
   */
  async queueBulkResultNotificationEmails(results: ResultNotificationEmailData[]) {
    try {
      const jobs = results.map((result, index) => ({
        name: 'result-notification',
        data: result,
        opts: {
          priority: 1,
          delay: index * 100, // Stagger emails by 100ms to avoid rate limits
        },
      }));

      await this.emailQueue.addBulk(jobs);
      this.logger.log(`Queued ${results.length} result notification emails`);
    } catch (error) {
      this.logger.error('Failed to queue bulk result notifications:', error);
      throw error;
    }
  }

  /**
   * Send result notification email (called by processor)
   */
  async sendResultNotificationEmail(data: ResultNotificationEmailData) {
    const {
      studentName,
      studentEmail,
      examTitle,
      score,
      totalMarks,
      percentage,
      passed,
      rank,
      percentile,
      shortlisted,
      certificateUrl,
      lateSubmission,
      examId
    } = data;

    const resultLink = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/student/results/${examId}`;

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
      background-color: ${passed ? '#059669' : '#dc2626'};
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
    .score-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 25px;
      border-radius: 10px;
      margin: 20px 0;
      text-align: center;
    }
    .score-big {
      font-size: 48px;
      font-weight: bold;
      margin: 10px 0;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin: 20px 0;
    }
    .stat-box {
      background-color: #f5f5f5;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-label {
      color: #666;
      font-size: 14px;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #1976d2;
    }
    .status-badge {
      display: inline-block;
      padding: 8px 20px;
      border-radius: 20px;
      font-weight: bold;
      margin: 10px 0;
    }
    .passed {
      background-color: #dcfce7;
      color: #16a34a;
      border: 2px solid #16a34a;
    }
    .failed {
      background-color: #fee2e2;
      color: #dc2626;
      border: 2px solid #dc2626;
    }
    .shortlisted-box {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
      padding: 20px;
      border-radius: 10px;
      margin: 20px 0;
      text-align: center;
    }
    .late-warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 15px 0;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background-color: #1976d2;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 10px 5px;
    }
    .button-success {
      background-color: #059669;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 Your Exam Results Are Ready!</h1>
    </div>
    <div class="content">
      <h2>Hello ${studentName}!</h2>
      <p>Your results for <strong>${examTitle}</strong> have been published.</p>

      <div class="score-card">
        <div style="font-size: 18px; opacity: 0.9;">Your Score</div>
        <div class="score-big">${score} / ${totalMarks}</div>
        <div style="font-size: 24px; margin-top: 10px;">${percentage.toFixed(2)}%</div>
        <div class="status-badge ${passed ? 'passed' : 'failed'}">
          ${passed ? '✓ PASSED' : '✗ FAILED'}
        </div>
      </div>

      ${lateSubmission?.isLate ? `
      <div class="late-warning">
        <strong>⚠️ Late Submission:</strong> Your exam was submitted ${lateSubmission.lateByMinutes} minutes late.
        ${lateSubmission.penaltyApplied > 0 ? `A penalty of ${lateSubmission.penaltyApplied} marks was applied.` : ''}
      </div>
      ` : ''}

      ${(rank || percentile) ? `
      <div class="stats-grid">
        ${rank ? `
        <div class="stat-box">
          <div class="stat-label">Your Rank</div>
          <div class="stat-value">#${rank}</div>
        </div>
        ` : ''}
        ${percentile ? `
        <div class="stat-box">
          <div class="stat-label">Percentile</div>
          <div class="stat-value">${percentile.toFixed(1)}th</div>
        </div>
        ` : ''}
      </div>
      ` : ''}

      ${shortlisted ? `
      <div class="shortlisted-box">
        <h2 style="margin-top: 0;">🎉 Congratulations!</h2>
        <p style="font-size: 18px; margin: 10px 0;">You have been <strong>SHORTLISTED</strong> for the next round!</p>
        <p>You will be contacted soon with further details.</p>
      </div>
      ` : ''}

      <div style="text-align: center; margin: 30px 0;">
        <a href="${resultLink}" class="button">
          📊 View Detailed Results
        </a>
        ${certificateUrl ? `
        <a href="${certificateUrl}" class="button button-success">
          🏆 Download Certificate
        </a>
        ` : ''}
      </div>

      <p style="color: #666; font-size: 14px; margin-top: 30px;">
        ${passed ?
          'Congratulations on your success! Keep up the great work.' :
          'Don\'t be discouraged. Use this as a learning opportunity and come back stronger next time!'
        }
      </p>

      <p>If you have any questions about your results, please contact your administrator.</p>

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

    const textContent = `
Your ${examTitle} Results Are Ready!

Hello ${studentName},

Your results for ${examTitle} have been published.

YOUR SCORE: ${score} / ${totalMarks} (${percentage.toFixed(2)}%)
STATUS: ${passed ? 'PASSED ✓' : 'FAILED ✗'}
${rank ? `RANK: #${rank}` : ''}
${percentile ? `PERCENTILE: ${percentile.toFixed(1)}th` : ''}

${lateSubmission?.isLate ? `
⚠️ Late Submission: Your exam was submitted ${lateSubmission.lateByMinutes} minutes late.
${lateSubmission.penaltyApplied > 0 ? `A penalty of ${lateSubmission.penaltyApplied} marks was applied.` : ''}
` : ''}

${shortlisted ? `
🎉 CONGRATULATIONS! 🎉
You have been SHORTLISTED for the next round!
You will be contacted soon with further details.
` : ''}

View your detailed results: ${resultLink}
${certificateUrl ? `Download your certificate: ${certificateUrl}` : ''}

${passed ?
  'Congratulations on your success! Keep up the great work.' :
  'Don\'t be discouraged. Use this as a learning opportunity and come back stronger next time!'
}

If you have any questions, please contact your administrator.

Best regards,
The SkillMetric Team
    `;

    const mailOptions = {
      from: `"SkillMetric Platform" <${this.configService.get('SMTP_FROM', this.configService.get('SMTP_USER'))}>`,
      to: studentEmail,
      subject: `Your ${examTitle} Results - ${passed ? 'Congratulations!' : 'Results Available'}`,
      text: textContent,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Result notification email sent successfully to ${studentEmail}: ${info.messageId}`);
      return info;
    } catch (error) {
      this.logger.error(`Failed to send result notification email to ${studentEmail}:`, error);
      throw error;
    }
  }

  /**
   * Queue exam reminder email with delay
   */
  async queueExamReminderEmail(data: ExamReminderEmailData, delayMs: number) {
    try {
      await this.emailQueue.add('exam-reminder', data, {
        priority: 1,
        delay: delayMs,
      });
      this.logger.log(
        `Queued ${data.reminderType} reminder for ${data.studentEmail} (exam: ${data.examTitle})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue ${data.reminderType} reminder for ${data.studentEmail}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Queue bulk exam reminder emails
   */
  async queueBulkExamReminders(reminders: ExamReminderEmailData[], delayMs: number) {
    try {
      const jobs = reminders.map((reminder, index) => ({
        name: 'exam-reminder',
        data: reminder,
        opts: {
          priority: 1,
          delay: delayMs + index * 100, // Stagger by 100ms
        },
      }));

      await this.emailQueue.addBulk(jobs);
      this.logger.log(
        `Queued ${reminders.length} exam reminder emails (type: ${reminders[0]?.reminderType})`,
      );
    } catch (error) {
      this.logger.error('Failed to queue bulk exam reminders:', error);
      throw error;
    }
  }

  /**
   * Send exam reminder email (called by processor)
   */
  async sendExamReminderEmail(data: ExamReminderEmailData) {
    const {
      studentName,
      studentEmail,
      examTitle,
      examDescription,
      startDate,
      duration,
      reminderType,
      examId,
    } = data;

    const examLink = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/student/exam/${examId}`;
    const startDateFormatted = new Date(startDate).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const timeUntilExam = reminderType === '24h' ? '24 hours' : '1 hour';
    const urgencyColor = reminderType === '24h' ? '#2563eb' : '#dc2626';

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
      background-color: ${urgencyColor};
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
    .exam-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 25px;
      border-radius: 10px;
      margin: 20px 0;
    }
    .exam-detail {
      background-color: #f5f5f5;
      padding: 15px;
      border-left: 4px solid ${urgencyColor};
      margin: 15px 0;
    }
    .exam-detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .exam-detail-row:last-child {
      border-bottom: none;
    }
    .exam-detail-label {
      font-weight: bold;
      color: #666;
    }
    .exam-detail-value {
      color: #333;
    }
    .button {
      display: inline-block;
      padding: 15px 40px;
      background-color: ${urgencyColor};
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: bold;
      font-size: 16px;
    }
    .urgent-box {
      background-color: ${reminderType === '1h' ? '#fee2e2' : '#e3f2fd'};
      border-left: 4px solid ${urgencyColor};
      padding: 15px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      color: #666;
      font-size: 12px;
    }
    .checklist {
      background-color: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .checklist-item {
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .checklist-item:last-child {
      border-bottom: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${reminderType === '24h' ? '⏰ Exam Tomorrow!' : '🚨 Exam Starting Soon!'}</h1>
    </div>
    <div class="content">
      <h2>Hello ${studentName}!</h2>

      <div class="urgent-box">
        <strong>${reminderType === '24h' ? '📅' : '⚡'} Important Reminder:</strong>
        Your exam <strong>${examTitle}</strong> is starting in <strong>${timeUntilExam}</strong>!
      </div>

      ${examDescription ? `<p>${examDescription}</p>` : ''}

      <div class="exam-card">
        <h3 style="margin-top: 0;">${examTitle}</h3>
        <div style="font-size: 18px; margin: 15px 0;">
          ${reminderType === '24h' ? '📆 Starts Tomorrow' : '⏱️ Starts in 1 Hour'}
        </div>
      </div>

      <div class="exam-detail">
        <div class="exam-detail-row">
          <span class="exam-detail-label">📅 Start Date & Time:</span>
          <span class="exam-detail-value">${startDateFormatted}</span>
        </div>
        <div class="exam-detail-row">
          <span class="exam-detail-label">⏱️ Duration:</span>
          <span class="exam-detail-value">${duration} minutes</span>
        </div>
        <div class="exam-detail-row">
          <span class="exam-detail-label">🔗 Exam Link:</span>
          <span class="exam-detail-value"><a href="${examLink}">Click here to access</a></span>
        </div>
      </div>

      <div style="text-align: center;">
        <a href="${examLink}" class="button">
          ${reminderType === '24h' ? '📋 Review Exam Details' : '🚀 Start Exam Now'}
        </a>
      </div>

      <div class="checklist">
        <h3 style="margin-top: 0;">✅ Pre-Exam Checklist:</h3>
        <div class="checklist-item">☑️ Stable internet connection</div>
        <div class="checklist-item">☑️ Fully charged device or connected to power</div>
        <div class="checklist-item">☑️ Quiet environment with no distractions</div>
        <div class="checklist-item">☑️ All required materials ready</div>
        <div class="checklist-item">☑️ Updated browser (Chrome, Firefox, or Edge)</div>
        ${reminderType === '1h' ? '<div class="checklist-item">☑️ Login to the platform now!</div>' : ''}
      </div>

      <p style="color: #666; font-size: 14px; margin-top: 30px;">
        ${reminderType === '24h'
          ? 'Good luck with your preparation! We\'ll send you another reminder 1 hour before the exam starts.'
          : 'The exam is about to begin. Make sure you\'re ready and logged in. Good luck!'
        }
      </p>

      <p>If you have any technical issues, please contact support immediately.</p>

      <p>Best regards,<br>The SkillMetric Team</p>
    </div>
    <div class="footer">
      <p>This is an automated reminder email. Please do not reply to this message.</p>
      <p>&copy; ${new Date().getFullYear()} SkillMetric. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
${reminderType === '24h' ? 'EXAM TOMORROW!' : 'EXAM STARTING SOON!'}

Hello ${studentName},

Important Reminder: Your exam "${examTitle}" is starting in ${timeUntilExam}!

${examDescription ? `\n${examDescription}\n` : ''}

EXAM DETAILS:
- Start Date & Time: ${startDateFormatted}
- Duration: ${duration} minutes
- Exam Link: ${examLink}

PRE-EXAM CHECKLIST:
☑ Stable internet connection
☑ Fully charged device or connected to power
☑ Quiet environment with no distractions
☑ All required materials ready
☑ Updated browser (Chrome, Firefox, or Edge)
${reminderType === '1h' ? '☑ Login to the platform now!' : ''}

${reminderType === '24h'
  ? 'Good luck with your preparation! We\'ll send you another reminder 1 hour before the exam starts.'
  : 'The exam is about to begin. Make sure you\'re ready and logged in. Good luck!'
}

If you have any technical issues, please contact support immediately.

Best regards,
The SkillMetric Team
    `;

    const mailOptions = {
      from: `"SkillMetric Platform" <${this.configService.get('SMTP_FROM', this.configService.get('SMTP_USER'))}>`,
      to: studentEmail,
      subject: reminderType === '24h'
        ? `⏰ Reminder: ${examTitle} - Tomorrow`
        : `🚨 Final Reminder: ${examTitle} - Starting in 1 Hour!`,
      text: textContent,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Exam reminder email sent successfully to ${studentEmail}: ${info.messageId}`,
      );
      return info;
    } catch (error) {
      this.logger.error(`Failed to send exam reminder email to ${studentEmail}:`, error);
      throw error;
    }
  }

  /**
   * Queue exam invitation email
   */
  async queueExamInvitationEmail(data: ExamInvitationEmailData) {
    try {
      await this.emailQueue.add('exam-invitation', data, {
        priority: 1, // High priority
      });
      this.logger.log(`Queued invitation email for ${data.candidateEmail}`);
    } catch (error) {
      this.logger.error(`Failed to queue invitation email for ${data.candidateEmail}:`, error);
      throw error;
    }
  }

  /**
   * Queue bulk exam invitation emails
   */
  async queueBulkExamInvitations(invitations: ExamInvitationEmailData[]) {
    try {
      const jobs = invitations.map((invitation, index) => ({
        name: 'exam-invitation',
        data: invitation,
        opts: {
          priority: 1,
          delay: index * 100, // Stagger emails by 100ms to avoid rate limits
        },
      }));

      await this.emailQueue.addBulk(jobs);
      this.logger.log(`Queued ${invitations.length} invitation emails`);
    } catch (error) {
      this.logger.error('Failed to queue bulk invitation emails:', error);
      throw error;
    }
  }

  /**
   * Send exam invitation email (called by processor)
   */
  async sendExamInvitationEmail(data: ExamInvitationEmailData) {
    const {
      candidateName,
      candidateEmail,
      examTitle,
      examDescription,
      invitationUrl,
      expiresAt,
      duration,
      organizationName,
      invitedBy,
      invitationNote,
    } = data;

    const expiryDateFormatted = new Date(expiresAt).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const daysUntilExpiry = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
      border-radius: 5px 5px 0 0;
    }
    .content {
      background-color: white;
      padding: 30px;
      border-radius: 0 0 5px 5px;
    }
    .invitation-card {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
      padding: 25px;
      border-radius: 10px;
      margin: 20px 0;
      text-align: center;
    }
    .exam-details {
      background-color: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      font-weight: bold;
      color: #666;
    }
    .detail-value {
      color: #333;
    }
    .button {
      display: inline-block;
      padding: 15px 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: bold;
      font-size: 18px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .note-box {
      background-color: #e3f2fd;
      border-left: 4px solid #2196f3;
      padding: 15px;
      margin: 20px 0;
    }
    .warning-box {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      color: #666;
      font-size: 12px;
    }
    .instructions {
      background-color: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .instruction-step {
      padding: 10px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .instruction-step:last-child {
      border-bottom: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>You're Invited to Take an Assessment!</h1>
    </div>
    <div class="content">
      <h2>Hello ${candidateName}!</h2>

      ${organizationName ? `<p>You've been invited by <strong>${organizationName}</strong> to take an assessment.</p>` : ''}
      ${invitedBy ? `<p>Invited by: <strong>${invitedBy}</strong></p>` : ''}

      <div class="invitation-card">
        <h2 style="margin-top: 0;">${examTitle}</h2>
        ${examDescription ? `<p style="opacity: 0.9; font-size: 16px;">${examDescription}</p>` : ''}
      </div>

      ${invitationNote ? `
      <div class="note-box">
        <strong>Note from the recruiter:</strong>
        <p style="margin: 10px 0 0 0;">${invitationNote}</p>
      </div>
      ` : ''}

      <div class="exam-details">
        <h3 style="margin-top: 0;">Assessment Details</h3>
        <div class="detail-row">
          <span class="detail-label">Duration:</span>
          <span class="detail-value">${duration} minutes</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Invitation Expires:</span>
          <span class="detail-value">${expiryDateFormatted}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Valid For:</span>
          <span class="detail-value">${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div class="warning-box">
        <strong>⚠️ Important:</strong> This invitation link is unique to you and can only be used once. Please complete the assessment before the expiration date.
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${invitationUrl}" class="button">
          🚀 Start Assessment
        </a>
      </div>

      <div class="instructions">
        <h3 style="margin-top: 0;">How to Get Started:</h3>
        <div class="instruction-step">
          <strong>1.</strong> Click the "Start Assessment" button above
        </div>
        <div class="instruction-step">
          <strong>2.</strong> Review the assessment details and instructions
        </div>
        <div class="instruction-step">
          <strong>3.</strong> Ensure you have a stable internet connection
        </div>
        <div class="instruction-step">
          <strong>4.</strong> Complete the assessment within the time limit
        </div>
        <div class="instruction-step">
          <strong>5.</strong> Submit your responses when finished
        </div>
      </div>

      <p style="color: #666; font-size: 14px; margin-top: 30px;">
        <strong>No registration required!</strong> Simply click the link above to begin your assessment. Make sure you're in a quiet environment with a stable internet connection.
      </p>

      <p style="color: #666; font-size: 14px;">
        If you have any questions or technical issues, please contact the organization that sent you this invitation.
      </p>

      <p>Best of luck!<br>The SkillMetric Team</p>
    </div>
    <div class="footer">
      <p>This is an automated invitation email. Please do not reply to this message.</p>
      <p>If you did not expect this invitation, you can safely ignore this email.</p>
      <p>&copy; ${new Date().getFullYear()} SkillMetric. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
You're Invited to Take an Assessment!

Hello ${candidateName},

${organizationName ? `You've been invited by ${organizationName} to take an assessment.` : ''}
${invitedBy ? `Invited by: ${invitedBy}` : ''}

ASSESSMENT: ${examTitle}
${examDescription ? `\n${examDescription}\n` : ''}

${invitationNote ? `\nNote from the recruiter:\n${invitationNote}\n` : ''}

ASSESSMENT DETAILS:
- Duration: ${duration} minutes
- Invitation Expires: ${expiryDateFormatted}
- Valid For: ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}

⚠️ IMPORTANT: This invitation link is unique to you and can only be used once. Please complete the assessment before the expiration date.

START ASSESSMENT: ${invitationUrl}

HOW TO GET STARTED:
1. Click the link above
2. Review the assessment details and instructions
3. Ensure you have a stable internet connection
4. Complete the assessment within the time limit
5. Submit your responses when finished

No registration required! Simply click the link to begin your assessment. Make sure you're in a quiet environment with a stable internet connection.

If you have any questions or technical issues, please contact the organization that sent you this invitation.

Best of luck!
The SkillMetric Team

---
This is an automated invitation email. Please do not reply to this message.
If you did not expect this invitation, you can safely ignore this email.
    `;

    const mailOptions = {
      from: `"${organizationName || 'SkillMetric'}" <${this.configService.get('SMTP_FROM', this.configService.get('SMTP_USER'))}>`,
      to: candidateEmail,
      subject: `Invitation to Assessment: ${examTitle}`,
      text: textContent,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Invitation email sent successfully to ${candidateEmail}: ${info.messageId}`);
      return info;
    } catch (error) {
      this.logger.error(`Failed to send invitation email to ${candidateEmail}:`, error);
      throw error;
    }
  }

  /**
   * Queue invitation reminder email
   */
  async queueInvitationReminderEmail(data: InvitationReminderEmailData) {
    try {
      await this.emailQueue.add('invitation-reminder', data, {
        priority: 1,
      });
      this.logger.log(`Queued invitation reminder for ${data.candidateEmail}`);
    } catch (error) {
      this.logger.error(`Failed to queue invitation reminder for ${data.candidateEmail}:`, error);
      throw error;
    }
  }

  /**
   * Send invitation reminder email (called by processor)
   */
  async sendInvitationReminderEmail(data: InvitationReminderEmailData) {
    const {
      candidateName,
      candidateEmail,
      examTitle,
      invitationUrl,
      expiresAt,
      hoursUntilExpiry,
    } = data;

    const expiryDateFormatted = new Date(expiresAt).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

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
      background-color: #dc2626;
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
    .urgent-box {
      background-color: #fee2e2;
      border-left: 4px solid #dc2626;
      padding: 20px;
      margin: 20px 0;
      text-align: center;
    }
    .time-remaining {
      font-size: 36px;
      font-weight: bold;
      color: #dc2626;
      margin: 10px 0;
    }
    .button {
      display: inline-block;
      padding: 15px 40px;
      background-color: #dc2626;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: bold;
      font-size: 18px;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Assessment Invitation Expiring Soon!</h1>
    </div>
    <div class="content">
      <h2>Hello ${candidateName}!</h2>

      <div class="urgent-box">
        <p style="font-size: 18px; margin: 0;"><strong>Your invitation to take the assessment</strong></p>
        <h3 style="margin: 10px 0;">"${examTitle}"</h3>
        <p style="font-size: 16px; margin: 10px 0;">is expiring in:</p>
        <div class="time-remaining">${hoursUntilExpiry} hour${hoursUntilExpiry !== 1 ? 's' : ''}</div>
        <p style="color: #666; margin: 10px 0;">Expires on: ${expiryDateFormatted}</p>
      </div>

      <p style="font-size: 16px; color: #666;">
        This is a friendly reminder that your assessment invitation will expire soon. Don't miss this opportunity to showcase your skills!
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${invitationUrl}" class="button">
          Take Assessment Now
        </a>
      </div>

      <p style="color: #999; font-size: 14px; margin-top: 30px;">
        If you've already completed the assessment, you can ignore this reminder.
      </p>

      <p>Best regards,<br>The SkillMetric Team</p>
    </div>
    <div class="footer">
      <p>This is an automated reminder email.</p>
      <p>&copy; ${new Date().getFullYear()} SkillMetric. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
⚠️ ASSESSMENT INVITATION EXPIRING SOON!

Hello ${candidateName},

Your invitation to take the assessment "${examTitle}" is expiring in ${hoursUntilExpiry} hour${hoursUntilExpiry !== 1 ? 's' : ''}!

Expires on: ${expiryDateFormatted}

This is a friendly reminder that your assessment invitation will expire soon. Don't miss this opportunity to showcase your skills!

TAKE ASSESSMENT NOW: ${invitationUrl}

If you've already completed the assessment, you can ignore this reminder.

Best regards,
The SkillMetric Team

---
This is an automated reminder email.
    `;

    const mailOptions = {
      from: `"SkillMetric Platform" <${this.configService.get('SMTP_FROM', this.configService.get('SMTP_USER'))}>`,
      to: candidateEmail,
      subject: `⚠️ Reminder: Assessment Invitation Expiring Soon - ${examTitle}`,
      text: textContent,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Invitation reminder sent successfully to ${candidateEmail}: ${info.messageId}`);
      return info;
    } catch (error) {
      this.logger.error(`Failed to send invitation reminder to ${candidateEmail}:`, error);
      throw error;
    }
  }

  /**
   * Queue recruitment result confirmation email
   */
  async queueRecruitmentResultEmail(data: RecruitmentResultEmailData) {
    try {
      await this.emailQueue.add('recruitment-result', data, {
        priority: 1,
      });
      this.logger.log(`Queued recruitment result email for ${data.candidateEmail}`);
    } catch (error) {
      this.logger.error(`Failed to queue recruitment result for ${data.candidateEmail}:`, error);
      throw error;
    }
  }

  /**
   * Send recruitment result confirmation email (called by processor)
   */
  async sendRecruitmentResultEmail(data: RecruitmentResultEmailData) {
    const {
      candidateName,
      candidateEmail,
      examTitle,
      score,
      totalMarks,
      percentage,
      rank,
      showScore,
      showRank,
      customMessage,
      organizationName,
    } = data;

    const defaultMessage = 'Thank you for completing the assessment. Your responses have been submitted successfully and are being reviewed by our team.';
    const message = customMessage || defaultMessage;

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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
      border-radius: 5px 5px 0 0;
    }
    .content {
      background-color: white;
      padding: 30px;
      border-radius: 0 0 5px 5px;
    }
    .success-icon {
      text-align: center;
      font-size: 64px;
      margin: 20px 0;
    }
    .message-box {
      background-color: #e3f2fd;
      border-left: 4px solid #2196f3;
      padding: 20px;
      margin: 20px 0;
    }
    .score-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 25px;
      border-radius: 10px;
      margin: 20px 0;
      text-align: center;
    }
    .score-big {
      font-size: 48px;
      font-weight: bold;
      margin: 10px 0;
    }
    .stats-row {
      display: flex;
      justify-content: space-around;
      margin: 20px 0;
    }
    .stat-box {
      text-align: center;
      padding: 15px;
    }
    .stat-label {
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
    }
    .stat-value {
      font-size: 32px;
      font-weight: bold;
      color: white;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Assessment Completed Successfully!</h1>
    </div>
    <div class="content">
      <div class="success-icon">✓</div>

      <h2 style="text-align: center;">Hello ${candidateName}!</h2>

      <p style="text-align: center; font-size: 18px; color: #666;">
        Thank you for completing <strong>${examTitle}</strong>
        ${organizationName ? ` for <strong>${organizationName}</strong>` : ''}
      </p>

      <div class="message-box">
        <p style="margin: 0;">${message}</p>
      </div>

      ${showScore && score !== undefined && totalMarks !== undefined ? `
      <div class="score-card">
        <div style="font-size: 18px; opacity: 0.9;">Your Score</div>
        <div class="score-big">${score} / ${totalMarks}</div>
        ${percentage !== undefined ? `<div style="font-size: 24px; margin-top: 10px;">${percentage.toFixed(2)}%</div>` : ''}

        ${showRank && rank !== undefined ? `
        <div class="stats-row">
          <div class="stat-box">
            <div class="stat-label">Your Rank</div>
            <div class="stat-value">#${rank}</div>
          </div>
        </div>
        ` : ''}
      </div>
      ` : ''}

      <p style="color: #666; font-size: 14px; margin-top: 30px; text-align: center;">
        ${showScore ?
          'If you have any questions about your results, please contact the organization.' :
          'You will be notified if you are selected to proceed to the next stage.'
        }
      </p>

      <p style="text-align: center;">Best regards,<br>${organizationName || 'The SkillMetric Team'}</p>
    </div>
    <div class="footer">
      <p>This is an automated confirmation email.</p>
      <p>&copy; ${new Date().getFullYear()} SkillMetric. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
ASSESSMENT COMPLETED SUCCESSFULLY!

Hello ${candidateName},

Thank you for completing ${examTitle}${organizationName ? ` for ${organizationName}` : ''}

${message}

${showScore && score !== undefined && totalMarks !== undefined ? `
YOUR SCORE: ${score} / ${totalMarks}${percentage !== undefined ? ` (${percentage.toFixed(2)}%)` : ''}
${showRank && rank !== undefined ? `YOUR RANK: #${rank}` : ''}
` : ''}

${showScore ?
  'If you have any questions about your results, please contact the organization.' :
  'You will be notified if you are selected to proceed to the next stage.'
}

Best regards,
${organizationName || 'The SkillMetric Team'}

---
This is an automated confirmation email.
    `;

    const mailOptions = {
      from: `"${organizationName || 'SkillMetric'}" <${this.configService.get('SMTP_FROM', this.configService.get('SMTP_USER'))}>`,
      to: candidateEmail,
      subject: `Assessment Completed - ${examTitle}`,
      text: textContent,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Recruitment result email sent successfully to ${candidateEmail}: ${info.messageId}`);
      return info;
    } catch (error) {
      this.logger.error(`Failed to send recruitment result email to ${candidateEmail}:`, error);
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
