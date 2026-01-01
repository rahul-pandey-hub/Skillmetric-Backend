/**
 * Debug Script: Check Exam Status and Sessions
 *
 * This script checks the status of an exam to understand why results aren't showing.
 *
 * Run with: npx ts-node src/scripts/check-exam-status.ts <EXAM_ID>
 * Example: npx ts-node src/scripts/check-exam-status.ts 6954ca55a8f0fc87afe5e305
 */

import { connect, connection, Types } from 'mongoose';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { Schema } = require('mongoose');

const ExamSchema = new Schema({
  title: String,
  code: String,
  category: String,
  accessMode: String,
  enrolledCandidates: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  grading: {
    totalMarks: Number,
    passingMarks: Number,
  },
}, { timestamps: true });

const ExamSessionSchema = new Schema({
  examId: { type: Schema.Types.ObjectId, ref: 'Exam' },
  candidateId: { type: Schema.Types.ObjectId, ref: 'User' },
  invitationId: { type: Schema.Types.ObjectId, ref: 'ExamInvitation' },
  accessSource: String,
  status: String,
  startTime: Date,
  submittedAt: Date,
  score: Number,
  answers: Array,
}, { timestamps: true });

const ResultSchema = new Schema({
  exam: { type: Schema.Types.ObjectId, ref: 'Exam' },
  candidate: { type: Schema.Types.ObjectId, ref: 'User' },
  invitationId: { type: Schema.Types.ObjectId, ref: 'ExamInvitation' },
  scoring: {
    totalScore: Number,
    totalMarks: Number,
    percentage: Number,
    passed: Boolean,
  },
}, { timestamps: true });

