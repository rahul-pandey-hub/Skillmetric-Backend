export interface LLMProviderConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  schema?: any; // JSON schema for structured output
}

export interface LLMResponse {
  content: string;
  tokensUsed: number;
  cost?: number;
  latency: number;
  model: string;
}

export interface ILLMProvider {
  /**
   * Generate text completion
   */
  generateCompletion(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Generate structured JSON output
   */
  generateStructuredOutput<T>(request: LLMRequest, schema: any): Promise<T>;

  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get provider name
   */
  getName(): string;

  /**
   * Get model info
   */
  getModel(): string;
}
