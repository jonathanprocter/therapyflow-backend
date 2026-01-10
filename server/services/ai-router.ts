/**
 * AI Router with Circuit Breaker Pattern
 * Ported from TherapyGenius - Provides resilient multi-provider AI access
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

interface AIProviderConfig {
  enabled: boolean;
  priority: number;
  timeoutMs: number;
  maxRetries: number;
}

interface AIRouterConfig {
  openai: AIProviderConfig;
  anthropic: AIProviderConfig;
  defaultTimeout: number;
  retryDelay: number;
  circuitBreakerFailureThreshold: number;
  circuitBreakerCooldownMs: number;
  hipaaCompliant: boolean;
}

// HIPAA Compliance Error
class HIPAAComplianceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HIPAAComplianceError';
  }
}

interface AIMetrics {
  requests: number;
  successes: number;
  failures: number;
  timeouts: number;
  rateLimitHits: number;
  lastError?: string;
  lastErrorCause?: AIError;
  lastSuccess?: string;
  averageLatency: number;
  cooldownUntil?: Date;
  consecutiveFailures: number;
  failureRate: number;
}

interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

enum AIProvider {
  OPENAI = "openai",
  ANTHROPIC = "anthropic"
}

enum AIError {
  TIMEOUT = "timeout",
  RATE_LIMIT = "rate_limit",
  SERVER_ERROR = "server_error",
  VALIDATION_ERROR = "validation_error",
  HIPAA_COMPLIANCE = "hipaa_compliance",
  CIRCUIT_BREAKER = "circuit_breaker",
  UNKNOWN = "unknown"
}

class AIRouter {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private config: AIRouterConfig;
  private metrics: Map<AIProvider, AIMetrics> = new Map();

  constructor(config?: Partial<AIRouterConfig>) {
    // CRITICAL: HIPAA Compliance Gate - Check environment variable
    const hipaaCompliant = process.env.HIPAA_SAFE_AI === 'true' || process.env.NODE_ENV !== 'production';

    this.config = {
      openai: { enabled: true, priority: 1, timeoutMs: 30000, maxRetries: 2 },
      anthropic: { enabled: true, priority: 2, timeoutMs: 30000, maxRetries: 2 },
      defaultTimeout: 30000,
      retryDelay: 1000,
      circuitBreakerFailureThreshold: 3,
      circuitBreakerCooldownMs: 60000, // 1 minute cooldown
      hipaaCompliant,
      ...config
    };

    console.log(`[AI Router] HIPAA Compliance Mode: ${this.config.hipaaCompliant ? 'ENABLED' : 'DISABLED'}`);
    if (!this.config.hipaaCompliant) {
      console.warn('[AI Router] ⚠️  WARNING: External AI providers are DISABLED due to HIPAA compliance. Set HIPAA_SAFE_AI=true to enable.');
    }

    // Only initialize AI clients if HIPAA compliance allows
    if (this.config.hipaaCompliant) {
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          timeout: this.config.openai.timeoutMs
        });
      }

      if (process.env.ANTHROPIC_API_KEY) {
        this.anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
          timeout: this.config.anthropic.timeoutMs
        });
      }
    }

    // Initialize metrics
    this.metrics.set(AIProvider.OPENAI, this.createEmptyMetrics());
    this.metrics.set(AIProvider.ANTHROPIC, this.createEmptyMetrics());
  }

  private createEmptyMetrics(): AIMetrics {
    return {
      requests: 0,
      successes: 0,
      failures: 0,
      timeouts: 0,
      rateLimitHits: 0,
      averageLatency: 0,
      consecutiveFailures: 0,
      failureRate: 0
    };
  }

  /**
   * HIPAA Compliance Gate - Validates that external AI usage is authorized
   */
  private validateHIPAACompliance(operation: string): void {
    if (!this.config.hipaaCompliant) {
      const error = `HIPAA COMPLIANCE VIOLATION: ${operation} blocked. External AI providers disabled for PHI protection. Set HIPAA_SAFE_AI=true to enable.`;
      console.error(`[AI Router] ${error}`);
      throw new HIPAAComplianceError(error);
    }
  }

  /**
   * Circuit Breaker Pattern - Check if provider is in cooldown
   */
  private isProviderInCooldown(provider: AIProvider): boolean {
    const metrics = this.metrics.get(provider);
    if (!metrics?.cooldownUntil) return false;

    const inCooldown = new Date() < metrics.cooldownUntil;
    if (!inCooldown) {
      metrics.cooldownUntil = undefined;
      metrics.consecutiveFailures = 0;
    }
    return inCooldown;
  }

  /**
   * Circuit Breaker Pattern - Trigger cooldown if failure threshold exceeded
   */
  private checkCircuitBreaker(provider: AIProvider): void {
    const metrics = this.metrics.get(provider)!;

    if (metrics.consecutiveFailures >= this.config.circuitBreakerFailureThreshold) {
      metrics.cooldownUntil = new Date(Date.now() + this.config.circuitBreakerCooldownMs);
      console.warn(`[AI Router] Circuit breaker activated for ${provider}. Cooldown until ${metrics.cooldownUntil.toISOString()}`);
    }
  }

  /**
   * Health-aware provider selection with load balancing
   */
  private getProviderOrder(): AIProvider[] {
    const providers = [
      { provider: AIProvider.OPENAI, config: this.config.openai, client: this.openai },
      { provider: AIProvider.ANTHROPIC, config: this.config.anthropic, client: this.anthropic }
    ];

    const availableProviders = providers
      .filter(p => p.config.enabled && p.client && !this.isProviderInCooldown(p.provider))
      .map(p => {
        const metrics = this.metrics.get(p.provider)!;
        return {
          provider: p.provider,
          priority: p.config.priority,
          failureRate: metrics.failureRate,
          averageLatency: metrics.averageLatency,
          healthScore: this.calculateHealthScore(p.provider)
        };
      });

    if (availableProviders.length === 0) {
      throw new Error('No healthy AI providers available. All providers are in cooldown or disabled.');
    }

    return availableProviders
      .sort((a, b) => {
        if (Math.abs(a.healthScore - b.healthScore) > 0.1) {
          return b.healthScore - a.healthScore;
        }
        return a.priority - b.priority;
      })
      .map(p => p.provider);
  }

  /**
   * Calculate health score based on failure rate and latency
   */
  private calculateHealthScore(provider: AIProvider): number {
    const metrics = this.metrics.get(provider)!;

    if (metrics.requests === 0) return 1.0;

    const successRate = 1 - metrics.failureRate;
    const latencyScore = Math.max(0, 1 - (metrics.averageLatency / 10000));

    return (successRate * 0.7) + (latencyScore * 0.3);
  }

  private updateMetrics(provider: AIProvider, success: boolean, latency: number, errorType?: AIError) {
    const metrics = this.metrics.get(provider)!;
    metrics.requests++;

    if (success) {
      metrics.successes++;
      metrics.lastSuccess = new Date().toISOString();
      metrics.consecutiveFailures = 0;
      metrics.averageLatency = (metrics.averageLatency * (metrics.successes - 1) + latency) / metrics.successes;
    } else {
      metrics.failures++;
      metrics.consecutiveFailures++;
      metrics.lastError = new Date().toISOString();
      metrics.lastErrorCause = errorType;

      if (errorType === AIError.TIMEOUT) metrics.timeouts++;
      if (errorType === AIError.RATE_LIMIT) metrics.rateLimitHits++;

      this.checkCircuitBreaker(provider);
    }

    metrics.failureRate = Math.min(metrics.failures / Math.max(metrics.requests, 1), 1);
  }

  private classifyError(error: unknown): AIError {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";
    const errorCode = (error as any)?.code || (error as any)?.status;

    if (error instanceof HIPAAComplianceError) {
      return AIError.HIPAA_COMPLIANCE;
    }
    if (errorMessage.includes("timeout") || errorCode === "ETIMEDOUT" || errorMessage.includes("abort")) {
      return AIError.TIMEOUT;
    }
    if (errorCode === 429 || errorMessage.includes("rate limit")) {
      return AIError.RATE_LIMIT;
    }
    if (errorCode >= 500 && errorCode < 600) {
      return AIError.SERVER_ERROR;
    }
    if (errorMessage.includes("validation") || errorMessage.includes("invalid") || errorMessage.includes("parse")) {
      return AIError.VALIDATION_ERROR;
    }
    if (errorMessage.includes("circuit breaker") || errorMessage.includes("cooldown")) {
      return AIError.CIRCUIT_BREAKER;
    }
    return AIError.UNKNOWN;
  }

  private shouldRetry(error: AIError, attempt: number, maxRetries: number): boolean {
    if (attempt >= maxRetries) return false;
    return [AIError.TIMEOUT, AIError.RATE_LIMIT, AIError.SERVER_ERROR].includes(error);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Recursively convert null values to undefined for Zod compatibility
   */
  private preprocessForValidation(obj: any): any {
    if (obj === null) {
      return undefined;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.preprocessForValidation(item));
    }
    if (typeof obj === 'object' && obj !== null) {
      const processed: any = {};
      for (const [key, value] of Object.entries(obj)) {
        processed[key] = this.preprocessForValidation(value);
      }
      return processed;
    }
    return obj;
  }

  private validateJsonOutput<T>(output: any, schema?: z.ZodSchema<T>): T {
    if (schema) {
      try {
        const preprocessedOutput = this.preprocessForValidation(output);
        return schema.parse(preprocessedOutput);
      } catch (error) {
        console.error('[AI Router] JSON validation failed. Original output:', JSON.stringify(output, null, 2));
        throw new Error(`JSON validation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return output;
  }

  private async executeWithProvider<T>(
    provider: AIProvider,
    operation: string,
    executor: () => Promise<T>,
    schema?: z.ZodSchema<T>,
    timeoutMs?: number
  ): Promise<T> {
    if (this.isProviderInCooldown(provider)) {
      throw new Error(`Provider ${provider} is in circuit breaker cooldown`);
    }

    const config = provider === AIProvider.OPENAI ? this.config.openai : this.config.anthropic;
    const effectiveTimeout = timeoutMs || config.timeoutMs;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      const startTime = Date.now();
      const abortController = new AbortController();

      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, effectiveTimeout + 5000);

      try {
        console.log(`[AI Router] Attempting ${operation} with ${provider} (attempt ${attempt + 1}/${config.maxRetries})`);

        const result = await Promise.race([
          executor(),
          new Promise<never>((_, reject) => {
            abortController.signal.addEventListener('abort', () => {
              reject(new Error('Operation timed out by abort controller'));
            });
          })
        ]);

        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;

        const validatedResult = this.validateJsonOutput(result, schema);

        this.updateMetrics(provider, true, latency);
        console.log(`[AI Router] Success: ${operation} with ${provider} in ${latency}ms`);

        return validatedResult;
      } catch (error) {
        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;
        const errorType = this.classifyError(error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        this.updateMetrics(provider, false, latency, errorType);
        lastError = error instanceof Error ? error : new Error(String(error));

        console.error(`[AI Router] Error: ${operation} with ${provider} (attempt ${attempt + 1}): ${errorMessage}`);

        if (!this.shouldRetry(errorType, attempt, config.maxRetries)) {
          break;
        }

        if (attempt < config.maxRetries - 1) {
          const delayMs = this.config.retryDelay * Math.pow(2, attempt);
          console.log(`[AI Router] Retrying ${operation} with ${provider} in ${delayMs}ms...`);
          await this.delay(delayMs);
        }
      }
    }

    throw lastError || new Error('Unknown error occurred');
  }

  /**
   * Simple chat completion returning plain text
   */
  async chat(
    messages: AIMessage[],
    options?: { maxTokens?: number }
  ): Promise<{ content: string }> {
    this.validateHIPAACompliance('chat');

    const providers = this.getProviderOrder();
    let lastError: Error | null = null;

    for (const provider of providers) {
      try {
        const result = await this.executeWithProvider(
          provider,
          "chat",
          async () => {
            if (provider === AIProvider.OPENAI) {
              const response = await this.openai?.chat.completions.create({
                model: "gpt-4o",
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                max_tokens: options?.maxTokens || 2000
              });
              return { content: response?.choices[0]?.message?.content || '' };
            } else {
              const response = await this.anthropic?.messages.create({
                model: "claude-sonnet-4-20250514",
                max_tokens: options?.maxTokens || 2000,
                messages: messages.filter(m => m.role !== 'system').map(m => ({
                  role: m.role as 'user' | 'assistant',
                  content: m.content
                })),
                system: messages.find(m => m.role === 'system')?.content
              });
              const textContent = response?.content?.find((c: any) => c.type === 'text');
              return { content: (textContent as any)?.text || '' };
            }
          }
        );
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[AI Router] Provider ${provider} failed for chat`);
      }
    }

    throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
  }

  /**
   * Unified interface for structured JSON chat completions
   */
  async chatJSON<T>(
    messages: AIMessage[],
    schema?: z.ZodSchema<T>,
    options?: { systemPrompt?: string; maxTokens?: number }
  ): Promise<T> {
    this.validateHIPAACompliance('chatJSON');

    const providers = this.getProviderOrder();
    let lastError: Error | null = null;

    for (const provider of providers) {
      try {
        return await this.executeWithProvider(
          provider,
          "chatJSON",
          async () => {
            if (provider === AIProvider.OPENAI) {
              return await this.chatJSONOpenAI(messages, options);
            } else {
              return await this.chatJSONAnthropic(messages, options);
            }
          },
          schema
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[AI Router] Provider ${provider} failed for chatJSON, trying next provider...`);
      }
    }

    throw new Error(`All AI providers failed for chatJSON. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  private async chatJSONOpenAI(
    messages: AIMessage[],
    options?: { systemPrompt?: string; maxTokens?: number }
  ): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const openaiMessages = messages.map(msg => ({
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content
    }));

    if (options?.systemPrompt) {
      openaiMessages.unshift({
        role: "system",
        content: options.systemPrompt
      });
    }

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: openaiMessages,
      response_format: { type: "json_object" },
      max_tokens: options?.maxTokens || 2048
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  }

  private async chatJSONAnthropic(
    messages: AIMessage[],
    options?: { systemPrompt?: string; maxTokens?: number }
  ): Promise<any> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const anthropicMessages = messages
      .filter(msg => msg.role !== "system")
      .map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content
      }));

    const systemMessage = messages.find(msg => msg.role === "system")?.content || options?.systemPrompt || "";
    const finalSystemPrompt = systemMessage + "\n\nAlways respond with valid JSON format.";

    const response: any = await this.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      system: finalSystemPrompt,
      messages: anthropicMessages,
      max_tokens: options?.maxTokens || 2048
    });

    const content = response.content[0];
    if (content.type === "text") {
      let jsonText = content.text.trim();
      if (jsonText.startsWith('```json') || jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      return JSON.parse(jsonText);
    }
    throw new Error("Unexpected response format from Anthropic");
  }

  /**
   * Text summarization functionality
   */
  async summarize(text: string, options?: { maxLength?: number; style?: "brief" | "detailed" }): Promise<string> {
    const maxLength = options?.maxLength || 200;
    const style = options?.style || "brief";

    const prompt = `Please ${style === "brief" ? "briefly" : "comprehensively"} summarize the following text in approximately ${maxLength} words or less:\n\n${text}`;

    const response = await this.chatJSON([
      {
        role: "system",
        content: "You are an expert at creating clear, concise summaries. Always respond with a JSON object containing a 'summary' field."
      },
      {
        role: "user",
        content: prompt
      }
    ]);

    return (response as any)?.summary || "";
  }

  /**
   * Tag generation functionality
   */
  async generateTags(
    content: string,
    context?: string,
    options?: { maxTags?: number; category?: string }
  ): Promise<string[]> {
    const maxTags = options?.maxTags || 8;
    const category = options?.category || "therapy";
    const contextPrompt = context ? `\n\nContext: ${context}` : "";

    const prompt = `Generate ${maxTags} relevant ${category}-related tags for the following content. Focus on key themes, concepts, and actionable insights.${contextPrompt}\n\nContent: ${content}`;

    const response = await this.chatJSON([
      {
        role: "system",
        content: "You are an expert tagger specializing in therapeutic content. Always respond with a JSON object containing a 'tags' array of strings."
      },
      {
        role: "user",
        content: prompt
      }
    ]);

    return (response as any)?.tags || [];
  }

  /**
   * Get current metrics for monitoring
   */
  getMetrics(): Record<AIProvider, AIMetrics> {
    const result: Record<AIProvider, AIMetrics> = {} as any;
    this.metrics.forEach((metrics, provider) => {
      result[provider] = { ...metrics };
    });
    return result;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics.set(AIProvider.OPENAI, this.createEmptyMetrics());
    this.metrics.set(AIProvider.ANTHROPIC, this.createEmptyMetrics());
  }

  /**
   * Get health status of providers
   */
  getHealthStatus(): Record<AIProvider, { healthy: boolean; reason?: string }> {
    const result: Record<AIProvider, { healthy: boolean; reason?: string }> = {} as any;

    this.metrics.forEach((metrics, provider) => {
      const config = provider === AIProvider.OPENAI ? this.config.openai : this.config.anthropic;
      const client = provider === AIProvider.OPENAI ? this.openai : this.anthropic;

      if (!config.enabled || !client) {
        result[provider] = { healthy: false, reason: "disabled or not configured" };
        return;
      }

      const recentFailureRate = metrics.requests > 0 ? metrics.failures / metrics.requests : 0;
      const highFailureRate = recentFailureRate > 0.5;
      const highLatency = metrics.averageLatency > config.timeoutMs * 0.8;

      if (highFailureRate) {
        result[provider] = { healthy: false, reason: `high failure rate: ${(recentFailureRate * 100).toFixed(1)}%` };
      } else if (highLatency) {
        result[provider] = { healthy: false, reason: `high latency: ${metrics.averageLatency}ms` };
      } else {
        result[provider] = { healthy: true };
      }
    });

    return result;
  }

  /**
   * Check if AI is available
   */
  isAvailable(): boolean {
    return this.config.hipaaCompliant && (this.openai !== null || this.anthropic !== null);
  }
}

// Export singleton instance
export const aiRouter = new AIRouter();

// Export types for use in other files
export type { AIMessage, AIRouterConfig, AIMetrics };
export { AIProvider, AIError, HIPAAComplianceError };
