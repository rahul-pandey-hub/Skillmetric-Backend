import { Injectable } from '@nestjs/common';
import { GenerateQuestionsDto } from '../dto';
import { QuestionType, DifficultyLevel } from '../../questions/schemas/question.schema';

export interface PromptContext {
  dto: GenerateQuestionsDto;
  questionType: QuestionType;
  batchIndex?: number;
  batchSize?: number;
}

export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
  outputSchema: any;
}

@Injectable()
export class PromptBuilderService {
  /**
   * Build complete prompt for AI generation
   */
  buildPrompt(context: PromptContext): BuiltPrompt {
    return {
      systemPrompt: this.buildSystemPrompt(),
      userPrompt: this.buildUserPrompt(context),
      outputSchema: this.getOutputSchema(context.questionType, context.dto),
    };
  }

  /**
   * Build system prompt (defines AI role and quality standards)
   */
  buildSystemPrompt(): string {
    return `You are an expert educational content creator and assessment designer with expertise in creating high-quality technical assessment questions.

Your role:
- Create clear, unambiguous questions suitable for professional technical assessments
- Ensure questions test actual understanding and practical application, not just memorization
- Provide accurate, well-explained answers with technical depth
- Generate plausible distractors for multiple-choice questions that test common misconceptions
- Include helpful explanations that teach the concept, not just state the answer
- Write in clear, professional language suitable for technical assessments

Quality standards:
- Questions must be technically accurate and up-to-date
- Language should be clear, concise, and professional
- Avoid ambiguous wording, trick questions, or gotchas
- Difficulty should match the specified level precisely
- All options in multiple-choice questions should be grammatically parallel
- Explanations should provide insight into the underlying concept
- Code examples (if any) should follow best practices

CRITICAL: You MUST respond with ONLY valid JSON. No markdown formatting, no code blocks, no additional text. Just pure JSON.`;
  }

  /**
   * Build user prompt for specific question generation
   */
  buildUserPrompt(context: PromptContext): string {
    const { dto, questionType, batchSize } = context;
    const count = batchSize || dto.numberOfQuestions;

    let prompt = `Generate ${count} ${this.getQuestionTypeLabel(questionType)} question(s) for a technical assessment.\n\n`;

    // Context
    prompt += `## Assessment Context:\n`;
    prompt += `- Topic: ${dto.mainTopic} - ${dto.subTopic}\n`;
    prompt += `- Difficulty Level: ${this.getDifficultyDescription(dto.difficulty)}\n`;
    prompt += `- Marks per Question: ${dto.marksPerQuestion}\n`;
    prompt += `- Estimated Time: ${dto.estimatedTime} seconds per question\n\n`;

    // Additional instructions
    if (dto.additionalInstructions) {
      prompt += `## Special Requirements:\n${dto.additionalInstructions}\n\n`;
    }

    // Question type specific instructions
    prompt += this.getQuestionTypeInstructions(questionType, dto);

    // Output format
    prompt += `\n## Output Format:\n`;
    prompt += `Return a JSON array with exactly ${count} question(s).\n`;
    prompt += `Each question must follow this exact structure:\n\n`;
    prompt += JSON.stringify([this.getOutputSchema(questionType, dto)], null, 2);
    prompt += `\n\n`;

    prompt += `CRITICAL INSTRUCTIONS:\n`;
    prompt += `- Respond with ONLY valid JSON - no markdown, no code blocks, no additional text\n`;
    prompt += `- Your response must start with [ and end with ]\n`;
    prompt += `- Ensure all JSON is properly escaped (quotes, newlines, special characters)\n`;
    prompt += `- Do NOT include trailing commas\n`;
    prompt += `- Do NOT use single quotes - only double quotes\n`;
    prompt += `- Verify your JSON is valid before responding`;

    return prompt;
  }

