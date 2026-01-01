/**
 * Migration Script: STUDENT to CANDIDATE Role Migration
 *
 * This script migrates all data from the old STUDENT and INSTRUCTOR roles to the new structure:
 * - STUDENT → CANDIDATE
 * - INSTRUCTOR role removed (data preserved for reference)
 * - Updates all related schema fields (studentId → candidateId, enrolledStudents → enrolledCandidates)
 *
 * Run this migration AFTER deploying the new code with updated schemas.
 */

import { connect, connection } from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/skillmetric';

async function runMigration() {
  try {
    console.log('Connecting to MongoDB...');
    await connect(MONGODB_URI);
    console.log('Connected successfully\n');

    const db = connection.db;

    // ==============================================
    // STEP 1: Update User Roles
    // ==============================================
    console.log('STEP 1: Updating user roles...');

    // Count users with STUDENT role
    const studentCount = await db.collection('users').countDocuments({ role: 'STUDENT' });
    console.log(`Found ${studentCount} users with STUDENT role`);

    // Update STUDENT → CANDIDATE
    if (studentCount > 0) {
      const studentResult = await db.collection('users').updateMany(
        { role: 'STUDENT' },
        { $set: { role: 'CANDIDATE' } }
      );
      console.log(`✓ Updated ${studentResult.modifiedCount} users from STUDENT to CANDIDATE`);
    }

    // Count users with INSTRUCTOR role
    const instructorCount = await db.collection('users').countDocuments({ role: 'INSTRUCTOR' });
    console.log(`Found ${instructorCount} users with INSTRUCTOR role`);

    // Archive INSTRUCTOR users (set as inactive, preserve data)
    if (instructorCount > 0) {
      const instructorResult = await db.collection('users').updateMany(
        { role: 'INSTRUCTOR' },
        {
          $set: {
            isActive: false,
            archivedRole: 'INSTRUCTOR', // Preserve original role
            archivedAt: new Date()
          },
          $unset: { role: '' } // Remove role field
        }
      );
      console.log(`✓ Archived ${instructorResult.modifiedCount} INSTRUCTOR users\n`);
    }

    // ==============================================
    // STEP 2: Rename studentId field to candidateId in users collection
    // ==============================================
    console.log('STEP 2: Renaming studentId → candidateId in users...');

    const usersWithStudentId = await db.collection('users').countDocuments({ studentId: { $exists: true } });
    console.log(`Found ${usersWithStudentId} users with studentId field`);

    if (usersWithStudentId > 0) {
      const renameResult = await db.collection('users').updateMany(
        { studentId: { $exists: true } },
        { $rename: { studentId: 'candidateId' } }
      );
      console.log(`✓ Renamed studentId to candidateId for ${renameResult.modifiedCount} users\n`);
    }

    // ==============================================
    // STEP 3: Update Exam Schema Fields
    // ==============================================
    console.log('STEP 3: Updating exam schema fields...');

    // Rename enrolledStudents → enrolledCandidates
    const examsWithEnrolledStudents = await db.collection('exams').countDocuments({
      enrolledStudents: { $exists: true }
    });
    console.log(`Found ${examsWithEnrolledStudents} exams with enrolledStudents field`);

    if (examsWithEnrolledStudents > 0) {
      const examResult = await db.collection('exams').updateMany(
        { enrolledStudents: { $exists: true } },
        { $rename: { enrolledStudents: 'enrolledCandidates' } }
      );
      console.log(`✓ Renamed enrolledStudents to enrolledCandidates for ${examResult.modifiedCount} exams\n`);
    }

    // ==============================================
    // STEP 4: Update Results Collection
    // ==============================================
    console.log('STEP 4: Updating results collection...');

    // Rename student → candidate in results
    const resultsWithStudent = await db.collection('results').countDocuments({
      student: { $exists: true }
    });
    console.log(`Found ${resultsWithStudent} results with student field`);

    if (resultsWithStudent > 0) {
      const resultsResult = await db.collection('results').updateMany(
        { student: { $exists: true } },
        { $rename: { student: 'candidate' } }
      );
      console.log(`✓ Renamed student to candidate for ${resultsResult.modifiedCount} results\n`);
    }

    // ==============================================
    // STEP 5: Update Exam Sessions Collection
    // ==============================================
    console.log('STEP 5: Updating exam sessions collection...');

    // Rename studentId → candidateId in sessions
    const sessionsWithStudentId = await db.collection('examsessions').countDocuments({
      studentId: { $exists: true }
    });
    console.log(`Found ${sessionsWithStudentId} sessions with studentId field`);

    if (sessionsWithStudentId > 0) {
      const sessionsResult = await db.collection('examsessions').updateMany(
        { studentId: { $exists: true } },
        { $rename: { studentId: 'candidateId' } }
      );
      console.log(`✓ Renamed studentId to candidateId for ${sessionsResult.modifiedCount} sessions\n`);
    }

    // ==============================================
    // STEP 6: Update Certificates Collection
    // ==============================================
    console.log('STEP 6: Updating certificates collection...');

    // Rename studentId → candidateId in certificates
    const certificatesWithStudentId = await db.collection('certificates').countDocuments({
      studentId: { $exists: true }
    });
    console.log(`Found ${certificatesWithStudentId} certificates with studentId field`);

    if (certificatesWithStudentId > 0) {
      const certificatesResult = await db.collection('certificates').updateMany(
        { studentId: { $exists: true } },
        { $rename: { studentId: 'candidateId' } }
      );
      console.log(`✓ Renamed studentId to candidateId for ${certificatesResult.modifiedCount} certificates`);
    }

    // Rename studentName → candidateName in certificates
    const certificatesWithStudentName = await db.collection('certificates').countDocuments({
      studentName: { $exists: true }
    });
    console.log(`Found ${certificatesWithStudentName} certificates with studentName field`);

    if (certificatesWithStudentName > 0) {
      const certNamesResult = await db.collection('certificates').updateMany(
        { studentName: { $exists: true } },
        { $rename: { studentName: 'candidateName' } }
      );
      console.log(`✓ Renamed studentName to candidateName for ${certNamesResult.modifiedCount} certificates\n`);
    }

    // ==============================================
    // STEP 7: Update Violations Collection
    // ==============================================
    console.log('STEP 7: Updating violations collection...');

    // Rename student → candidate in violations
    const violationsWithStudent = await db.collection('violations').countDocuments({
      student: { $exists: true }
    });
    console.log(`Found ${violationsWithStudent} violations with student field`);

    if (violationsWithStudent > 0) {
      const violationsResult = await db.collection('violations').updateMany(
        { student: { $exists: true } },
        { $rename: { student: 'candidate' } }
      );
      console.log(`✓ Renamed student to candidate for ${violationsResult.modifiedCount} violations\n`);
    }

    // ==============================================
    // SUMMARY
    // ==============================================
    console.log('\n==============================================');
    console.log('MIGRATION COMPLETED SUCCESSFULLY');
    console.log('==============================================');
    console.log('Summary:');
    console.log(`✓ Users: ${studentCount} STUDENT → CANDIDATE`);
    console.log(`✓ Users: ${instructorCount} INSTRUCTOR archived`);
    console.log(`✓ Exams: ${examsWithEnrolledStudents} enrolledStudents → enrolledCandidates`);
    console.log(`✓ Results: ${resultsWithStudent} student → candidate`);
    console.log(`✓ Sessions: ${sessionsWithStudentId} studentId → candidateId`);
    console.log(`✓ Certificates: ${certificatesWithStudentId} updated`);
    console.log(`✓ Violations: ${violationsWithStudent} updated`);
    console.log('==============================================\n');

    await connection.close();
    console.log('Database connection closed.');
    process.exit(0);

  } catch (error) {
    console.error('Migration failed:', error);
    await connection.close();
    process.exit(1);
  }
}

// Run migration if executed directly
if (require.main === module) {
  runMigration();
}

export { runMigration };
