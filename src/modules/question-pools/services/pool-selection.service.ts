import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { QuestionPool } from '../schemas/question-pool.schema';
import { Question } from '../../questions/schemas/question.schema';
import { Exam } from '../../exams/schemas/exam.schema';

export interface PoolSelectionConfig {
  poolId: string;
  questionsToSelect: number;
  category?: string;
  difficulty?: string;
  excludeQuestions?: string[]; // Questions to exclude (already used)
}

export interface PoolSelectionResult {
  poolId: string;
  poolName: string;
  selectedQuestions: string[];
  requestedCount: number;
  actualCount: number;
}

@Injectable()
export class PoolSelectionService {
  constructor(
    @InjectModel(QuestionPool.name) private questionPoolModel: Model<QuestionPool>,
    @InjectModel(Question.name) private questionModel: Model<Question>,
    @InjectModel(Exam.name) private examModel: Model<Exam>,
  ) {}

  /**
   * Select random questions from a pool based on criteria
   */
  async selectQuestionsFromPool(config: PoolSelectionConfig): Promise<PoolSelectionResult> {
    const { poolId, questionsToSelect, category, difficulty, excludeQuestions = [] } = config;

    // Get pool
    const pool = await this.questionPoolModel.findById(poolId);
    if (!pool) {
      throw new BadRequestException('Question pool not found');
    }

    if (!pool.isActive) {
      throw new BadRequestException('Question pool is not active');
    }

    // Build query for questions in this pool
    const query: any = {
      _id: { $in: pool.questions },
    };

    // Add category filter if specified
    if (category) {
      query.category = category;
    }

    // Add difficulty filter if specified
    if (difficulty) {
      query.difficulty = difficulty;
    }

    // Exclude already used questions
    if (excludeQuestions.length > 0) {
      query._id.$nin = excludeQuestions.map((id) => new Types.ObjectId(id));
    }

    // Get available questions
    const availableQuestions = await this.questionModel.find(query).select('_id');

    if (availableQuestions.length === 0) {
      throw new BadRequestException(
        `No questions available in pool matching criteria. Pool: ${pool.name}, Category: ${category || 'any'}, Difficulty: ${difficulty || 'any'}`,
      );
    }

    // Randomly select questions
    const selectedQuestions = this.randomSelect(
      availableQuestions.map((q) => q._id.toString()),
      Math.min(questionsToSelect, availableQuestions.length),
    );

    // Update pool usage stats
    pool.stats.usageCount = (pool.stats.usageCount || 0) + 1;
    await pool.save();

    return {
      poolId: pool._id.toString(),
      poolName: pool.name,
      selectedQuestions,
      requestedCount: questionsToSelect,
      actualCount: selectedQuestions.length,
    };
  }

  /**
   * Select questions from multiple pools
   * Used when creating an exam with multiple pool configurations
   */
  async selectQuestionsFromPools(
    configs: PoolSelectionConfig[],
  ): Promise<PoolSelectionResult[]> {
    const results: PoolSelectionResult[] = [];
    const usedQuestions: string[] = [];

    for (const config of configs) {
      // Exclude already selected questions from previous pools
      const result = await this.selectQuestionsFromPool({
        ...config,
        excludeQuestions: [...(config.excludeQuestions || []), ...usedQuestions],
      });

      results.push(result);
      usedQuestions.push(...result.selectedQuestions);
    }

    return results;
  }

  /**
   * Generate unique question set for each student from pools
   * Ensures each student gets a different random selection
   */
  async generateStudentQuestionSet(
    examId: string,
    studentId: string,
  ): Promise<{ questionIds: string[]; poolResults: PoolSelectionResult[] }> {
    const exam = await this.examModel.findById(examId).populate('questions');
    if (!exam) {
      throw new BadRequestException('Exam not found');
    }

    // If exam doesn't use pools, return static questions
    if (!exam.questionPools || exam.questionPools.length === 0) {
      return {
        questionIds: exam.questions.map((q) => q.toString()),
        poolResults: [],
      };
    }

    // Seed random generator with student ID for consistent results per student
    // This ensures the same student always gets the same questions
    const seed = this.hashStudentExam(studentId, examId);
    this.seedRandom(seed);

    // Select questions from each pool
    const poolConfigs: PoolSelectionConfig[] = exam.questionPools.map((poolConfig: any) => ({
      poolId: poolConfig.poolId.toString(),
      questionsToSelect: poolConfig.questionsToSelect,
      category: poolConfig.category,
      difficulty: poolConfig.difficulty,
    }));

    const poolResults = await this.selectQuestionsFromPools(poolConfigs);

    // Combine static questions + pool questions
    const staticQuestions = exam.questions.map((q) => q.toString());
    const poolQuestions = poolResults.flatMap((r) => r.selectedQuestions);

    return {
      questionIds: [...staticQuestions, ...poolQuestions],
      poolResults,
    };
  }

  /**
   * Validate pool configuration for an exam
   * Ensures pools have enough questions to meet requirements
   */
  async validatePoolConfigurations(poolConfigs: any[]): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const config of poolConfigs) {
      const pool = await this.questionPoolModel.findById(config.poolId);

      if (!pool) {
        errors.push(`Pool ${config.poolId} not found`);
        continue;
      }

      if (!pool.isActive) {
        errors.push(`Pool "${pool.name}" is not active`);
        continue;
      }

      // Count available questions matching criteria
      const query: any = { _id: { $in: pool.questions } };
      if (config.category) query.category = config.category;
      if (config.difficulty) query.difficulty = config.difficulty;

      const availableCount = await this.questionModel.countDocuments(query);

      if (availableCount < config.questionsToSelect) {
        errors.push(
          `Pool "${pool.name}" has only ${availableCount} questions matching criteria, but ${config.questionsToSelect} requested`,
        );
      } else if (availableCount === config.questionsToSelect) {
        warnings.push(
          `Pool "${pool.name}" has exactly ${availableCount} questions. No randomization will occur.`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get pool statistics
   */
  async getPoolStats(poolId: string) {
    const pool = await this.questionPoolModel.findById(poolId);
    if (!pool) {
      throw new BadRequestException('Pool not found');
    }

    // Count questions by category
    const questions = await this.questionModel
      .find({ _id: { $in: pool.questions } })
      .select('category difficulty');

    const categoryBreakdown: Record<string, number> = {};
    const difficultyBreakdown: Record<string, number> = {};

    questions.forEach((q) => {
      categoryBreakdown[q.category] = (categoryBreakdown[q.category] || 0) + 1;
      difficultyBreakdown[q.difficulty] = (difficultyBreakdown[q.difficulty] || 0) + 1;
    });

    return {
      poolId: pool._id,
      poolName: pool.name,
      totalQuestions: questions.length,
      usageCount: pool.stats.usageCount,
      categoryBreakdown,
      difficultyBreakdown,
      isActive: pool.isActive,
      isPublic: pool.isPublic,
    };
  }

  // Helper methods

  /**
   * Random selection without replacement
   */
  private randomSelect<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Hash function to generate seed from student ID and exam ID
   * Ensures consistent random selection for same student-exam combination
   */
  private hashStudentExam(studentId: string, examId: string): number {
    const str = `${studentId}-${examId}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Seed the random number generator
   * (Note: This is a simplified version. For production, consider using a proper seeded RNG library)
   */
  private seedRandom(seed: number) {
    // Simple seeded random (for demonstration)
    // In production, use a library like seedrandom
    Math.random = (() => {
      let x = Math.sin(seed++) * 10000;
      return () => {
        x = Math.sin(x) * 10000;
        return x - Math.floor(x);
      };
    })();
  }
}
