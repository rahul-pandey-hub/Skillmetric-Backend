import { Injectable, Logger } from '@nestjs/common';
import { QuestionType } from '../../questions/schemas/question.schema';
import { v4 as uuidv4 } from 'uuid';

export interface ParsedQuestion {
  tempId: string;
  text: string;
  type: QuestionType;
  difficulty: string;
  category: string;
  subcategory: string;
  topic?: string;
  options?: any[];
  correctAnswer: any;
  explanation?: string;
  hints?: string[];
  marks: number;
  negativeMarks?: number;
  estimatedTime: number;
  tags?: string[];
  codingDetails?: any;
}

export interface ParseResult {
  success: boolean;
  questions: ParsedQuestion[];
  errors: string[];
}

@Injectable()
export class ResponseParserService {
  private readonly logger = new Logger(ResponseParserService.name);

  /**
   * Parse AI response into structured questions
   */
  parseResponse(rawResponse: string, expectedType: QuestionType): ParseResult {
    const result: ParseResult = {
      success: false,
      questions: [],
      errors: [],
    };

    try {
      // Clean response (remove markdown, extra text)
      const cleanedResponse = this.cleanResponse(rawResponse);

      // Parse JSON
      let parsed;
      try {
        parsed = JSON.parse(cleanedResponse);
      } catch (parseError) {
        // Log the problematic JSON for debugging
        this.logger.error('JSON Parse Error:', parseError.message);
        this.logger.debug('Raw response (first 500 chars):', rawResponse.substring(0, 500));
        this.logger.debug('Cleaned response (first 500 chars):', cleanedResponse.substring(0, 500));
        this.logger.debug('Error position:', parseError.message.match(/position (\d+)/)?.[1]);

        // Try to extract and log the problematic section
        const errorPos = parseInt(parseError.message.match(/position (\d+)/)?.[1] || '0');
        if (errorPos > 0) {
          const start = Math.max(0, errorPos - 100);
          const end = Math.min(cleanedResponse.length, errorPos + 100);
          this.logger.debug('Context around error:', cleanedResponse.substring(start, end));
        }

        throw parseError;
      }

      // Handle both array and object responses
      const questionsArray = Array.isArray(parsed) ? parsed : [parsed];

      // Validate and normalize each question
      for (let i = 0; i < questionsArray.length; i++) {
        try {
          const normalizedQuestion = this.validateAndNormalizeQuestion(
            questionsArray[i],
            expectedType,
            i,
          );
          result.questions.push(normalizedQuestion);
        } catch (error) {
          this.logger.warn(`Question ${i + 1} validation failed: ${error.message}`);
          result.errors.push(`Question ${i + 1}: ${error.message}`);
        }
      }

      result.success = result.questions.length > 0;

      if (result.questions.length === 0) {
        result.errors.push('No valid questions could be parsed from the response');
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to parse AI response', error.stack);
      result.errors.push(`Parsing failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Clean AI response - remove markdown formatting, extra text, etc.
   */
  private cleanResponse(response: string): string {
    let cleaned = response.trim();

    // Remove markdown code blocks
    if (cleaned.includes('```json')) {
      cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    } else if (cleaned.includes('```')) {
      cleaned = cleaned.replace(/```\s*/g, '');
    }

    // Remove any text before first [ or {
    const jsonStartArray = cleaned.indexOf('[');
    const jsonStartObject = cleaned.indexOf('{');

    let jsonStart = -1;
    if (jsonStartArray !== -1 && jsonStartObject !== -1) {
      jsonStart = Math.min(jsonStartArray, jsonStartObject);
    } else if (jsonStartArray !== -1) {
      jsonStart = jsonStartArray;
    } else if (jsonStartObject !== -1) {
      jsonStart = jsonStartObject;
    }

    if (jsonStart > 0) {
      cleaned = cleaned.substring(jsonStart);
    }

    // Remove any text after last ] or }
    const jsonEndArray = cleaned.lastIndexOf(']');
    const jsonEndObject = cleaned.lastIndexOf('}');

    const jsonEnd = Math.max(jsonEndArray, jsonEndObject);
    if (jsonEnd !== -1 && jsonEnd < cleaned.length - 1) {
      cleaned = cleaned.substring(0, jsonEnd + 1);
    }

    // Fix common JSON issues
    // Remove trailing commas before } or ]
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    // Fix unescaped newlines in strings (replace with spaces)
    cleaned = cleaned.replace(/("(?:[^"\\]|\\.)*?")/g, (match) => {
      return match.replace(/\n/g, ' ').replace(/\r/g, '');
    });

    return cleaned.trim();
  }

  /**
   * Validate and normalize a single question
   */
  private validateAndNormalizeQuestion(
    question: any,
    expectedType: QuestionType,
    index: number,
  ): ParsedQuestion {
    // Basic field validation
    if (!question.text || typeof question.text !== 'string') {
      throw new Error('Missing or invalid "text" field');
    }

    if (question.text.length < 10) {
      throw new Error('Question text too short (minimum 10 characters)');
    }

    if (question.text.length > 2000) {
      throw new Error('Question text too long (maximum 2000 characters)');
    }

    // Ensure type matches expected
    if (!question.type || question.type !== expectedType) {
      question.type = expectedType;
    }

    // Type-specific validation and normalization
    switch (expectedType) {
      case QuestionType.MULTIPLE_CHOICE:
        this.validateMultipleChoice(question, index);
        break;

      case QuestionType.MULTIPLE_RESPONSE:
        this.validateMultipleResponse(question, index);
        break;

      case QuestionType.TRUE_FALSE:
        this.validateTrueFalse(question, index);
        break;

      case QuestionType.SHORT_ANSWER:
        this.validateShortAnswer(question, index);
        break;

      case QuestionType.CODING:
        this.validateCoding(question, index);
        break;

      case QuestionType.FILL_BLANK:
        this.validateFillBlank(question, index);
        break;
    }

    // Generate temporary ID
    const tempId = uuidv4();

    // Add option IDs if missing
    if (question.options && Array.isArray(question.options)) {
      question.options = question.options.map((opt, idx) => ({
        id: opt.id || `opt_${tempId}_${idx}`,
        text: opt.text,
        isCorrect: opt.isCorrect || false,
      }));
    }

    // Return normalized question
    return {
      tempId,
      text: question.text.trim(),
      type: question.type,
      difficulty: question.difficulty,
      category: question.category,
      subcategory: question.subcategory,
      topic: question.topic,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation?.trim(),
      hints: Array.isArray(question.hints) ? question.hints : undefined,
      marks: question.marks,
      negativeMarks: question.negativeMarks,
      estimatedTime: question.estimatedTime,
      tags: Array.isArray(question.tags) ? question.tags : undefined,
      codingDetails: question.codingDetails,
    };
  }

  /**
   * Validate Multiple Choice question
   */
  private validateMultipleChoice(question: any, index: number): void {
    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new Error('Must have at least 2 options');
    }

    if (question.options.length > 6) {
      throw new Error('Too many options (maximum 6)');
    }

    // Ensure all options have required fields
    question.options.forEach((opt, i) => {
      if (!opt.text || typeof opt.text !== 'string') {
        throw new Error(`Option ${i + 1}: Missing or invalid text`);
      }
      if (typeof opt.isCorrect !== 'boolean') {
        opt.isCorrect = false;
      }
    });

    // Check exactly one correct answer
    const correctOptions = question.options.filter((opt) => opt.isCorrect);
    if (correctOptions.length !== 1) {
      throw new Error(`Must have exactly 1 correct option, found ${correctOptions.length}`);
    }

    // Normalize correctAnswer
    question.correctAnswer = correctOptions[0].text;
  }

  /**
   * Validate Multiple Response question
   */
  private validateMultipleResponse(question: any, index: number): void {
    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new Error('Must have at least 2 options');
    }

    // Ensure all options have required fields
    question.options.forEach((opt, i) => {
      if (!opt.text || typeof opt.text !== 'string') {
        throw new Error(`Option ${i + 1}: Missing or invalid text`);
      }
      if (typeof opt.isCorrect !== 'boolean') {
        opt.isCorrect = false;
      }
    });

    // Check at least 2 correct answers
    const correctOptions = question.options.filter((opt) => opt.isCorrect);
    if (correctOptions.length < 2) {
      throw new Error(`Must have at least 2 correct options, found ${correctOptions.length}`);
    }

    // Check not all options are correct
    if (correctOptions.length === question.options.length) {
      throw new Error('Cannot have all options as correct');
    }

    // Normalize correctAnswer to array
    question.correctAnswer = correctOptions.map((opt) => opt.text);
  }

  /**
   * Validate True/False question
   */
  private validateTrueFalse(question: any, index: number): void {
    // Auto-generate options if not present or invalid
    if (!question.options || question.options.length !== 2) {
      let isTrue = false;

      // Determine correct answer
      if (typeof question.correctAnswer === 'boolean') {
        isTrue = question.correctAnswer;
      } else if (typeof question.correctAnswer === 'string') {
        isTrue = question.correctAnswer.toLowerCase() === 'true';
      } else {
        throw new Error('Invalid correctAnswer for True/False question');
      }

      question.options = [
        { text: 'True', isCorrect: isTrue },
        { text: 'False', isCorrect: !isTrue },
      ];
    }

    // Normalize correctAnswer to boolean
    const correctOption = question.options.find((opt) => opt.isCorrect);
    if (!correctOption) {
      throw new Error('No correct option specified');
    }

    question.correctAnswer = correctOption.text.toLowerCase() === 'true';
  }

  /**
   * Validate Short Answer question
   */
  private validateShortAnswer(question: any, index: number): void {
    if (!question.correctAnswer) {
      throw new Error('Missing correctAnswer');
    }

    // Normalize to array if single answer
    if (!Array.isArray(question.correctAnswer)) {
      question.correctAnswer = [String(question.correctAnswer)];
    } else {
      question.correctAnswer = question.correctAnswer.map((ans) => String(ans));
    }

    if (question.correctAnswer.length === 0) {
      throw new Error('correctAnswer array is empty');
    }
  }

  /**
   * Validate Coding question
   */
  private validateCoding(question: any, index: number): void {
    if (!question.codingDetails) {
      throw new Error('Missing codingDetails');
    }

    const details = question.codingDetails;

    // Validate test cases
    if (!Array.isArray(details.testCases) || details.testCases.length < 1) {
      throw new Error('Must have at least 1 test case');
    }

    details.testCases.forEach((tc, i) => {
      if (!tc.input || !tc.expectedOutput) {
        throw new Error(`Test case ${i + 1}: Missing input or expectedOutput`);
      }
      if (typeof tc.isHidden !== 'boolean') {
        tc.isHidden = false;
      }
    });

    // Validate languages
    if (!Array.isArray(details.language) || details.language.length < 1) {
      throw new Error('Must specify at least 1 programming language');
    }

    // Set defaults
    details.timeLimit = details.timeLimit || 5;
    details.memoryLimit = details.memoryLimit || 256;

    // Reference solution is optional but recommended
    if (!details.referenceSolution) {
      this.logger.warn(`Question ${index + 1}: Missing reference solution`);
    }
  }

  /**
   * Validate Fill in the Blank question
   */
  private validateFillBlank(question: any, index: number): void {
    if (!question.text.includes('___') && !question.text.includes('_____')) {
      throw new Error('Fill in the blank question must contain underscores (___) for blanks');
    }

    if (!question.correctAnswer) {
      throw new Error('Missing correctAnswer');
    }

    // Normalize to array if single answer
    if (!Array.isArray(question.correctAnswer)) {
      question.correctAnswer = [String(question.correctAnswer)];
    }
  }

  /**
   * Extract metadata from AI response if present
   */
  extractMetadata(response: any): {
    confidence?: number;
    difficulty?: string;
    estimatedQuality?: number;
  } {
    // Some LLMs might include metadata
    return {
      confidence: response.confidence,
      difficulty: response.difficulty,
      estimatedQuality: response.quality,
    };
  }

  /**
   * Calculate simple quality score based on completeness
   */
  calculateQualityScore(question: ParsedQuestion): number {
    let score = 50; // Base score

    // Has explanation
    if (question.explanation && question.explanation.length > 50) {
      score += 20;
    }

    // Has hints
    if (question.hints && question.hints.length > 0) {
      score += 10;
    }

    // Options are well-formed (for MCQ)
    if (question.options && question.options.length >= 4) {
      score += 10;
    }

    // Question text is substantial
    if (question.text.length > 100) {
      score += 10;
    }

    return Math.min(100, score);
  }
}