  /**
   * Get human-readable question type label
   */
  private getQuestionTypeLabel(type: QuestionType): string {
    const labels = {
      [QuestionType.MULTIPLE_CHOICE]: 'Multiple Choice (Single Correct Answer)',
      [QuestionType.MULTIPLE_RESPONSE]: 'Multiple Response (Multiple Correct Answers)',
      [QuestionType.TRUE_FALSE]: 'True/False',
      [QuestionType.SHORT_ANSWER]: 'Short Answer',
      [QuestionType.CODING]: 'Coding Challenge',
      [QuestionType.SUBJECTIVE]: 'Subjective',
      [QuestionType.ESSAY]: 'Essay',
      [QuestionType.FILL_BLANK]: 'Fill in the Blank',
    };
    return labels[type] || type;
  }

  /**
   * Get difficulty level description with guidance
   */
  private getDifficultyDescription(level: DifficultyLevel): string {
    const descriptions = {
      [DifficultyLevel.EASY]: 'EASY - Basic concepts, definitions, syntax. Suitable for beginners. Should be answerable with fundamental knowledge.',
      [DifficultyLevel.MEDIUM]: 'MEDIUM - Application of concepts, problem-solving, understanding relationships. Requires practical experience.',
      [DifficultyLevel.HARD]: 'HARD - Complex scenarios, optimization, trade-offs, advanced concepts. Requires deep understanding and experience.',
      [DifficultyLevel.EXPERT]: 'EXPERT - Cutting-edge concepts, system design, architectural decisions, edge cases. Requires extensive expertise.',
    };
    return descriptions[level] || level;
  }

  /**
   * Get type-specific instructions
   */
  private getQuestionTypeInstructions(type: QuestionType, dto: GenerateQuestionsDto): string {
    switch (type) {
      case QuestionType.MULTIPLE_CHOICE:
        return this.getMultipleChoiceInstructions(dto);

      case QuestionType.MULTIPLE_RESPONSE:
        return this.getMultipleResponseInstructions(dto);

      case QuestionType.TRUE_FALSE:
        return this.getTrueFalseInstructions(dto);

      case QuestionType.SHORT_ANSWER:
        return this.getShortAnswerInstructions(dto);

      case QuestionType.CODING:
        return this.getCodingInstructions(dto);

      case QuestionType.FILL_BLANK:
        return this.getFillBlankInstructions(dto);

      default:
        return '';
    }
  }

  /**
   * Multiple Choice instructions
   */
  private getMultipleChoiceInstructions(dto: GenerateQuestionsDto): string {
    return `## Question Type: Multiple Choice (Single Correct Answer)

Requirements:
- Provide exactly 4 options labeled A, B, C, D
- Only ONE option should be correct
- All distractors must be plausible but clearly incorrect to someone with proper understanding
- Avoid "All of the above" or "None of the above" unless absolutely necessary
- Options should be roughly similar in length
- Avoid patterns like "correct answer is always B"
${dto.includeExplanations ? '- Provide a detailed explanation (100-200 words) that:\n  * Explains why the correct answer is right\n  * Explains why each distractor is wrong\n  * Teaches the underlying concept' : ''}
${dto.includeHints ? '- Include 1-2 subtle hints that guide thinking without revealing the answer' : ''}

Distractor Guidelines:
- Use common misconceptions or errors
- Include answers that would be correct under slightly different conditions
- Test understanding of subtle differences`;
  }

  /**
   * Multiple Response instructions
   */
  private getMultipleResponseInstructions(dto: GenerateQuestionsDto): string {
    return `## Question Type: Multiple Response (Multiple Correct Answers)

Requirements:
- Provide 4-6 options
- At least 2 options must be correct (but not all)
- Mark each option as correct or incorrect
- Incorrect options should be plausible
- Clearly indicate in the question that multiple answers may be correct
${dto.includeExplanations ? '- Provide explanation for each option (why it\'s correct or incorrect)' : ''}
${dto.includeHints ? '- Include a hint about how many answers are correct (e.g., "Select all that apply" or "2-3 options are correct")' : ''}`;
  }

  /**
   * True/False instructions
   */
  private getTrueFalseInstructions(dto: GenerateQuestionsDto): string {
    return `## Question Type: True/False

Requirements:
- Create a clear, unambiguous statement
- The answer should definitively be either true or false
- Avoid edge cases where the answer could be "it depends"
- Don't use absolute terms like "always" or "never" unless factually accurate
- Test understanding of important concepts, not trivia
${dto.includeExplanations ? '- Explain why the statement is true or false with technical reasoning and context' : ''}
${dto.includeHints ? '- Provide a hint that helps recall the relevant concept without giving away the answer' : ''}`;
  }

