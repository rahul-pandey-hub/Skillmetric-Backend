# AI Questions Module - Schemas & DTOs Summary

## ✅ Created Files

### Schemas (Database Models)

**1. `schemas/ai-generation.schema.ts`** - Main database schema
- **Purpose**: Store AI question generation history and results
- **Collection**: `aigeneration`

#### Key Features:

**Enums:**
```typescript
GenerationStatus: PENDING | IN_PROGRESS | COMPLETED | PARTIAL | FAILED
AIProvider: GEMINI | OPENAI | ANTHROPIC | AZURE_OPENAI
```

**Main Fields:**
- **Request Parameters**: Topic, difficulty, question count, types, marks
- **AI Provider Info**: Provider name, model, prompt version
- **Generation Results**: Generated questions array, counts, errors
- **Performance Metrics**: Generation time, API cost, tokens used
- **Saved Questions**: References to saved Question documents
- **Audit Fields**: Created by, organization, timestamps

**Embedded Schemas:**
- `GeneratedQuestionData`: Temporary question storage before approval
- `AIMetadata`: Per-question AI generation metadata
- `GenerationError`: Track individual question failures

**Indexes:**
```typescript
- { organizationId: 1, createdBy: 1, createdAt: -1 }
- { status: 1, createdAt: -1 }
- { mainTopic: 1, subTopic: 1, difficulty: 1 }
- { aiProvider: 1, aiModel: 1 }
- { organizationId: 1, status: 1, createdAt: -1 }
```

---

### DTOs (Data Transfer Objects)

**2. `dto/generate-questions.dto.ts`** - Input validation for generation
- Validates user input for question generation
- Class-validator decorators
- Custom error messages

**Validation Rules:**
```typescript
mainTopic: QuestionCategory enum (required)
subTopic: string, max 100 chars (required)
difficulty: DifficultyLevel enum (required)
numberOfQuestions: integer, 1-50 (required)
questionTypes: QuestionType enum array, min 1 (required)
marksPerQuestion: number, 0.5-10 (required)
additionalInstructions: string, max 500 chars (optional)
includeNegativeMarking: boolean (required)
negativeMarks: number, 0-10 (conditional, required if includeNegativeMarking=true)
includeExplanations: boolean (required)
includeHints: boolean (required)
estimatedTime: integer, 30-1800 seconds (required)
tags: string array (optional)
```

**3. `dto/save-questions.dto.ts`** - Validation for saving approved questions
- Validates which questions to save
- Optional save configuration

**Structure:**
```typescript
SaveQuestionsDto:
  - questionIds: string[] (min 1 required)
  - options?: SaveOptionsDto

SaveOptionsDto:
  - addToQuestionPool?: boolean
  - questionPoolId?: string (MongoDB ObjectId, required if addToQuestionPool=true)
  - markAsPublic?: boolean
  - additionalTags?: string[]
  - customMetadata?: Record<string, any>
```

**4. `dto/regenerate-question.dto.ts`** - Validation for regenerating single question
- Validates regeneration request

**Fields:**
```typescript
questionIndex: integer, min 0 (required)
additionalInstructions?: string, max 500 chars (optional)
```

**5. `dto/index.ts`** - Export barrel
- Centralized exports for easy importing

**6. `schemas/index.ts`** - Export barrel
- Centralized schema exports

---

## Schema Relationships

```
AIGeneration (aigeneration collection)
├── References existing Question schema enums
│   ├── QuestionType
│   ├── DifficultyLevel
│   └── QuestionCategory
├── Stores temporary questions in generatedQuestions array
│   └── GeneratedQuestionData (embedded)
├── Links to saved questions via savedQuestions array
│   └── ObjectId references to Question collection
├── Belongs to Organization
│   └── organizationId: ObjectId -> Organization
└── Created by User
    └── createdBy: ObjectId -> User
```

---

## Data Flow

### 1. Generation Request Flow
```
User Input (Frontend)
    ↓
GenerateQuestionsDto (Validation)
    ↓
AIGeneration Document Created (status: PENDING)
    ↓
AI Provider Called (Gemini)
    ↓
Questions Generated and Stored in generatedQuestions[]
    ↓
AIGeneration Updated (status: COMPLETED)
    ↓
Response to Frontend
```

