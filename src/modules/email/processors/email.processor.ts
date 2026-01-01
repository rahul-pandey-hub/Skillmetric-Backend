import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
  EmailService,
  CandidateWelcomeEmailData,
  OrgAdminWelcomeEmailData,
  ResultNotificationEmailData,
  ExamReminderEmailData,
  ExamInvitationEmailData,
  InvitationReminderEmailData,
  RecruitmentResultEmailData,
} from '../services/email.service';

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {}

  @Process('candidate-welcome')
  async handleCandidateWelcomeEmail(job: Job<CandidateWelcomeEmailData>) {
    this.logger.log(
      `Processing candidate welcome email job ${job.id} for ${job.data.email}`,
    );

    try {
      await this.emailService.sendCandidateWelcomeEmail(job.data);
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
      `Processing result notification email job ${job.id} for ${job.data.candidateEmail}`,
    );

    try {
      await this.emailService.sendResultNotificationEmail(job.data);
      this.logger.log(
        `Successfully sent result notification to ${job.data.candidateEmail} (Job ${job.id})`,
      );
      return { success: true, email: job.data.candidateEmail };
    } catch (error) {
      this.logger.error(
        `Failed to send result notification to ${job.data.candidateEmail} (Job ${job.id}):`,
        error,
      );
      throw error; // This will trigger retry logic
    }
  }

  @Process('exam-reminder')
  async handleExamReminderEmail(job: Job<ExamReminderEmailData>) {
    this.logger.log(
      `Processing ${job.data.reminderType} exam reminder email job ${job.id} for ${job.data.candidateEmail}`,
    );

    try {
      await this.emailService.sendExamReminderEmail(job.data);
      this.logger.log(
        `Successfully sent ${job.data.reminderType} exam reminder to ${job.data.candidateEmail} (Job ${job.id})`,
      );
      return { success: true, email: job.data.candidateEmail, reminderType: job.data.reminderType };
    } catch (error) {
      this.logger.error(
        `Failed to send exam reminder to ${job.data.candidateEmail} (Job ${job.id}):`,
        error,
      );
      throw error; // This will trigger retry logic
    }
  }

  @Process('exam-invitation')
  async handleExamInvitationEmail(job: Job<ExamInvitationEmailData>) {
    this.logger.log(
      `Processing exam invitation email job ${job.id} for ${job.data.candidateEmail}`,
    );

    try {
      await this.emailService.sendExamInvitationEmail(job.data);
      this.logger.log(
        `Successfully sent exam invitation to ${job.data.candidateEmail} (Job ${job.id})`,
      );
      return { success: true, email: job.data.candidateEmail };
    } catch (error) {
      this.logger.error(
        `Failed to send exam invitation to ${job.data.candidateEmail} (Job ${job.id}):`,
        error,
      );
      throw error; // This will trigger retry logic
    }
  }

  @Process('invitation-reminder')
  async handleInvitationReminderEmail(job: Job<InvitationReminderEmailData>) {
    this.logger.log(
      `Processing invitation reminder email job ${job.id} for ${job.data.candidateEmail}`,
    );

    try {
      await this.emailService.sendInvitationReminderEmail(job.data);
      this.logger.log(
        `Successfully sent invitation reminder to ${job.data.candidateEmail} (Job ${job.id})`,
      );
      return { success: true, email: job.data.candidateEmail };
    } catch (error) {
      this.logger.error(
        `Failed to send invitation reminder to ${job.data.candidateEmail} (Job ${job.id}):`,
        error,
      );
      throw error; // This will trigger retry logic
    }
  }

  @Process('recruitment-result')
  async handleRecruitmentResultEmail(job: Job<RecruitmentResultEmailData>) {
    this.logger.log(
      `Processing recruitment result email job ${job.id} for ${job.data.candidateEmail}`,
    );

    try {
      await this.emailService.sendRecruitmentResultEmail(job.data);
      this.logger.log(
        `Successfully sent recruitment result confirmation to ${job.data.candidateEmail} (Job ${job.id})`,
      );
      return { success: true, email: job.data.candidateEmail };
    } catch (error) {
      this.logger.error(
        `Failed to send recruitment result to ${job.data.candidateEmail} (Job ${job.id}):`,
        error,
      );
      throw error; // This will trigger retry logic
    }
  }
}
