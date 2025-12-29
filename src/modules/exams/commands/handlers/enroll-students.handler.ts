import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { EnrollStudentsCommand } from '../impl/enroll-students.command';
import { Exam } from '../../schemas/exam.schema';
import { User, UserRole } from '../../../users/schemas/user.schema';
import { EmailService } from '../../../email/services/email.service';

@CommandHandler(EnrollStudentsCommand)
export class EnrollStudentsHandler
  implements ICommandHandler<EnrollStudentsCommand>
{
  private readonly logger = new Logger(EnrollStudentsHandler.name);

  constructor(
    @InjectModel(Exam.name) private examModel: Model<Exam>,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly emailService: EmailService,
  ) {}

  async execute(command: EnrollStudentsCommand) {
    const { examId, enrollStudentsDto, userId } = command;

    // Find exam
    const exam = await this.examModel.findById(examId);
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    // Check if exam allows enrollment-based access
    if (exam.accessMode === 'INVITATION_BASED') {
      throw new BadRequestException(
        'This exam uses invitation-based access only. Please send invitations instead of enrolling students.',
      );
    }

    // Check if user is the creator
    if (exam.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        'Only the exam creator can enroll students',
      );
    }

    const { students } = enrollStudentsDto;

    // Results tracking
    const results = {
      enrolled: [] as any[],
      alreadyEnrolled: [] as any[],
      created: [] as any[],
      errors: [] as any[],
      emailsToSend: [] as any[], // Track all emails to send
    };

    // Process each student
    for (const studentData of students) {
      try {
        // Check if user exists with this email
        let user = await this.userModel.findOne({
          email: studentData.email.toLowerCase(),
        });

        let tempPassword: string | undefined;
        let isNewUser = false;

        if (!user) {
          // Create new user with role 'student'
          // Generate a temporary password (student should reset on first login)
          tempPassword = this.generateTempPassword();
          isNewUser = true;

          // Hash the password before saving
          const hashedPassword = await bcrypt.hash(tempPassword, 10);

          user = new this.userModel({
            name: studentData.name,
            email: studentData.email.toLowerCase(),
            password: hashedPassword,
            role: UserRole.STUDENT,
            isActive: true,
          });

          await user.save();
          results.created.push({
            name: studentData.name,
            email: studentData.email,
            userId: user._id,
            tempPassword, // Send this to admin/email notification
          });
        }

        // Check if already enrolled
        if (exam.enrolledStudents.includes(user._id as any)) {
          results.alreadyEnrolled.push({
            name: studentData.name,
            email: studentData.email,
            userId: user._id,
          });
          continue;
        }

        // Enroll student
        exam.enrolledStudents.push(user._id as any);
        results.enrolled.push({
          name: studentData.name,
          email: studentData.email,
          userId: user._id,
        });

        // Add to email queue (for both new and existing users)
        results.emailsToSend.push({
          name: user.name,
          email: user.email,
          tempPassword: tempPassword, // Will be undefined for existing users
          isNewUser: isNewUser,
        });
      } catch (error) {
        console.error('Error enrolling student:', {
          name: studentData.name,
          email: studentData.email,
          error: error.message,
          stack: error.stack,
        });
        results.errors.push({
          name: studentData.name,
          email: studentData.email,
          error: error.message || 'Unknown error',
        });
      }
    }

    // Save exam
    await exam.save();

    // Queue emails for all enrolled students (both new and existing)
    if (results.emailsToSend.length > 0) {
      try {
        const emailJobs = results.emailsToSend.map((student) => ({
          name: student.name,
          email: student.email,
          tempPassword: student.tempPassword, // undefined for existing users
          examTitle: exam.title,
          examId: exam._id.toString(), // Include exam ID for direct link
          isNewUser: student.isNewUser,
        }));

        await this.emailService.queueBulkStudentWelcomeEmails(emailJobs);
        this.logger.log(
          `Queued ${results.emailsToSend.length} enrollment notification emails ` +
          `(${results.created.length} new users, ${results.enrolled.length - results.created.length} existing users)`,
        );
      } catch (error) {
        this.logger.error('Failed to queue enrollment emails:', error);
        // Don't fail the enrollment if email queueing fails
      }
    }

    // Schedule automated exam reminders (24h and 1h before exam)
    if (exam.schedule?.startDate && results.enrolled.length > 0) {
      try {
        const startDate = new Date(exam.schedule.startDate);
        const now = new Date();

        // Only schedule reminders if exam is in the future
        if (startDate > now) {
          // Get all enrolled students for reminders
          const enrolledStudentIds = results.enrolled.map((s) => s.userId);
          const enrolledStudents = await this.userModel.find({
            _id: { $in: enrolledStudentIds },
          });

          // Schedule 24-hour reminders
          const delay24h = startDate.getTime() - now.getTime() - 24 * 60 * 60 * 1000;
          if (delay24h > 0) {
            const reminders24h = enrolledStudents.map((student) => ({
              studentId: student._id.toString(),
              studentName: student.name,
              studentEmail: student.email,
              examId: exam._id.toString(),
              examTitle: exam.title,
              examDescription: exam.description,
              startDate: exam.schedule.startDate,
              duration: exam.duration,
              reminderType: '24h' as const,
            }));

            await this.emailService.queueBulkExamReminders(reminders24h, delay24h);
            this.logger.log(
              `Scheduled ${reminders24h.length} 24-hour reminder emails for exam ${exam.title}`,
            );
          }

          // Schedule 1-hour reminders
          const delay1h = startDate.getTime() - now.getTime() - 60 * 60 * 1000;
          if (delay1h > 0) {
            const reminders1h = enrolledStudents.map((student) => ({
              studentId: student._id.toString(),
              studentName: student.name,
              studentEmail: student.email,
              examId: exam._id.toString(),
              examTitle: exam.title,
              examDescription: exam.description,
              startDate: exam.schedule.startDate,
              duration: exam.duration,
              reminderType: '1h' as const,
            }));

            await this.emailService.queueBulkExamReminders(reminders1h, delay1h);
            this.logger.log(
              `Scheduled ${reminders1h.length} 1-hour reminder emails for exam ${exam.title}`,
            );
          }
        }
      } catch (error) {
        this.logger.error('Failed to schedule exam reminders:', error);
        // Don't fail the enrollment if reminder scheduling fails
      }
    }

    return {
      message: 'Student enrollment processed',
      summary: {
        total: students.length,
        enrolled: results.enrolled.length,
        alreadyEnrolled: results.alreadyEnrolled.length,
        created: results.created.length,
        errors: results.errors.length,
        emailsQueued: results.emailsToSend.length,
      },
      details: results,
    };
  }

  private generateTempPassword(): string {
    // Generate a random 8-character password
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
