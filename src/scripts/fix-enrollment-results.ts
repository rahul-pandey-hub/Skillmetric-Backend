/**
 * Migration Script: Fix Missing Results for Enrollment-Based Exams
 *
 * This script creates Result documents for enrollment-based exam submissions
 * that are missing results.
 *
 * Run with: npx ts-node src/scripts/fix-enrollment-results.ts [EXAM_ID]
 * If no EXAM_ID provided, it will fix ALL enrollment-based exams
 */

import { connect, connection, Types } from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const { Schema } = require('mongoose');

const ExamSessionSchema = new Schema({
  examId: { type: Schema.Types.ObjectId, ref: 'Exam' },
  candidateId: { type: Schema.Types.ObjectId, ref: 'User' },
  invitationId: { type: Schema.Types.ObjectId, ref: 'ExamInvitation' },
  accessSource: String,
  status: String,
  startTime: Date,
  endTime: Date,
  submittedAt: Date,
  score: Number,
  answers: Array,
  questionOrder: [Schema.Types.ObjectId],
}, { timestamps: true });

const ExamSchema = new Schema({
  title: String,
  code: String,
  questions: [Schema.Types.ObjectId],
  grading: {
    totalMarks: Number,
    passingMarks: Number,
    negativeMarking: Boolean,
    negativeMarkValue: Number,
  },
}, { timestamps: true });

const QuestionSchema = new Schema({
  text: String,
  type: String,
  marks: Number,
  correctAnswer: Schema.Types.Mixed,
  options: Array,
}, { timestamps: true });

const ResultSchema = new Schema({
  exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
  candidate: { type: Schema.Types.ObjectId, ref: 'User' },
  session: { type: Schema.Types.ObjectId, ref: 'ExamSession', required: true },
  invitationId: { type: Schema.Types.ObjectId, ref: 'ExamInvitation' },
  isRecruitmentExam: { type: Boolean, default: false },
  attemptNumber: { type: Number, default: 1 },
  status: { type: String, default: 'GRADED' },
  scoring: {
    totalScore: Number,
    totalMarks: Number,
    percentage: Number,
    passed: Boolean,
    correctAnswers: Number,
    incorrectAnswers: Number,
    unanswered: Number,
    negativeMarks: Number,
  },
  analysis: {
    timeSpent: Number,
    attempted: Number,
    correct: Number,
    incorrect: Number,
    unanswered: Number,
    accuracy: Number,
  },
  submittedAt: Date,
  visibleToCandidate: { type: Boolean, default: true },
}, { timestamps: true });

