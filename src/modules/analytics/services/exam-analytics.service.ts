import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Exam } from '../../exams/schemas/exam.schema';
import { Result } from '../../results/schemas/result.schema';
import { ExamSession } from '../../proctoring/schemas/exam-session.schema';
import { Question } from '../../questions/schemas/question.schema';

@Injectable()
export class ExamAnalyticsService {
  constructor(
    @InjectModel(Exam.name) private examModel: Model<Exam>,
    @InjectModel(Result.name) private resultModel: Model<Result>,
    @InjectModel(ExamSession.name) private sessionModel: Model<ExamSession>,
    @InjectModel(Question.name) private questionModel: Model<Question>,
  ) {}

  /**
   * Get comprehensive exam-level analytics
   * Includes: participation, scores, time, violations, shortlisting
   */
  async getExamAnalytics(examId: string) {
    const exam = await this.examModel.findById(examId);
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    const [
      participationMetrics,
      scoreDistribution,
      passFailAnalysis,
      timeAnalysis,
      shortlistingMetrics,
      violationAnalysis,
    ] = await Promise.all([
      this.getParticipationMetrics(examId),
      this.getScoreDistribution(examId),
      this.getPassFailAnalysis(examId),
      this.getTimeAnalysis(examId),
      this.getShortlistingMetrics(examId),
      this.getViolationAnalysis(examId),
    ]);

    return {
      examId,
      examTitle: exam.title,
      examCode: exam.code,
      status: exam.status,
      participation: participationMetrics,
      scores: scoreDistribution,
      passFailStats: passFailAnalysis,
      timeStats: timeAnalysis,
      shortlisting: shortlistingMetrics,
      violations: violationAnalysis,
      generatedAt: new Date(),
    };
  }

  /**
   * Participation Metrics
   * Total enrolled, started, submitted, in-progress, completion rate, no-show rate
   */
  private async getParticipationMetrics(examId: string) {
    const exam = await this.examModel.findById(examId);
    const totalEnrolled = exam.enrolledStudents.length;

    const sessions = await this.sessionModel.find({ examId: examId });
    const totalStarted = sessions.filter((s) => s.status !== 'ACTIVE').length;
    const totalSubmitted = sessions.filter((s) => s.status === 'COMPLETED').length;
    const totalInProgress = sessions.filter((s) => s.status === 'IN_PROGRESS').length;

    const completionRate = totalEnrolled > 0 ? (totalSubmitted / totalEnrolled) * 100 : 0;
    const noShowRate = totalEnrolled > 0 ? ((totalEnrolled - totalStarted) / totalEnrolled) * 100 : 0;

    return {
      totalEnrolled,
      totalStarted,
      totalSubmitted,
      totalInProgress,
      completionRate: Math.round(completionRate * 100) / 100,
      noShowRate: Math.round(noShowRate * 100) / 100,
    };
  }

  /**
   * Score Distribution
   * Average, median, highest, lowest, standard deviation, histogram
   */
  private async getScoreDistribution(examId: string) {
    const results = await this.resultModel
      .find({ exam: examId, status: { $in: ['GRADED', 'PUBLISHED'] } })
      .select('scoring');

    if (results.length === 0) {
      return {
        totalResults: 0,
        averageScore: 0,
        medianScore: 0,
        highestScore: 0,
        lowestScore: 0,
        standardDeviation: 0,
        averagePercentage: 0,
        medianPercentage: 0,
        scoreRanges: [],
        percentageRanges: [],
      };
    }

    const scores = results.map((r) => r.scoring.totalScore);
    const percentages = results.map((r) => r.scoring.percentage);

    // Calculate statistics
    const averageScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const averagePercentage = percentages.reduce((sum, p) => sum + p, 0) / percentages.length;

    const sortedScores = [...scores].sort((a, b) => a - b);
    const sortedPercentages = [...percentages].sort((a, b) => a - b);
    const medianScore = this.calculateMedian(sortedScores);
    const medianPercentage = this.calculateMedian(sortedPercentages);

    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);

    const standardDeviation = this.calculateStandardDeviation(scores, averageScore);

    // Score ranges histogram (0-10, 11-20, ...)
    const scoreRanges = this.createHistogram(scores, 10);

