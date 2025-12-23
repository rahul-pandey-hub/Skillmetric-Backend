import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
  EmailService,
  StudentWelcomeEmailData,
  OrgAdminWelcomeEmailData,
  ResultNotificationEmailData,
  ExamReminderEmailData
} from '../services/email.service';

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {}

  @Process('student-welcome')
  async handleStudentWelcomeEmail(job: Job<StudentWelcomeEmailData>) {
    this.logger.log(
      `Processing student welcome email job ${job.id} for ${job.data.email}`,
    );

    try {
      await this.emailService.sendStudentWelcomeEmail(job.data);
      this.logger.log(
        `Successfully sent welcome email to ${job.data.email} (Job ${job.id})`,
      );
      return { success: true, email: job.data.email };
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${job.data.email} (Job ${job.id}):`,
        error,
      );
      throw error; // This will trigger retry logic
    }
  }

  @Process('org-admin-welcome')
  async handleOrgAdminWelcomeEmail(job: Job<OrgAdminWelcomeEmailData>) {
    this.logger.log(
      `Processing org admin welcome email job ${job.id} for ${job.data.email}`,
    );

    try {
      await this.emailService.sendOrgAdminWelcomeEmail(job.data);
      this.logger.log(
        `Successfully sent org admin welcome email to ${job.data.email} (Job ${job.id})`,
      );
      return { success: true, email: job.data.email };
    } catch (error) {
      this.logger.error(
        `Failed to send org admin email to ${job.data.email} (Job ${job.id}):`,
        error,
      );
      throw error; // This will trigger retry logic
    }
  }

  @Process('result-notification')
  async handleResultNotificationEmail(job: Job<ResultNotificationEmailData>) {
    this.logger.log(
      `Processing result notification email job ${job.id} for ${job.data.studentEmail}`,
    );

    try {
      await this.emailService.sendResultNotificationEmail(job.data);
      this.logger.log(
        `Successfully sent result notification to ${job.data.studentEmail} (Job ${job.id})`,
      );
      return { success: true, email: job.data.studentEmail };
    } catch (error) {
      this.logger.error(
        `Failed to send result notification to ${job.data.studentEmail} (Job ${job.id}):`,
        error,
      );
      throw error; // This will trigger retry logic
    }
  }

  @Process('exam-reminder')
  async handleExamReminderEmail(job: Job<ExamReminderEmailData>) {
    this.logger.log(
      `Processing ${job.data.reminderType} exam reminder email job ${job.id} for ${job.data.studentEmail}`,
    );

    try {
      await this.emailService.sendExamReminderEmail(job.data);
      this.logger.log(
        `Successfully sent ${job.data.reminderType} exam reminder to ${job.data.studentEmail} (Job ${job.id})`,
      );
      return { success: true, email: job.data.studentEmail, reminderType: job.data.reminderType };
    } catch (error) {
      this.logger.error(
        `Failed to send exam reminder to ${job.data.studentEmail} (Job ${job.id}):`,
        error,
      );
      throw error; // This will trigger retry logic
    }
  }
}
