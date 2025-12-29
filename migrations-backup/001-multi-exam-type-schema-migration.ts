import { Connection } from 'mongoose';
import { UserRole } from '../modules/users/schemas/user.schema';
import { ExamCategory, ExamAccessMode } from '../modules/exams/schemas/exam.schema';

/**
 * Migration: Multi-Exam Type Schema Updates
 *
 * This migration adds support for three exam types (Internal, Recruitment, Registered)
 * and simplifies user roles from 7 to 3 primary roles.
 *
 * Changes:
 * 1. Add default values for new Exam fields (category, accessMode)
 * 2. Migrate deprecated user roles to new roles
 * 3. Add default values for new User fields
 * 4. Ensure all schemas have proper default values
 */

export async function up(connection: Connection): Promise<void> {
  console.log('Starting multi-exam type schema migration...');

  // Get collections
  const userCollection = connection.collection('users');
  const examCollection = connection.collection('exams');
  const examSessionCollection = connection.collection('examsessions');
  const resultCollection = connection.collection('results');

  // ============================================
  // 1. MIGRATE USER ROLES
  // ============================================
  console.log('Migrating user roles...');

  const roleMigrations = {
    INSTRUCTOR: UserRole.ORG_ADMIN,
    ADMIN: UserRole.ORG_ADMIN,
    STUDENT: UserRole.CANDIDATE,
    PROCTOR: UserRole.ORG_ADMIN,
  };

  let totalUsersMigrated = 0;

  for (const [oldRole, newRole] of Object.entries(roleMigrations)) {
    const result = await userCollection.updateMany(
      { role: oldRole },
      {
        $set: { role: newRole },
        $push: {
          roleHistory: {
            previousRole: oldRole,
            newRole: newRole,
            changedAt: new Date(),
            changedBy: null, // System migration
            reason: 'Automatic role migration to simplified role structure',
          },
        },
      }
    );

    console.log(`  - Migrated ${result.modifiedCount} users from ${oldRole} to ${newRole}`);
    totalUsersMigrated += result.modifiedCount;
  }

  console.log(`Total users migrated: ${totalUsersMigrated}`);

  // Initialize roleHistory for users who don't have it
  await userCollection.updateMany(
    { roleHistory: { $exists: false } },
    { $set: { roleHistory: [] } }
  );

  // ============================================
  // 2. UPDATE EXAM SCHEMA
  // ============================================
  console.log('Updating exam documents with new fields...');

  const examUpdateResult = await examCollection.updateMany(
    {
      $or: [
        { category: { $exists: false } },
        { accessMode: { $exists: false } }
      ]
    },
    {
      $set: {
        category: ExamCategory.GENERAL_ASSESSMENT,
        accessMode: ExamAccessMode.ENROLLMENT_BASED,
      },
    }
  );

  console.log(`  - Updated ${examUpdateResult.modifiedCount} exams with default category and accessMode`);

  // ============================================
  // 3. UPDATE EXAM SESSION SCHEMA
  // ============================================
  console.log('Updating exam session documents...');

  // Set accessSource to 'ENROLLMENT' for all existing sessions
  const sessionUpdateResult = await examSessionCollection.updateMany(
    { accessSource: { $exists: false } },
    { $set: { accessSource: 'ENROLLMENT' } }
  );

  console.log(`  - Updated ${sessionUpdateResult.modifiedCount} exam sessions with accessSource`);

  // ============================================
  // 4. UPDATE RESULT SCHEMA
  // ============================================
  console.log('Updating result documents...');

  const resultUpdateResult = await resultCollection.updateMany(
    {
      $or: [
        { visibleToCandidate: { $exists: false } },
        { isRecruitmentExam: { $exists: false } }
      ]
    },
    {
      $set: {
        visibleToCandidate: true,
        isRecruitmentExam: false,
      },
    }
  );

  console.log(`  - Updated ${resultUpdateResult.modifiedCount} results with default visibility settings`);

  // ============================================
  // 5. CREATE NEW INDEXES
  // ============================================
  console.log('Creating new indexes...');

  // Exam indexes
  try {
    await examCollection.createIndex({ category: 1, organizationId: 1 });
    await examCollection.createIndex({ accessMode: 1 });
    console.log('  - Created Exam indexes');
  } catch (error) {
    console.log('  - Exam indexes may already exist:', error.message);
  }

  // ExamSession indexes
  try {
    await examSessionCollection.createIndex({ invitationId: 1 });
    await examSessionCollection.createIndex({ accessSource: 1 });
    await examSessionCollection.createIndex({ 'guestCandidateInfo.email': 1 });
    console.log('  - Created ExamSession indexes');
  } catch (error) {
    console.log('  - ExamSession indexes may already exist:', error.message);
  }

  // Result indexes - Drop old unique index first
  try {
    // Try to drop old unique index
    await resultCollection.dropIndex('exam_1_student_1_attemptNumber_1');
    console.log('  - Dropped old Result unique index');
  } catch (error) {
    console.log('  - Old Result index may not exist:', error.message);
  }

  // Create new partial indexes
  try {
    // Unique constraint for enrollment-based results
    await resultCollection.createIndex(
      { exam: 1, student: 1, attemptNumber: 1 },
      {
        unique: true,
        partialFilterExpression: { student: { $exists: true, $ne: null } },
      }
    );
    console.log('  - Created Result index for enrollment-based results');

    // Unique constraint for invitation-based results
    await resultCollection.createIndex(
      { exam: 1, invitationId: 1, attemptNumber: 1 },
      {
        unique: true,
        partialFilterExpression: { invitationId: { $exists: true, $ne: null } },
      }
    );
    console.log('  - Created Result index for invitation-based results');

    // Other new indexes
    await resultCollection.createIndex({ invitationId: 1 });
    await resultCollection.createIndex({ 'guestCandidateInfo.email': 1 });
    await resultCollection.createIndex({ isRecruitmentExam: 1, exam: 1 });
    await resultCollection.createIndex({ exam: 1, 'shortlistingDecision.isShortlisted': 1 });
    console.log('  - Created additional Result indexes');
  } catch (error) {
    console.log('  - Result indexes may already exist:', error.message);
  }

  console.log('Migration completed successfully!');
}