    // Percentage ranges (0-25%, 26-50%, 51-75%, 76-100%)
    const percentageRanges = [
      {
        range: '0-25%',
        count: percentages.filter((p) => p >= 0 && p <= 25).length,
      },
      {
        range: '26-50%',
        count: percentages.filter((p) => p > 25 && p <= 50).length,
      },
      {
        range: '51-75%',
        count: percentages.filter((p) => p > 50 && p <= 75).length,
      },
      {
        range: '76-100%',
        count: percentages.filter((p) => p > 75 && p <= 100).length,
      },
    ];

    return {
      totalResults: results.length,
      averageScore: Math.round(averageScore * 100) / 100,
      medianScore: Math.round(medianScore * 100) / 100,
      highestScore,
      lowestScore,
      standardDeviation: Math.round(standardDeviation * 100) / 100,
      averagePercentage: Math.round(averagePercentage * 100) / 100,
      medianPercentage: Math.round(medianPercentage * 100) / 100,
      scoreRanges,
      percentageRanges,
    };
  }

  /**
   * Pass/Fail Analysis
   */
  private async getPassFailAnalysis(examId: string) {
    const results = await this.resultModel
      .find({ exam: examId, status: { $in: ['GRADED', 'PUBLISHED'] } })
      .select('scoring');

    const totalResults = results.length;
    if (totalResults === 0) {
      return {
        totalPassed: 0,
        totalFailed: 0,
        passRate: 0,
        failRate: 0,
      };
    }

    const totalPassed = results.filter((r) => r.scoring.passed).length;
    const totalFailed = totalResults - totalPassed;
    const passRate = (totalPassed / totalResults) * 100;
    const failRate = (totalFailed / totalResults) * 100;

    return {
      totalPassed,
      totalFailed,
      passRate: Math.round(passRate * 100) / 100,
      failRate: Math.round(failRate * 100) / 100,
    };
  }

  /**
   * Time Analysis
   */
  private async getTimeAnalysis(examId: string) {
    const sessions = await this.sessionModel
      .find({ examId: examId, status: 'COMPLETED' })
      .select('startTime endTime');

    if (sessions.length === 0) {
      return {
        totalSubmissions: 0,
        averageDuration: 0,
        medianDuration: 0,
        fastestCompletion: 0,
        slowestCompletion: 0,
        durationRanges: [],
      };
    }

    // Calculate durations in minutes
    const durations = sessions
      .map((s) => {
        if (s.startTime && s.endTime) {
          return Math.floor((s.endTime.getTime() - s.startTime.getTime()) / (1000 * 60));
        }
        return 0;
      })
      .filter((d) => d > 0);

    if (durations.length === 0) {
      return {
        totalSubmissions: 0,
        averageDuration: 0,
        medianDuration: 0,
        fastestCompletion: 0,
        slowestCompletion: 0,
        durationRanges: [],
      };
    }

    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const medianDuration = this.calculateMedian(sortedDurations);
    const fastestCompletion = Math.min(...durations);
    const slowestCompletion = Math.max(...durations);

    // Duration ranges histogram (every 15 minutes)
    const durationRanges = this.createHistogram(durations, 15);

    return {
      totalSubmissions: durations.length,
      averageDuration: Math.round(averageDuration),
      medianDuration: Math.round(medianDuration),
      fastestCompletion,
      slowestCompletion,
      durationRanges,
    };
  }

  /**
   * Shortlisting Metrics
   */
  private async getShortlistingMetrics(examId: string) {
    const exam = await this.examModel.findById(examId);
    if (!exam.shortlistingCriteria?.enabled) {
      return {
        enabled: false,
        totalShortlisted: 0,
        shortlistingRate: 0,
        averageScoreShortlisted: 0,
        averageScoreNotShortlisted: 0,
      };
    }

    const results = await this.resultModel
      .find({ exam: examId, status: { $in: ['GRADED', 'PUBLISHED'] } })
      .select('shortlisted scoring');

    const totalShortlisted = results.filter((r) => r.shortlisted).length;
    const shortlistingRate = results.length > 0 ? (totalShortlisted / results.length) * 100 : 0;

    const shortlistedScores = results.filter((r) => r.shortlisted).map((r) => r.scoring.totalScore);
    const notShortlistedScores = results
      .filter((r) => !r.shortlisted)
      .map((r) => r.scoring.totalScore);

    const averageScoreShortlisted =
      shortlistedScores.length > 0
        ? shortlistedScores.reduce((sum, s) => sum + s, 0) / shortlistedScores.length
        : 0;

    const averageScoreNotShortlisted =
      notShortlistedScores.length > 0
        ? notShortlistedScores.reduce((sum, s) => sum + s, 0) / notShortlistedScores.length
        : 0;

    return {
      enabled: true,
      totalShortlisted,
      shortlistingRate: Math.round(shortlistingRate * 100) / 100,
      averageScoreShortlisted: Math.round(averageScoreShortlisted * 100) / 100,
      averageScoreNotShortlisted: Math.round(averageScoreNotShortlisted * 100) / 100,
    };
  }

  /**
   * Violation Analysis
   */
  private async getViolationAnalysis(examId: string) {
    const sessions = await this.sessionModel.find({ examId: examId }).select('violations warningCount');

    const totalSessions = sessions.length;
    const sessionsWithViolations = sessions.filter(
      (s) => s.violations && s.violations.length > 0,
    ).length;

    // Count violation types
    const violationTypes: Record<string, number> = {};
    let totalViolations = 0;

    sessions.forEach((session) => {
      if (session.violations) {
        session.violations.forEach((violation: any) => {
          const type = violation.type || 'UNKNOWN';
          violationTypes[type] = (violationTypes[type] || 0) + 1;
          totalViolations++;
        });
      }
    });

    return {
      totalSessions,
      sessionsWithViolations,
      totalViolations,
      violationTypes,
      violationRate:
        totalSessions > 0
          ? Math.round((sessionsWithViolations / totalSessions) * 100 * 100) / 100
          : 0,
    };
  }

  /**
   * Question-Level Analytics
   * Success rate, average time, difficulty index per question
   */
  async getQuestionAnalytics(examId: string) {
    const exam = await this.examModel.findById(examId).populate('questions');
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    const results = await this.resultModel
      .find({ exam: examId, status: { $in: ['GRADED', 'PUBLISHED'] } })
      .select('answers');

    const questionStats: any[] = [];

    for (const questionId of exam.questions) {
      const stats = await this.calculateQuestionStats(questionId.toString(), results);
      questionStats.push(stats);
    }

    return {
      examId,
      totalQuestions: exam.questions.length,
      questions: questionStats,
      generatedAt: new Date(),
    };
  }

  /**
   * Calculate statistics for a single question
   */
  private async calculateQuestionStats(questionId: string, results: any[]) {
    const question = await this.questionModel.findById(questionId);

    let totalAttempts = 0;
    let correctAttempts = 0;
    let wrongAttempts = 0;
    let unanswered = 0;
    let totalTime = 0;
    let timeCount = 0;

    // Option selection tracking for MCQs
    const optionSelections: Record<string, number> = {};

    results.forEach((result) => {
      const answer = result.answers.find(
        (a: any) => a.questionId.toString() === questionId,
      );

      if (answer) {
        totalAttempts++;

        if (answer.isCorrect) {
          correctAttempts++;
        } else if (answer.selectedOption || answer.textAnswer || answer.codeAnswer) {
          wrongAttempts++;
        } else {
          unanswered++;
        }

        // Track option selections
        if (answer.selectedOption) {
          optionSelections[answer.selectedOption] =
            (optionSelections[answer.selectedOption] || 0) + 1;
        }

        // Track time
        if (answer.timeTaken) {
          totalTime += answer.timeTaken;
          timeCount++;
        }
      } else {
        unanswered++;
        totalAttempts++;
      }
    });

    const successRate = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;
    const averageTime = timeCount > 0 ? Math.round(totalTime / timeCount) : 0;
    const difficultyIndex = 1 - correctAttempts / totalAttempts; // 0 = easy, 1 = hard

    // Determine if question is problematic
    let problematic = false;
    let problematicReason = '';
    if (successRate > 90) {
      problematic = true;
      problematicReason = 'Too easy (>90% success rate)';
    } else if (successRate < 30) {
      problematic = true;
      problematicReason = 'Too hard (<30% success rate)';
    }

    return {
      questionId,
      questionText: question?.text || 'Unknown',
      questionType: question?.type || 'Unknown',
      category: question?.category || 'Uncategorized',
      difficulty: question?.difficulty || 'Unknown',
      totalAttempts,
      correctAttempts,
      wrongAttempts,
      unanswered,
      successRate: Math.round(successRate * 100) / 100,
      averageTime,
      difficultyIndex: Math.round(difficultyIndex * 100) / 100,
      optionSelections,
      problematic,
      problematicReason,
    };
  }

  /**
   * Category-Wise Analytics
   * Performance breakdown by category
   */
  async getCategoryAnalytics(examId: string) {
    const results = await this.resultModel
      .find({ exam: examId, status: { $in: ['GRADED', 'PUBLISHED'] } })
      .select('categoryWiseScore');

    if (results.length === 0) {
      return {
        examId,
        categories: [],
        generatedAt: new Date(),
      };
    }

    // Aggregate category scores
    const categoryMap: Record<string, any> = {};

    results.forEach((result) => {
      if (result.categoryWiseScore) {
        result.categoryWiseScore.forEach((cat: any) => {
          if (!categoryMap[cat.category]) {
            categoryMap[cat.category] = {
              category: cat.category,
              totalQuestions: cat.totalQuestions,
              scores: [],
              accuracies: [],
            };
          }
          categoryMap[cat.category].scores.push(cat.score);
          categoryMap[cat.category].accuracies.push(cat.accuracy);
        });
      }
    });

    // Calculate statistics for each category
    const categories = Object.values(categoryMap).map((cat: any) => {
      const averageScore =
        cat.scores.reduce((sum: number, s: number) => sum + s, 0) / cat.scores.length;
      const medianScore = this.calculateMedian([...cat.scores].sort((a, b) => a - b));
      const averageAccuracy =
        cat.accuracies.reduce((sum: number, a: number) => sum + a, 0) / cat.accuracies.length;

      return {
        category: cat.category,
        totalQuestions: cat.totalQuestions,
        averageScore: Math.round(averageScore * 100) / 100,
        medianScore: Math.round(medianScore * 100) / 100,
        averageAccuracy: Math.round(averageAccuracy * 100) / 100,
        highestScore: Math.max(...cat.scores),
        lowestScore: Math.min(...cat.scores),
        totalStudents: cat.scores.length,
      };
    });

    // Identify weak areas (lowest average accuracy)
    const weakAreas = [...categories]
      .sort((a, b) => a.averageAccuracy - b.averageAccuracy)
      .slice(0, 3)
      .map((c) => c.category);

    return {
      examId,
      categories,
      weakAreas,
      generatedAt: new Date(),
    };
  }

  /**
   * Get complete analytics summary (all analytics in one call)
   */
  async getCompleteAnalytics(examId: string) {
    const [examAnalytics, questionAnalytics, categoryAnalytics] = await Promise.all([
      this.getExamAnalytics(examId),
      this.getQuestionAnalytics(examId),
      this.getCategoryAnalytics(examId),
    ]);

    return {
      exam: examAnalytics,
      questions: questionAnalytics,
      categories: categoryAnalytics,
      generatedAt: new Date(),
    };
  }

  // Helper methods

  private calculateMedian(sortedArray: number[]): number {
    const mid = Math.floor(sortedArray.length / 2);
    if (sortedArray.length % 2 === 0) {
      return (sortedArray[mid - 1] + sortedArray[mid]) / 2;
    }
    return sortedArray[mid];
  }

  private calculateStandardDeviation(values: number[], mean: number): number {
    const squaredDiffs = values.map((value) => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  private createHistogram(values: number[], rangeSize: number): any[] {
    const maxValue = Math.max(...values);
    const numBuckets = Math.ceil(maxValue / rangeSize);

    const buckets: any[] = [];
    for (let i = 0; i < numBuckets; i++) {
      const min = i * rangeSize;
      const max = (i + 1) * rangeSize;
      const count = values.filter((v) => v >= min && v < max).length;
      buckets.push({
        range: `${min}-${max - 1}`,
        count,
      });
    }

    return buckets.filter((b) => b.count > 0);
  }
}