async function fixEnrollmentResults() {
  try {
    const specificExamId = process.argv[2];

    console.log('🔄 Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/skillmetric';
    await connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const ExamSession = connection.model('ExamSession', ExamSessionSchema);
    const Exam = connection.model('Exam', ExamSchema);
    const Question = connection.model('Question', QuestionSchema);
    const Result = connection.model('Result', ResultSchema);

    console.log('\n🔍 Finding enrollment-based sessions without results...');

    // Build query
    const sessionFilter: any = {
      candidateId: { $exists: true, $ne: null },
      status: { $in: ['COMPLETED', 'AUTO_SUBMITTED'] },
    };

    if (specificExamId) {
      if (!Types.ObjectId.isValid(specificExamId)) {
        console.error('❌ Invalid exam ID format');
        await connection.close();
        process.exit(1);
      }
      sessionFilter.examId = new Types.ObjectId(specificExamId);
      console.log(`   Targeting specific exam: ${specificExamId}`);
    }

    const sessions = await ExamSession.find(sessionFilter).exec();

    console.log(`📊 Found ${sessions.length} enrollment-based completed sessions`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const session of sessions) {
      try {
        // Check if result already exists
        const existingResult = await Result.findOne({
          exam: session.examId,
          candidate: session.candidateId,
        }).exec();

        if (existingResult) {
          console.log(`⏭️  Session ${session._id} already has result ${existingResult._id}`);
          skipped++;
          continue;
        }

        // Get exam details
        const exam = await Exam.findById(session.examId).exec();
        if (!exam) {
          console.log(`❌ Session ${session._id}: Exam not found`);
          errors++;
          continue;
        }

        // Get questions
        const questions = await Question.find({
          _id: { $in: exam.questions },
        }).exec();

        // Re-grade answers
        const answers = session.answers || [];
        let totalScore = 0;
        const gradedAnswers = answers.map((answer: any) => {
          const question = questions.find((q: any) => q._id.toString() === answer.questionId);
          if (!question) return { ...answer, isCorrect: false, marks: 0 };

          let isCorrect = false;
          let marks = 0;

          if (question.type === 'TRUE_FALSE') {
            isCorrect = answer.selectedOption === question.correctAnswer;
            marks = isCorrect ? question.marks : (exam.grading.negativeMarking ? -(exam.grading.negativeMarkValue || 0) : 0);
          } else if (question.type === 'MULTIPLE_CHOICE' || question.type === 'MULTIPLE_RESPONSE') {
            let selectedAnswers = answer.selectedOptions || [];
            if (!selectedAnswers.length && answer.selectedOption !== undefined) {
              selectedAnswers = [answer.selectedOption];
            }

            const correctOptions = question.options?.filter((opt: any) => opt.isCorrect) || [];
            const correctAnswers = correctOptions.map((opt: any) => opt.id);

            if (correctAnswers.length === 0) {
              const fallbackAnswers = Array.isArray(question.correctAnswer)
                ? question.correctAnswer
                : [question.correctAnswer];
              correctAnswers.push(...fallbackAnswers);
            }

            isCorrect =
              correctAnswers.length === selectedAnswers.length &&
              correctAnswers.every((ans: any) => selectedAnswers.includes(ans));
            marks = isCorrect ? question.marks : (exam.grading.negativeMarking ? -(exam.grading.negativeMarkValue || 0) : 0);
          } else if (question.type === 'SHORT_ANSWER' || question.type === 'FILL_BLANK') {
            const correctAnswer = (question.correctAnswer || '').toString().trim().toLowerCase();
            const studentAnswer = (answer.answer || '').toString().trim().toLowerCase();
            isCorrect = correctAnswer === studentAnswer;
            marks = isCorrect ? question.marks : 0;
          }

          totalScore += marks;

          return {
            questionId: answer.questionId,
            isCorrect,
            marks,
          };
        });

        const passed = totalScore >= exam.grading.passingMarks;
        const percentage = (totalScore / exam.grading.totalMarks) * 100;

        // Create result
        const result = await Result.create({
          exam: exam._id,
          candidate: session.candidateId,
          session: session._id,
          invitationId: null,
          isRecruitmentExam: false,
          attemptNumber: 1,
          status: 'GRADED',
          scoring: {
            totalScore,
            totalMarks: exam.grading.totalMarks,
            percentage,
            passed,
            correctAnswers: gradedAnswers.filter((a: any) => a.isCorrect).length,
            incorrectAnswers: gradedAnswers.filter((a: any) => !a.isCorrect).length,
            unanswered: questions.length - answers.length,
            negativeMarks: 0,
          },
          analysis: {
            timeSpent: session.submittedAt && session.startTime
              ? Math.floor((new Date(session.submittedAt).getTime() - new Date(session.startTime).getTime()) / 1000)
              : 0,
            attempted: answers.length,
            correct: gradedAnswers.filter((a: any) => a.isCorrect).length,
            incorrect: gradedAnswers.filter((a: any) => !a.isCorrect).length,
            unanswered: questions.length - answers.length,
            accuracy: answers.length > 0 ? (gradedAnswers.filter((a: any) => a.isCorrect).length / answers.length) * 100 : 0,
          },
          submittedAt: session.submittedAt || new Date(),
          visibleToCandidate: true,
        });

        console.log(`✅ Created result ${result._id} for session ${session._id} (Candidate: ${session.candidateId}, Score: ${totalScore}/${exam.grading.totalMarks})`);

        created++;
      } catch (error: any) {
        console.error(`❌ Error processing session ${session._id}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Results created: ${created}`);
    console.log(`⏭️  Already existed: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📈 Total processed: ${sessions.length}`);
    console.log('='.repeat(60));

    await connection.close();
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await connection.close();
    process.exit(1);
  }
}

fixEnrollmentResults();