export async function down(connection: Connection): Promise<void> {
  console.log('Rolling back multi-exam type schema migration...');

  const userCollection = connection.collection('users');
  const examCollection = connection.collection('exams');
  const examSessionCollection = connection.collection('examsessions');
  const resultCollection = connection.collection('results');

  // ============================================
  // 1. ROLLBACK USER ROLES (use roleHistory)
  // ============================================
  console.log('Rolling back user roles...');

  // This is complex because we need to look at roleHistory
  // For now, we'll just log that manual intervention may be needed
  console.log('  - WARNING: Role rollback requires manual review of roleHistory');
  console.log('  - Consider restoring from backup if needed');

  // ============================================
  // 2. REMOVE NEW EXAM FIELDS
  // ============================================
  console.log('Removing new exam fields...');

  await examCollection.updateMany(
    {},
    {
      $unset: {
        category: '',
        accessMode: '',
        invitationSettings: '',
        recruitmentResultSettings: '',
      },
    }
  );

  // ============================================
  // 3. REMOVE NEW EXAM SESSION FIELDS
  // ============================================
  console.log('Removing new exam session fields...');

  await examSessionCollection.updateMany(
    {},
    {
      $unset: {
        accessSource: '',
        invitationId: '',
        guestCandidateInfo: '',
      },
    }
  );

  // Make studentId required again (can't enforce in migration, needs schema change)
  console.log('  - NOTE: studentId required constraint needs schema update');

  // ============================================
  // 4. REMOVE NEW RESULT FIELDS
  // ============================================
  console.log('Removing new result fields...');

  await resultCollection.updateMany(
    {},
    {
      $unset: {
        invitationId: '',
        guestCandidateInfo: '',
        visibleToCandidate: '',
        isRecruitmentExam: '',
        shortlistingDecision: '',
      },
    }
  );

  // ============================================
  // 5. RESTORE OLD INDEXES
  // ============================================
  console.log('Restoring old indexes...');

  // Drop new Result indexes
  try {
    await resultCollection.dropIndex({ exam: 1, student: 1, attemptNumber: 1 });
    await resultCollection.dropIndex({ exam: 1, invitationId: 1, attemptNumber: 1 });
  } catch (error) {
    console.log('  - Could not drop new indexes:', error.message);
  }

  // Recreate old unique index
  try {
    await resultCollection.createIndex(
      { exam: 1, student: 1, attemptNumber: 1 },
      { unique: true }
    );
    console.log('  - Restored old Result unique index');
  } catch (error) {
    console.log('  - Could not restore old index:', error.message);
  }

  console.log('Rollback completed!');
  console.log('NOTE: Some changes require schema updates and manual verification');
}