### 2. Save Flow
```
User Approves Questions (Frontend)
    ↓
SaveQuestionsDto (Validation)
    ↓
For each questionId:
  - Convert GeneratedQuestionData → Question
  - Save to questions collection
  - Store ObjectId in savedQuestions[]
    ↓
AIGeneration Updated (savedAt: timestamp)
    ↓
Response with saved question IDs
```

---

## Example Usage

### Creating a Generation Request

```typescript
const generationDto: GenerateQuestionsDto = {
  mainTopic: QuestionCategory.PROGRAMMING,
  subTopic: 'Java',
  difficulty: DifficultyLevel.MEDIUM,
  numberOfQuestions: 10,
  questionTypes: [QuestionType.MULTIPLE_CHOICE],
  marksPerQuestion: 2,
  additionalInstructions: 'Focus on Java 17 features',
  includeNegativeMarking: false,
  includeExplanations: true,
  includeHints: true,
  estimatedTime: 120,
  tags: ['java', 'programming', 'java17'],
};
```

### Creating AIGeneration Document

```typescript
const generation = await this.aiGenerationModel.create({
  // Request params
  mainTopic: dto.mainTopic,
  subTopic: dto.subTopic,
  difficulty: dto.difficulty,
  numberOfQuestions: dto.numberOfQuestions,
  questionTypes: dto.questionTypes,
  marksPerQuestion: dto.marksPerQuestion,
  additionalInstructions: dto.additionalInstructions,
  includeNegativeMarking: dto.includeNegativeMarking,
  negativeMarks: dto.negativeMarks,
  includeExplanations: dto.includeExplanations,
  includeHints: dto.includeHints,
  estimatedTime: dto.estimatedTime,
  tags: dto.tags,

  // AI provider info
  aiProvider: AIProvider.GEMINI,
  aiModel: 'gemini-1.5-flash',
  promptVersion: 'v1.0',

  // Initial status
  status: GenerationStatus.PENDING,
  requestedCount: dto.numberOfQuestions,
  generatedCount: 0,
  failedCount: 0,

  // Audit
  createdBy: userId,
  organizationId: organizationId,
});
```

### Storing Generated Questions

```typescript
generation.generatedQuestions = [
  {
    tempId: 'q1',
    text: 'What is the time complexity of...',
    type: QuestionType.MULTIPLE_CHOICE,
    difficulty: DifficultyLevel.MEDIUM,
    category: QuestionCategory.PROGRAMMING,
    subcategory: 'Java',
    options: [
      { text: 'O(n)', isCorrect: false },
      { text: 'O(log n)', isCorrect: true },
      { text: 'O(n²)', isCorrect: false },
      { text: 'O(1)', isCorrect: false },
    ],
    correctAnswer: 'O(log n)',
    explanation: 'Binary search divides...',
    hints: ['Think about divide and conquer'],
    marks: 2,
    negativeMarks: 0,
    estimatedTime: 120,
    tags: ['java', 'algorithms'],
    aiMetadata: {
      model: 'gemini-1.5-flash',
      promptVersion: 'v1.0',
      generationTime: 1200,
      tokensUsed: 500,
      batchIndex: 0,
    },
    generatedAt: new Date(),
  },
  // ... more questions
];

generation.status = GenerationStatus.COMPLETED;
generation.generatedCount = 10;
generation.failedCount = 0;
generation.totalGenerationTime = 5000;
generation.tokensUsed = 5000;
generation.apiCost = 0; // Free tier

await generation.save();
```

### Saving Approved Questions

```typescript
const saveDto: SaveQuestionsDto = {
  questionIds: ['q1', 'q2', 'q3'], // tempIds from generatedQuestions
  options: {
    addToQuestionPool: true,
    questionPoolId: '507f1f77bcf86cd799439011',
    markAsPublic: false,
    additionalTags: ['ai-generated'],
  },
};

// After saving to questions collection
generation.savedQuestions = [
  new Types.ObjectId('507f1f77bcf86cd799439012'),
  new Types.ObjectId('507f1f77bcf86cd799439013'),
  new Types.ObjectId('507f1f77bcf86cd799439014'),
];
generation.savedAt = new Date();
generation.savedBy = userId;
await generation.save();
```

