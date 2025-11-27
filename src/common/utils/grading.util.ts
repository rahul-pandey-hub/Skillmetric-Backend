import { QuestionType } from '../../modules/questions/schemas/question.schema';

export interface QuestionGradingInput {
  questionType: QuestionType;
  correctAnswer: any;
  studentAnswer: any;
  marks: number;
  negativeMarks: number;
}

export interface QuestionGradingResult {
  isCorrect: boolean;
  marksObtained: number;
  requiresManualGrading: boolean;
  feedback?: string;
}

/**
 * Grades a single question based on its type
 */
export class GradingUtil {
  /**
   * Grade a question and return the result
   */
  static gradeQuestion(input: QuestionGradingInput): QuestionGradingResult {
    const {
      questionType,
      correctAnswer,
      studentAnswer,
      marks,
      negativeMarks,
    } = input;

    switch (questionType) {
      case QuestionType.MULTIPLE_CHOICE:
        return this.gradeMultipleChoice(
          correctAnswer,
          studentAnswer,
          marks,
          negativeMarks,
        );

      case QuestionType.TRUE_FALSE:
        return this.gradeTrueFalse(
          correctAnswer,
          studentAnswer,
          marks,
          negativeMarks,
        );

      case QuestionType.FILL_BLANK:
        return this.gradeFillBlank(
          correctAnswer,
          studentAnswer,
          marks,
          negativeMarks,
        );

      case QuestionType.SHORT_ANSWER:
        return this.gradeShortAnswer(
          correctAnswer,
          studentAnswer,
          marks,
          negativeMarks,
        );

      case QuestionType.ESSAY:
        return this.gradeEssay(correctAnswer, studentAnswer, marks);

      default:
        return {
          isCorrect: false,
          marksObtained: 0,
          requiresManualGrading: true,
          feedback: 'Unknown question type',
        };
    }
  }

  /**
   * Grade multiple choice question
   */
  private static gradeMultipleChoice(
    correctAnswer: string,
    studentAnswer: string,
    marks: number,
    negativeMarks: number,
  ): QuestionGradingResult {
    if (!studentAnswer || studentAnswer.trim() === '') {
      return {
        isCorrect: false,
        marksObtained: 0,
        requiresManualGrading: false,
        feedback: 'No answer provided',
      };
    }

    const isCorrect = correctAnswer === studentAnswer;

    return {
      isCorrect,
      marksObtained: isCorrect ? marks : -negativeMarks,
      requiresManualGrading: false,
      feedback: isCorrect ? 'Correct answer' : 'Incorrect answer',
    };
  }

  /**
   * Grade true/false question
   */
  private static gradeTrueFalse(
    correctAnswer: boolean,
    studentAnswer: boolean,
    marks: number,
    negativeMarks: number,
  ): QuestionGradingResult {
    if (studentAnswer === null || studentAnswer === undefined) {
      return {
        isCorrect: false,
        marksObtained: 0,
        requiresManualGrading: false,
        feedback: 'No answer provided',
      };
    }

    const isCorrect = correctAnswer === studentAnswer;

    return {
      isCorrect,
      marksObtained: isCorrect ? marks : -negativeMarks,
      requiresManualGrading: false,
      feedback: isCorrect ? 'Correct answer' : 'Incorrect answer',
    };
  }

  /**
   * Grade fill in the blank question
   * Supports both single and multiple blanks
   */
  private static gradeFillBlank(
    correctAnswer: string | string[],
    studentAnswer: string | string[],
    marks: number,
    negativeMarks: number,
  ): QuestionGradingResult {
    if (!studentAnswer) {
      return {
        isCorrect: false,
        marksObtained: 0,
        requiresManualGrading: false,
        feedback: 'No answer provided',
      };
    }

    // Handle single blank
    if (typeof correctAnswer === 'string' && typeof studentAnswer === 'string') {
      const isCorrect = this.normalizeAnswer(correctAnswer) === this.normalizeAnswer(studentAnswer);
      return {
        isCorrect,
        marksObtained: isCorrect ? marks : -negativeMarks,
        requiresManualGrading: false,
        feedback: isCorrect ? 'Correct answer' : 'Incorrect answer',
      };
    }

    // Handle multiple blanks
    if (Array.isArray(correctAnswer) && Array.isArray(studentAnswer)) {
      // Check if all blanks are filled
      if (studentAnswer.length !== correctAnswer.length) {
        return {
          isCorrect: false,
          marksObtained: -negativeMarks,
          requiresManualGrading: false,
          feedback: 'Incomplete answer',
        };
      }

      // Check each blank
      let correctBlanks = 0;
      for (let i = 0; i < correctAnswer.length; i++) {
        if (
          this.normalizeAnswer(correctAnswer[i]) ===
          this.normalizeAnswer(studentAnswer[i])
        ) {
          correctBlanks++;
        }
      }

      const isCorrect = correctBlanks === correctAnswer.length;
      const partialMarks = (correctBlanks / correctAnswer.length) * marks;

      return {
        isCorrect,
        marksObtained: isCorrect ? marks : partialMarks > 0 ? partialMarks : -negativeMarks,
        requiresManualGrading: false,
        feedback: isCorrect
          ? 'All blanks correct'
          : `${correctBlanks} out of ${correctAnswer.length} blanks correct`,
      };
    }

    // Mismatch in answer format
    return {
      isCorrect: false,
      marksObtained: 0,
      requiresManualGrading: true,
      feedback: 'Answer format mismatch - requires manual grading',
    };
  }

