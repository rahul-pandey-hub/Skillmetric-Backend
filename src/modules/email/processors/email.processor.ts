import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EmailService, StudentWelcomeEmailData } from '../services/email.service';

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
}