  /**
   * Short Answer instructions
   */
  private getShortAnswerInstructions(dto: GenerateQuestionsDto): string {
    return `## Question Type: Short Answer

Requirements:
- Question should have a specific, concise answer (1-3 sentences or specific terms/values)
- Provide a model answer that would receive full marks
- If multiple phrasings are acceptable, list them as an array
- Answer should be verifiable and objective
${dto.includeExplanations ? '- Explain the concept being tested and why this answer is correct' : ''}
${dto.includeHints ? '- Provide a hint about the key concept, formula, or approach needed' : ''}`;
  }

  /**
   * Coding instructions
   */
  private getCodingInstructions(dto: GenerateQuestionsDto): string {
    return `## Question Type: Coding Challenge

Requirements:
- Provide a clear problem statement with:
  * Input/output specifications
  * Constraints (time/space complexity if relevant)
  * Edge cases to consider
- Include at least 3 test cases:
  * Basic case (isHidden: false)
  * Edge case (isHidden: false)
  * Complex case (isHidden: true for evaluation only)
- Specify allowed programming languages (JavaScript, Python, Java, C++, etc.)
- Provide a reference solution that passes all test cases
- Set reasonable time and memory limits
${dto.includeExplanations ? '- Explain the optimal approach, algorithm, and time/space complexity' : ''}
${dto.includeHints ? '- Provide hints about the algorithm or data structure to use' : ''}

Code Quality:
- Problem should be solvable within the estimated time
- Test cases should cover normal, edge, and boundary conditions
- Reference solution should follow best practices`;
  }

  /**
   * Fill in the Blank instructions
   */
  private getFillBlankInstructions(dto: GenerateQuestionsDto): string {
    return `## Question Type: Fill in the Blank

Requirements:
- Use underscores (___) to indicate blanks in the question text
- Provide the exact word(s) or phrase(s) that fill the blank(s)
- If multiple acceptable answers exist, list them
- Blanks should test key terms or concepts, not trivial details
${dto.includeExplanations ? '- Explain the concept and why this term/phrase is correct' : ''}
${dto.includeHints ? '- Provide hints about the type of answer (e.g., "a design pattern", "a keyword", etc.)' : ''}`;
  }