---

## Validation Examples

### Valid Generation Request
```typescript
{
  mainTopic: "PROGRAMMING",
  subTopic: "JavaScript",
  difficulty: "EASY",
  numberOfQuestions: 5,
  questionTypes: ["MULTIPLE_CHOICE", "TRUE_FALSE"],
  marksPerQuestion: 1,
  includeNegativeMarking: false,
  includeExplanations: true,
  includeHints: false,
  estimatedTime: 60
}
✅ Valid
```

### Invalid Requests

```typescript
{
  mainTopic: "PROGRAMMING",
  subTopic: "JavaScript",
  difficulty: "EASY",
  numberOfQuestions: 100, // ❌ Exceeds max (50)
  // ...
}
→ Error: "numberOfQuestions cannot exceed 50"
```

```typescript
{
  mainTopic: "PROGRAMMING",
  subTopic: "JavaScript",
  difficulty: "EASY",
  numberOfQuestions: 5,
  questionTypes: [], // ❌ Empty array
  // ...
}
→ Error: "At least one question type must be selected"
```

```typescript
{
  mainTopic: "PROGRAMMING",
  subTopic: "JavaScript",
  difficulty: "EASY",
  numberOfQuestions: 5,
  questionTypes: ["MULTIPLE_CHOICE"],
  marksPerQuestion: 1,
  includeNegativeMarking: true,
  // ❌ Missing negativeMarks
  // ...
}
→ Error: "negativeMarks is required when includeNegativeMarking is true"
```

---

## Database Queries

### Find All Generations for Organization
```typescript
await this.aiGenerationModel.find({
  organizationId: orgId,
  isActive: true,
})
.sort({ createdAt: -1 })
.populate('createdBy', 'name email')
.exec();
```

### Find by Status
```typescript
await this.aiGenerationModel.find({
  organizationId: orgId,
  status: GenerationStatus.COMPLETED,
})
.sort({ createdAt: -1 })
.exec();
```

### Find by Topic
```typescript
await this.aiGenerationModel.find({
  organizationId: orgId,
  mainTopic: QuestionCategory.PROGRAMMING,
  subTopic: 'Java',
  difficulty: DifficultyLevel.MEDIUM,
})
.exec();
```

### Get Generation with Saved Questions
```typescript
await this.aiGenerationModel.findById(generationId)
  .populate('savedQuestions')
  .populate('createdBy', 'name email')
  .exec();
```

---

## Next Steps

With schemas and DTOs complete, you can now:

1. ✅ **Install Dependencies** (if not done)
   ```bash
   cd backend
   npm install class-validator class-transformer
   ```

2. **Next Implementation Priority:**
   - ⏳ **Prompt Builder Service** (constructs AI prompts)
   - ⏳ **Response Parser Service** (parses AI JSON responses)
   - ⏳ **Question Validator Service** (validates quality)
   - ⏳ **AI Generation Service** (main orchestrator)

3. **Testing**
   - Can now write unit tests for DTOs
   - Can test schema creation and validation

---

## File Locations

```
backend/src/modules/ai-questions/
├── schemas/
│   ├── ai-generation.schema.ts  ✅ Created
│   └── index.ts                 ✅ Created
└── dto/
    ├── generate-questions.dto.ts     ✅ Created
    ├── save-questions.dto.ts         ✅ Created
    ├── regenerate-question.dto.ts    ✅ Created
    └── index.ts                      ✅ Created
```

---

## Summary

✅ **Complete database schema** for AI generation history
✅ **Full input validation** with class-validator
✅ **Embedded schemas** for complex nested data
✅ **Efficient indexes** for common queries
✅ **Comprehensive error tracking**
✅ **Audit trail** for all generations
✅ **Flexible save options** for approved questions

Ready to proceed with **Services** implementation!
