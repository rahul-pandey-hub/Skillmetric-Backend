import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Exam, ExamCategory, ExamAccessMode } from '../modules/exams/schemas/exam.schema';

/**
 * Migration script to add category and accessMode fields to existing exams
 *
 * Run this script with: npm run migration:exam-fields
 * or: ts-node src/scripts/migrate-exam-fields.ts
 */
async function migrateExamFields() {
  console.log('Starting exam fields migration...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const examModel = app.get<Model<Exam>>(getModelToken(Exam.name));

  try {
    // Update all exams that don't have category or accessMode set
    const result = await examModel.updateMany(
      {
        $or: [
          { category: { $exists: false } },
          { accessMode: { $exists: false } },
        ],
      },
      {
        $set: {
          category: ExamCategory.GENERAL_ASSESSMENT,
          accessMode: ExamAccessMode.ENROLLMENT_BASED,
        },
      }
    );

    console.log(`Migration completed successfully!`);
    console.log(`Documents matched: ${result.matchedCount}`);
    console.log(`Documents modified: ${result.modifiedCount}`);

    // Show stats
    const totalExams = await examModel.countDocuments();
    const enrollmentBased = await examModel.countDocuments({ accessMode: ExamAccessMode.ENROLLMENT_BASED });
    const invitationBased = await examModel.countDocuments({ accessMode: ExamAccessMode.INVITATION_BASED });
    const hybrid = await examModel.countDocuments({ accessMode: ExamAccessMode.HYBRID });

    console.log('\n=== Exam Statistics ===');
    console.log(`Total exams: ${totalExams}`);
    console.log(`Enrollment-based: ${enrollmentBased}`);
    console.log(`Invitation-based: ${invitationBased}`);
    console.log(`Hybrid: ${hybrid}`);
    console.log('=======================\n');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Run the migration
migrateExamFields()
  .then(() => {
    console.log('Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script error:', error);
    process.exit(1);
  });
