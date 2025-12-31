import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Question } from '../../questions/schemas/question.schema';
import { ParsedQuestion } from './response-parser.service';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  qualityScore: number;
  suggestions: string[];
}

@Injectable()
export class QuestionValidatorService {
  private readonly logger = new Logger(QuestionValidatorService.name);

  constructor(
    @InjectModel(Question.name)
    private questionModel: Model<Question>,
  ) {}

  /**
   * Validate a question for quality and correctness
   */
  async validate(question: ParsedQuestion): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      qualityScore: 100,
      suggestions: [],
    };

    // Content quality checks
    this.validateContentQuality(question, result);

    // Type-specific validation
    this.validateQuestionType(question, result);

    // Language quality checks
    this.validateLanguageQuality(question, result);

    // Duplicate check (async)
    await this.checkForDuplicates(question, result);

    // Calculate final quality score
    result.qualityScore = this.calculateQualityScore(question, result);

    // Determine if valid (no critical errors)
    result.isValid = result.errors.length === 0;

    return result;
  }

  /**
   * Validate content quality
   */
  private validateContentQuality(question: ParsedQuestion, result: ValidationResult): void {
    // Text length
    if (question.text.length < 15) {
      result.errors.push('Question text is too short (minimum 15 characters)');
    }

    if (question.text.length > 2000) {
      result.errors.push('Question text is too long (maximum 2000 characters)');
    }

    // Check for placeholder text
    const placeholderPatterns = [
      /\[.*?\]/,
      /TODO/i,
      /FIXME/i,
      /xxx/i,
      /placeholder/i,
      /sample question/i,
    ];

    for (const pattern of placeholderPatterns) {
      if (pattern.test(question.text)) {
        result.warnings.push('Question text contains placeholder-like content');
        break;
      }
    }

    // Explanation quality (if present)
    if (question.explanation) {
      if (question.explanation.length < 30) {
        result.warnings.push('Explanation is too brief (recommended minimum 30 characters)');
      }

      if (question.explanation.length > 1000) {
        result.warnings.push('Explanation is very long (recommended maximum 1000 characters)');
      }
    } else {
      result.suggestions.push('Consider adding an explanation to help learners understand');
    }

    // Hints (if present)
    if (question.hints && question.hints.length > 0) {
      question.hints.forEach((hint, idx) => {
        if (hint.length < 10) {
          result.warnings.push(`Hint ${idx + 1} is too short`);
        }
      });
    }
  }

  /**
   * Type-specific validation
   */
  private validateQuestionType(question: ParsedQuestion, result: ValidationResult): void {
    switch (question.type) {
      case 'MULTIPLE_CHOICE':
        this.validateMultipleChoiceQuality(question, result);
        break;

      case 'MULTIPLE_RESPONSE':
        this.validateMultipleResponseQuality(question, result);
        break;

      case 'TRUE_FALSE':
        this.validateTrueFalseQuality(question, result);
        break;

      case 'CODING':
        this.validateCodingQuality(question, result);
        break;
    }
  }

  /**
   * Validate Multiple Choice quality
   */
  private validateMultipleChoiceQuality(question: ParsedQuestion, result: ValidationResult): void {
    if (!question.options || question.options.length < 2) {
      result.errors.push('Multiple choice must have at least 2 options');
      return;
    }

    // Check option lengths are balanced
    const lengths = question.options.map((opt) => opt.text.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const maxDeviation = Math.max(...lengths.map((len) => Math.abs(len - avgLength)));

    if (maxDeviation > avgLength * 1.5) {
      result.warnings.push('Option lengths vary significantly (may indicate the correct answer)');
    }

    // Check for very short options
    const shortOptions = question.options.filter((opt) => opt.text.length < 3);
    if (shortOptions.length > 0) {
      result.warnings.push('Some options are very short');
    }

    // Check for duplicate options
    const optionTexts = question.options.map((opt) => opt.text.toLowerCase());
    const uniqueOptions = new Set(optionTexts);
    if (uniqueOptions.size !== optionTexts.length) {
      result.errors.push('Duplicate options detected');
    }

    // Check for "All of the above" / "None of the above"
    const hasAllNone = question.options.some((opt) =>
      /all of the above|none of the above/i.test(opt.text)
    );
    if (hasAllNone) {
      result.warnings.push('Contains "All/None of the above" - use sparingly');
    }

    // Suggest improvement if options are too similar
    const similarityThreshold = 0.7;
    for (let i = 0; i < question.options.length; i++) {
      for (let j = i + 1; j < question.options.length; j++) {
        const similarity = this.calculateStringSimilarity(
          question.options[i].text,
          question.options[j].text,
        );
        if (similarity > similarityThreshold) {
          result.warnings.push(`Options ${i + 1} and ${j + 1} are very similar`);
        }
      }
    }
  }

  /**
   * Validate Multiple Response quality
   */
  private validateMultipleResponseQuality(question: ParsedQuestion, result: ValidationResult): void {
    if (!question.options || question.options.length < 2) {
      result.errors.push('Multiple response must have at least 2 options');
      return;
    }

    const correctCount = question.options.filter((opt) => opt.isCorrect).length;

    if (correctCount < 2) {
      result.errors.push('Multiple response must have at least 2 correct answers');
    }

    if (correctCount === question.options.length) {
      result.errors.push('Multiple response cannot have all options as correct');
    }

    // Check if question text indicates multiple answers
    const hasMultipleIndicator = /select all|choose all|which.*are/i.test(question.text);
    if (!hasMultipleIndicator) {
      result.warnings.push('Question text should clearly indicate multiple answers are expected');
      result.suggestions.push('Add phrase like "Select all that apply" or "Choose all correct answers"');
    }
  }

  /**
   * Validate True/False quality
   */
  private validateTrueFalseQuality(question: ParsedQuestion, result: ValidationResult): void {
    // Check for absolute terms that may indicate poor quality
    const absoluteTerms = /always|never|all|none|every|impossible/i;
    if (absoluteTerms.test(question.text)) {
      result.warnings.push('Question uses absolute terms - ensure the statement is factually absolute');
    }

    // Check for ambiguous language
    const ambiguousTerms = /usually|sometimes|often|rarely|might|could/i;
    if (ambiguousTerms.test(question.text)) {
      result.warnings.push('Question uses ambiguous terms - true/false should be definitive');
    }

    // Check for question marks (should be a statement)
    if (question.text.includes('?')) {
      result.warnings.push('True/False should be a statement, not a question');
    }
  }

  /**
   * Validate Coding question quality
   */
  private validateCodingQuality(question: ParsedQuestion, result: ValidationResult): void {
    if (!question.codingDetails) {
      result.errors.push('Coding question missing codingDetails');
      return;
    }

    const details = question.codingDetails;

    // Check test cases
    if (!details.testCases || details.testCases.length < 2) {
      result.warnings.push('Coding question should have at least 2 test cases');
    }

    const visibleTests = details.testCases?.filter((tc) => !tc.isHidden) || [];
    if (visibleTests.length === 0) {
      result.errors.push('Must have at least one visible test case');
    }

    // Check for reference solution
    if (!details.referenceSolution) {
      result.warnings.push('Missing reference solution');
    }

    // Check time and memory limits
    if (!details.timeLimit || details.timeLimit < 1) {
      result.warnings.push('Time limit not set or too low');
    }

    if (!details.memoryLimit || details.memoryLimit < 64) {
      result.warnings.push('Memory limit not set or too low');
    }

    // Check problem description clarity
    if (!question.text.includes('Input:') && !question.text.includes('Output:')) {
      result.suggestions.push('Consider adding explicit Input/Output format description');
    }
  }

  /**
   * Validate language quality
   */
  private validateLanguageQuality(question: ParsedQuestion, result: ValidationResult): void {
    const text = question.text.toLowerCase();

    // Check for common grammatical issues
    if (text.match(/\s{2,}/)) {
      result.warnings.push('Multiple consecutive spaces detected');
    }

    // Check for incomplete sentences
    if (!question.text.match(/[.?!]$/) && question.type !== 'FILL_BLANK') {
      result.warnings.push('Question text does not end with punctuation');
    }

    // Check for typos (basic detection)
    const commonTypos = [
      /\bteh\b/i,
      /\brecieve\b/i,
      /\boccured\b/i,
      /\bseperate\b/i,
    ];

    for (const typo of commonTypos) {
      if (typo.test(question.text)) {
        result.warnings.push('Possible typo detected in question text');
        break;
      }
    }
  }

  /**
   * Check for duplicate questions
   */
  private async checkForDuplicates(
    question: ParsedQuestion,
    result: ValidationResult,
  ): Promise<void> {
    try {
      // Exact match check
      const exactMatch = await this.questionModel.findOne({
        text: question.text,
        isActive: true,
      });

      if (exactMatch) {
        result.errors.push('Question with identical text already exists');
        return;
      }

      // Similarity check (basic - can be enhanced with embeddings)
      const similarQuestions = await this.questionModel
        .find({
          category: question.category,
          subcategory: question.subcategory,
          difficulty: question.difficulty,
          isActive: true,
        })
        .limit(50)
        .exec();

      for (const existing of similarQuestions) {
        const similarity = this.calculateStringSimilarity(
          question.text,
          existing.text,
        );

        if (similarity > 0.85) {
          result.warnings.push('Very similar question found in database');
          break;
        }
      }
    } catch (error) {
      this.logger.warn('Duplicate check failed', error);
      // Don't fail validation if duplicate check fails
    }
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(
    question: ParsedQuestion,
    result: ValidationResult,
  ): number {
    let score = 100;

    // Deduct for errors (critical)
    score -= result.errors.length * 20;

    // Deduct for warnings
    score -= result.warnings.length * 5;

    // Bonus for completeness
    if (question.explanation && question.explanation.length > 50) {
      score += 5;
    }

    if (question.hints && question.hints.length > 0) {
      score += 5;
    }

    // Bonus for question length (indicates detail)
    if (question.text.length > 100) {
      score += 5;
    }

    // Ensure score is between 0-100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate string similarity (Levenshtein-based)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) {
        costs[s2.length] = lastValue;
      }
    }

    const distance = costs[s2.length];
    const maxLength = Math.max(s1.length, s2.length);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }

  /**
   * Batch validate multiple questions
   */
  async validateBatch(questions: ParsedQuestion[]): Promise<ValidationResult[]> {
    const results = [];

    for (const question of questions) {
      const result = await this.validate(question);
      results.push(result);
    }

    return results;
  }
}
