import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { ILLMProvider, LLMRequest, LLMResponse } from './llm-provider.interface';

@Injectable()
export class GeminiProviderService implements ILLMProvider {
  private readonly logger = new Logger(GeminiProviderService.name);
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.configService.get<string>('GEMINI_MODEL', 'gemini-1.5-flash');
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const model = this.client.getGenerativeModel({
        model: this.model,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      });

      // Combine system and user prompts
      const fullPrompt = `${request.systemPrompt}\n\n${request.userPrompt}`;

      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      const latency = Date.now() - startTime;

      // Gemini doesn't provide token counts directly, estimate
      const estimatedTokens = Math.ceil(text.length / 4);

      return {
        content: text,
        tokensUsed: estimatedTokens,
        cost: 0, // Free tier
        latency,
        model: this.model,
      };
    } catch (error) {
      this.logger.error('Gemini API error', error);
      throw new Error(`Gemini generation failed: ${error.message}`);
    }
  }

  async generateStructuredOutput<T>(request: LLMRequest, schema: any): Promise<T> {
    const enhancedPrompt = `${request.userPrompt}\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no code blocks, no additional text. Just raw JSON.\n\nRequired JSON structure:\n${JSON.stringify(schema, null, 2)}`;

    const response = await this.generateCompletion({
      ...request,
      userPrompt: enhancedPrompt,
    });

    try {
      let jsonStr = response.content.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '').replace(/```\n?$/g, '');
      }

      // Find JSON boundaries
      const jsonStart = Math.min(
        jsonStr.indexOf('{') !== -1 ? jsonStr.indexOf('{') : Infinity,
        jsonStr.indexOf('[') !== -1 ? jsonStr.indexOf('[') : Infinity,
      );

      if (jsonStart !== Infinity && jsonStart > 0) {
        jsonStr = jsonStr.substring(jsonStart);
      }

      const jsonEnd = Math.max(
        jsonStr.lastIndexOf('}'),
        jsonStr.lastIndexOf(']'),
      );

      if (jsonEnd !== -1 && jsonEnd < jsonStr.length - 1) {
        jsonStr = jsonStr.substring(0, jsonEnd + 1);
      }

      return JSON.parse(jsonStr) as T;
    } catch (error) {
      this.logger.error('Failed to parse Gemini response as JSON', {
        error: error.message,
        response: response.content.substring(0, 500),
      });
      throw new Error(`Invalid JSON response from Gemini: ${error.message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: this.model });
      const result = await model.generateContent('test');
      const response = await result.response;
      return !!response.text();
    } catch {
      return false;
    }
  }

  getName(): string {
    return 'Gemini';
  }

  getModel(): string {
    return this.model;
  }
}