  /**
   * Grade short answer question
   * Requires manual grading but can provide similarity check
   */
  private static gradeShortAnswer(
    correctAnswer: string,
    studentAnswer: string,
    marks: number,
    negativeMarks: number,
  ): QuestionGradingResult {
    if (!studentAnswer || studentAnswer.trim() === '') {
      return {
        isCorrect: false,
        marksObtained: 0,
        requiresManualGrading: true,
        feedback: 'No answer provided',
      };
    }

    // Calculate similarity score for reference (using simple keyword matching)
    const similarity = this.calculateSimilarity(correctAnswer, studentAnswer);

    // Short answers always require manual grading
    // But we can provide a preliminary assessment
    return {
      isCorrect: false, // Always false until manually graded
      marksObtained: 0, // Always 0 until manually graded
      requiresManualGrading: true,
      feedback: `Requires manual grading (Similarity score: ${(similarity * 100).toFixed(0)}%)`,
    };
  }

  /**
   * Grade essay question
   * Always requires manual grading
   */
  private static gradeEssay(
    correctAnswer: any,
    studentAnswer: string,
    marks: number,
  ): QuestionGradingResult {
    if (!studentAnswer || studentAnswer.trim() === '') {
      return {
        isCorrect: false,
        marksObtained: 0,
        requiresManualGrading: true,
        feedback: 'No answer provided',
      };
    }

    const wordCount = studentAnswer.trim().split(/\s+/).length;

    return {
      isCorrect: false, // Always false until manually graded
      marksObtained: 0, // Always 0 until manually graded
      requiresManualGrading: true,
      feedback: `Requires manual grading (Word count: ${wordCount})`,
    };
  }

  /**
   * Normalize answer for comparison (case-insensitive, trim whitespace)
   */
  private static normalizeAnswer(answer: string): string {
    if (!answer) return '';
    return answer.trim().toLowerCase();
  }

  /**
   * Calculate similarity between two strings (simple keyword-based approach)
   * Returns a value between 0 and 1
   */
  private static calculateSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;

    const words1 = new Set(
      text1
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3),
    ); // Filter out short words
    const words2 = new Set(
      text2
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate total score for multiple questions
   */
  static calculateTotalScore(
    gradingResults: QuestionGradingResult[],
  ): {
    totalMarks: number;
    requiresManualGrading: boolean;
    autoGradedCount: number;
    manualGradingCount: number;
  } {
    let totalMarks = 0;
    let autoGradedCount = 0;
    let manualGradingCount = 0;

    for (const result of gradingResults) {
      if (result.requiresManualGrading) {
        manualGradingCount++;
      } else {
        totalMarks += result.marksObtained;
        autoGradedCount++;
      }
    }

    return {
      totalMarks,
      requiresManualGrading: manualGradingCount > 0,
      autoGradedCount,
      manualGradingCount,
    };
  }

  /**
   * Generate performance analysis
   */
  static generateAnalysis(
    gradingResults: QuestionGradingResult[],
    totalPossibleMarks: number,
  ): {
    attempted: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    accuracy: number;
    percentage: number;
  } {
    let attempted = 0;
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;

    for (const result of gradingResults) {
      if (result.feedback === 'No answer provided') {
        unanswered++;
      } else {
        attempted++;
        if (result.isCorrect) {
          correct++;
        } else if (!result.requiresManualGrading) {
          incorrect++;
        }
      }
    }

    const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0;
    const totalMarks = gradingResults.reduce(
      (sum, r) => sum + (r.requiresManualGrading ? 0 : r.marksObtained),
      0,
    );
    const percentage =
      totalPossibleMarks > 0 ? (totalMarks / totalPossibleMarks) * 100 : 0;

    return {
      attempted,
      correct,
      incorrect,
      unanswered,
      accuracy: Math.max(0, accuracy), // Ensure non-negative
      percentage: Math.max(0, percentage), // Ensure non-negative
    };
  }
}