async function checkExamStatus() {
  try {
    const examId = process.argv[2];

    if (!examId) {
      console.error('❌ Please provide an exam ID');
      console.log('Usage: npx ts-node src/scripts/check-exam-status.ts <EXAM_ID>');
      process.exit(1);
    }

    if (!Types.ObjectId.isValid(examId)) {
      console.error('❌ Invalid exam ID format');
      process.exit(1);
    }

    console.log('🔄 Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/skillmetric';
    await connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const Exam = connection.model('Exam', ExamSchema);
    const ExamSession = connection.model('ExamSession', ExamSessionSchema);
    const Result = connection.model('Result', ResultSchema);

    console.log('='.repeat(70));
    console.log(`📋 EXAM STATUS REPORT - ${examId}`);
    console.log('='.repeat(70));

    // Get exam details
    const exam = await Exam.findById(examId).exec();
    if (!exam) {
      console.log('❌ Exam not found!');
      await connection.close();
      process.exit(1);
    }

    console.log('\n📚 EXAM DETAILS:');
    console.log('-'.repeat(70));
    console.log(`Title: ${exam.title}`);
    console.log(`Code: ${exam.code}`);
    console.log(`Category: ${exam.category}`);
    console.log(`Access Mode: ${exam.accessMode || 'Not specified'}`);
    console.log(`Total Marks: ${exam.grading?.totalMarks || 'N/A'}`);
    console.log(`Passing Marks: ${exam.grading?.passingMarks || 'N/A'}`);
    console.log(`Enrolled Candidates: ${exam.enrolledCandidates?.length || 0}`);

    // Get all sessions
    const sessions = await ExamSession.find({ examId: exam._id })
      .populate('candidateId', 'name email')
      .exec();

    console.log('\n📊 EXAM SESSIONS:');
    console.log('-'.repeat(70));
    console.log(`Total Sessions: ${sessions.length}`);

    if (sessions.length === 0) {
      console.log('⚠️  No one has started this exam yet!');
    } else {
      // Group by status
      const byStatus: any = {};
      sessions.forEach(session => {
        byStatus[session.status] = (byStatus[session.status] || 0) + 1;
      });

      console.log('\nBy Status:');
      Object.entries(byStatus).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });

      // Show session details
      console.log('\nSession Details:');
      sessions.forEach((session, index) => {
        const candidate = session.candidateId as any;
        console.log(`\n  ${index + 1}. Session ID: ${session._id}`);
        console.log(`     Access: ${session.accessSource || 'ENROLLMENT'}`);
        console.log(`     Candidate: ${candidate?.name || 'N/A'} (${candidate?.email || 'N/A'})`);
        console.log(`     Candidate ID: ${session.candidateId || 'null'}`);
        console.log(`     Status: ${session.status}`);
        console.log(`     Started: ${session.startTime || 'N/A'}`);
        console.log(`     Submitted: ${session.submittedAt || 'Not submitted'}`);
        console.log(`     Score: ${session.score !== undefined ? session.score : 'Not graded'}`);
        console.log(`     Answers: ${session.answers?.length || 0}`);
      });
    }

    // Get all results
    const results = await Result.find({ exam: exam._id })
      .populate('candidate', 'name email')
      .exec();

    console.log('\n📈 RESULTS:');
    console.log('-'.repeat(70));
    console.log(`Total Results: ${results.length}`);

    if (results.length === 0) {
      console.log('❌ No results found for this exam!');

      // Check if there are completed sessions without results
      const completedSessions = sessions.filter(s =>
        s.status === 'COMPLETED' || s.status === 'AUTO_SUBMITTED'
      );

      if (completedSessions.length > 0) {
        console.log(`\n⚠️  WARNING: ${completedSessions.length} completed session(s) but no results!`);
        console.log('\nCompleted Sessions Without Results:');
        completedSessions.forEach((session, index) => {
          const candidate = session.candidateId as any;
          console.log(`\n  ${index + 1}. Session ID: ${session._id}`);
          console.log(`     Candidate: ${candidate?.name || 'Guest'} (${candidate?.email || 'N/A'})`);
          console.log(`     Candidate ID: ${session.candidateId || 'null'}`);
          console.log(`     Access Source: ${session.accessSource || 'ENROLLMENT'}`);
          console.log(`     Score in Session: ${session.score !== undefined ? session.score : 'N/A'}`);
          console.log(`     Submitted: ${session.submittedAt}`);
        });

        console.log('\n💡 RECOMMENDATION: Run the fix script to create missing results');
      }
    } else {
      console.log('\nResult Details:');
      results.forEach((result, index) => {
        const candidate = result.candidate as any;
        console.log(`\n  ${index + 1}. Result ID: ${result._id}`);
        console.log(`     Candidate: ${candidate?.name || 'Guest'} (${candidate?.email || 'N/A'})`);
        console.log(`     Score: ${result.scoring?.totalScore || 0}/${result.scoring?.totalMarks || 0}`);
        console.log(`     Percentage: ${result.scoring?.percentage?.toFixed(2) || 0}%`);
        console.log(`     Passed: ${result.scoring?.passed ? 'Yes' : 'No'}`);
      });
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 SUMMARY:');
    console.log('='.repeat(70));
    console.log(`✅ Enrolled Candidates: ${exam.enrolledCandidates?.length || 0}`);
    console.log(`📝 Sessions Created: ${sessions.length}`);
    console.log(`✅ Sessions Completed: ${sessions.filter(s => s.status === 'COMPLETED' || s.status === 'AUTO_SUBMITTED').length}`);
    console.log(`📊 Results Created: ${results.length}`);

    const mismatch = sessions.filter(s =>
      (s.status === 'COMPLETED' || s.status === 'AUTO_SUBMITTED') &&
      !results.find(r => r.candidate?.toString() === s.candidateId?.toString())
    ).length;

    if (mismatch > 0) {
      console.log(`\n⚠️  ${mismatch} completed session(s) missing results!`);
      console.log('   Run: npx ts-node src/scripts/fix-enrollment-results.ts ' + examId);
    } else if (sessions.length === 0) {
      console.log('\n💡 No students have taken this exam yet.');
    } else if (results.length === sessions.filter(s => s.status === 'COMPLETED').length) {
      console.log('\n✅ All completed sessions have results!');
    }

    console.log('='.repeat(70));

    await connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await connection.close();
    process.exit(1);
  }
}

checkExamStatus();