  /**
   * Get JSON schema for expected output
   */
  private getOutputSchema(type: QuestionType, dto: GenerateQuestionsDto): any {
    const baseSchema: any = {
      text: 'string (the question text)',
      type: type,
      difficulty: dto.difficulty,
      category: dto.mainTopic,
      subcategory: dto.subTopic,
      marks: dto.marksPerQuestion,
      estimatedTime: dto.estimatedTime,
    };

    if (dto.includeNegativeMarking && dto.negativeMarks) {
      baseSchema.negativeMarks = dto.negativeMarks;
    }

    if (dto.tags && dto.tags.length > 0) {
      baseSchema.tags = dto.tags;
    }

    switch (type) {
      case QuestionType.MULTIPLE_CHOICE:
        return {
          ...baseSchema,
          options: [
            { text: 'Option A text', isCorrect: false },
            { text: 'Option B text', isCorrect: true },
            { text: 'Option C text', isCorrect: false },
            { text: 'Option D text', isCorrect: false },
          ],
          correctAnswer: 'The text of the correct option',
          ...(dto.includeExplanations && { explanation: 'Detailed explanation of why the answer is correct and why distractors are wrong' }),
          ...(dto.includeHints && { hints: ['Hint 1', 'Hint 2 (optional)'] }),
        };

      case QuestionType.MULTIPLE_RESPONSE:
        return {
          ...baseSchema,
          options: [
            { text: 'Option 1', isCorrect: true },
            { text: 'Option 2', isCorrect: false },
            { text: 'Option 3', isCorrect: true },
            { text: 'Option 4', isCorrect: false },
          ],
          correctAnswer: ['Array of all correct option texts'],
          ...(dto.includeExplanations && { explanation: 'Explanation for each option' }),
          ...(dto.includeHints && { hints: ['Hint about the question'] }),
        };

      case QuestionType.TRUE_FALSE:
        return {
          ...baseSchema,
          options: [
            { text: 'True', isCorrect: 'boolean' },
            { text: 'False', isCorrect: 'boolean' },
          ],
          correctAnswer: 'boolean (true or false)',
          ...(dto.includeExplanations && { explanation: 'Explanation of why the statement is true or false' }),
          ...(dto.includeHints && { hints: ['Hint to guide thinking'] }),
        };

      case QuestionType.SHORT_ANSWER:
        return {
          ...baseSchema,
          correctAnswer: 'string or array of acceptable answers',
          ...(dto.includeExplanations && { explanation: 'Explanation of the concept' }),
          ...(dto.includeHints && { hints: ['Hint about the concept or approach'] }),
        };

      case QuestionType.CODING:
        return {
          ...baseSchema,
          codingDetails: {
            language: ['JAVASCRIPT', 'PYTHON', 'JAVA', 'CPP'],
            testCases: [
              {
                input: 'string representation of input',
                expectedOutput: 'string representation of expected output',
                isHidden: false,
              },
              {
                input: 'edge case input',
                expectedOutput: 'edge case output',
                isHidden: false,
              },
              {
                input: 'complex case input',
                expectedOutput: 'complex case output',
                isHidden: true,
              },
            ],
            timeLimit: 5,
            memoryLimit: 256,
            referenceSolution: 'Complete working solution code',
          },
          ...(dto.includeExplanations && { explanation: 'Algorithm explanation with time/space complexity analysis' }),
          ...(dto.includeHints && { hints: ['Algorithm hint', 'Data structure hint'] }),
        };

      case QuestionType.FILL_BLANK:
        return {
          ...baseSchema,
          text: 'Question with ___ indicating blank(s)',
          correctAnswer: 'string or array of acceptable answers for the blank(s)',
          ...(dto.includeExplanations && { explanation: 'Explanation of the concept' }),
          ...(dto.includeHints && { hints: ['Hint about the type of answer expected'] }),
        };

      default:
        return baseSchema;
    }
  }

  /**
   * Build batch prompts for large requests
   * Splits large requests into smaller batches for better results
   */
  buildBatchPrompts(dto: GenerateQuestionsDto, batchSize: number = 5): PromptContext[] {
    const batches: PromptContext[] = [];

    // Group by question type
    for (const questionType of dto.questionTypes) {
      const questionsPerType = Math.ceil(dto.numberOfQuestions / dto.questionTypes.length);
      const numBatches = Math.ceil(questionsPerType / batchSize);

      for (let i = 0; i < numBatches; i++) {
        const remainingQuestions = questionsPerType - (i * batchSize);
        const currentBatchSize = Math.min(batchSize, remainingQuestions);

        batches.push({
          dto: {
            ...dto,
            numberOfQuestions: currentBatchSize,
            questionTypes: [questionType],
          },
          questionType,
          batchIndex: i,
          batchSize: currentBatchSize,
        });
      }
    }

    return batches;
  }

  /**
   * Build prompt for regenerating a single question
   */
  buildRegeneratePrompt(
    originalQuestion: any,
    additionalInstructions?: string,
  ): BuiltPrompt {
    const context: PromptContext = {
      dto: {
        mainTopic: originalQuestion.category,
        subTopic: originalQuestion.subcategory,
        difficulty: originalQuestion.difficulty,
        numberOfQuestions: 1,
        questionTypes: [originalQuestion.type],
        marksPerQuestion: originalQuestion.marks,
        additionalInstructions: additionalInstructions || 'Generate a different question on the same topic with similar difficulty',
        includeNegativeMarking: !!originalQuestion.negativeMarks,
        negativeMarks: originalQuestion.negativeMarks,
        includeExplanations: !!originalQuestion.explanation,
        includeHints: !!originalQuestion.hints?.length,
        estimatedTime: originalQuestion.estimatedTime || 120,
        tags: originalQuestion.tags,
      },
      questionType: originalQuestion.type,
      batchSize: 1,
    };

    return this.buildPrompt(context);
  }
}
