/**
 * Token Economics - Understanding the fundamental unit of LLM processing
 *
 * WHAT YOU'LL LEARN:
 * 1. How LLMs measure text (tokens, not characters or words)
 * 2. Different estimation methods and their tradeoffs
 * 3. Cost calculation patterns for production
 * 4. Context window math and why it matters
 *
 * KEY INSIGHT: Tokens are "subwords" - common words like "the" are 1 token,
 * while unusual words get split. "indescribable" might be ["ind", "esc", "rib", "able"].
 *
 * ROUGH RULES:
 * - 1 token ≈ 4 characters in English
 * - 1 token ≈ 0.75 words
 * - 100 tokens ≈ 75 words ≈ 400 characters
 */

// =============================================================================
// Token Estimation Methods
// =============================================================================

/**
 * Method 1: Character-based estimation
 *
 * Simplest approach: divide character count by 4.
 * Fast but least accurate, especially for non-English text.
 *
 * Use when: You need a quick estimate and precision doesn't matter.
 */
export function estimateTokensByChars(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Method 2: Word-based estimation
 *
 * Count words and multiply by 1.3 (accounting for subword splits).
 * Better than character-based for natural text.
 *
 * Use when: You want slightly better accuracy without complexity.
 */
export function estimateTokensByWords(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return Math.ceil(words.length * 1.3);
}

/**
 * Method 3: Hybrid estimation
 *
 * Combines character and word approaches with adjustments for:
 * - Punctuation (each is usually a separate token)
 * - Numbers (often tokenized digit-by-digit)
 * - Special characters (URLs, code, etc.)
 *
 * Use when: You need reasonable accuracy without external libraries.
 */
export function estimateTokensHybrid(text: string): number {
  if (!text.trim()) return 0;

  // Count different text components
  const words = text.trim().split(/\s+/).filter(Boolean);
  const punctuation = (text.match(/[.,!?;:'"()\[\]{}<>]/g) || []).length;
  const numbers = (text.match(/\d+/g) || []).join('').length;
  const codeIndicators = (text.match(/[{}\[\]()<>=+\-*/&|^~]/g) || []).length;

  // Base: words * 1.3
  let estimate = words.length * 1.3;

  // Add punctuation (each usually a token)
  estimate += punctuation * 0.8;

  // Numbers are often 1 token per 1-3 digits
  estimate += numbers * 0.5;

  // Code-heavy text tends to have more tokens
  if (codeIndicators > 5) {
    estimate *= 1.2;
  }

  return Math.ceil(estimate);
}

// =============================================================================
// Model Pricing (per 1M tokens, in USD)
// =============================================================================

/**
 * Pricing data for popular models (as of early 2025)
 *
 * PATTERN: Use const assertion + type for compile-time safety.
 * This prevents typos and enables autocomplete.
 */
export const MODEL_PRICING = {
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10.0, contextWindow: 128_000 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, contextWindow: 128_000 },
  'gpt-4-turbo': { input: 10.0, output: 30.0, contextWindow: 128_000 },
  'o1': { input: 15.0, output: 60.0, contextWindow: 200_000 },
  'o1-mini': { input: 3.0, output: 12.0, contextWindow: 128_000 },

  // Anthropic
  'claude-3-5-sonnet': { input: 3.0, output: 15.0, contextWindow: 200_000 },
  'claude-3-5-haiku': { input: 0.8, output: 4.0, contextWindow: 200_000 },
  'claude-3-opus': { input: 15.0, output: 75.0, contextWindow: 200_000 },

  // Google
  'gemini-1.5-pro': { input: 1.25, output: 5.0, contextWindow: 2_000_000 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3, contextWindow: 1_000_000 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4, contextWindow: 1_000_000 },

  // Open Source (self-hosted, cost is compute only)
  'llama-3.1-8b': { input: 0, output: 0, contextWindow: 128_000 },
  'llama-3.1-70b': { input: 0, output: 0, contextWindow: 128_000 },
  'qwen-2.5-7b': { input: 0, output: 0, contextWindow: 32_000 },
  'mistral-7b': { input: 0, output: 0, contextWindow: 32_000 },
} as const;

export type ModelId = keyof typeof MODEL_PRICING;

export interface ModelPricing {
  input: number;       // $ per 1M input tokens
  output: number;      // $ per 1M output tokens
  contextWindow: number;
}

// =============================================================================
// Cost Calculation
// =============================================================================

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Calculate the cost of an LLM call
 *
 * PATTERN: Separate input/output costs - they're often different!
 * Output is typically 3-5x more expensive than input.
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: ModelId
): CostEstimate {
  const pricing = MODEL_PRICING[model];

  // Convert from "per 1M tokens" to actual cost
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    inputTokens,
    outputTokens,
  };
}

/**
 * Estimate cost from text (convenience function)
 */
export function estimateCostFromText(
  inputText: string,
  estimatedOutputTokens: number,
  model: ModelId
): CostEstimate {
  const inputTokens = estimateTokensHybrid(inputText);
  return calculateCost(inputTokens, estimatedOutputTokens, model);
}

// =============================================================================
// Context Window Management
// =============================================================================

export interface ContextUsage {
  usedTokens: number;
  availableTokens: number;
  percentUsed: number;
  canFit: boolean;
}

/**
 * Check if content fits in a model's context window
 *
 * PATTERN: Always leave headroom for the response!
 * If context is 128K, don't use all 128K for input.
 */
export function checkContextFit(
  inputTokens: number,
  reserveForOutput: number,
  model: ModelId
): ContextUsage {
  const contextWindow = MODEL_PRICING[model].contextWindow;
  const totalNeeded = inputTokens + reserveForOutput;

  return {
    usedTokens: inputTokens,
    availableTokens: contextWindow - inputTokens,
    percentUsed: (inputTokens / contextWindow) * 100,
    canFit: totalNeeded <= contextWindow,
  };
}

/**
 * Calculate how many messages fit in context
 *
 * Useful for chat applications where you need to truncate history.
 */
export function fitMessagesInContext(
  messages: string[],
  maxTokens: number,
  reserveForOutput: number = 1000
): { fittingMessages: string[]; droppedCount: number } {
  const available = maxTokens - reserveForOutput;
  const fittingMessages: string[] = [];
  let totalTokens = 0;

  // Work backwards - keep most recent messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokensHybrid(messages[i]);
    if (totalTokens + msgTokens <= available) {
      fittingMessages.unshift(messages[i]);
      totalTokens += msgTokens;
    } else {
      break;
    }
  }

  return {
    fittingMessages,
    droppedCount: messages.length - fittingMessages.length,
  };
}

// =============================================================================
// Batch Cost Estimation
// =============================================================================

export interface BatchCostEstimate {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  perItemCost: number;
  items: number;
}

/**
 * Estimate cost for processing multiple items
 *
 * Use when: Batch processing documents, analyzing datasets, etc.
 */
export function estimateBatchCost(
  items: string[],
  avgOutputTokensPerItem: number,
  model: ModelId
): BatchCostEstimate {
  const totalInputTokens = items.reduce(
    (sum, item) => sum + estimateTokensHybrid(item),
    0
  );
  const totalOutputTokens = avgOutputTokensPerItem * items.length;
  const { totalCost } = calculateCost(totalInputTokens, totalOutputTokens, model);

  return {
    totalInputTokens,
    totalOutputTokens,
    totalCost,
    perItemCost: totalCost / items.length,
    items: items.length,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 100).toFixed(4)}¢`;
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * Format token count for display
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Get all available models
 */
export function getAvailableModels(): ModelId[] {
  return Object.keys(MODEL_PRICING) as ModelId[];
}

/**
 * Compare costs across models
 */
export function compareModelCosts(
  inputTokens: number,
  outputTokens: number
): Array<{ model: ModelId; cost: CostEstimate }> {
  return getAvailableModels()
    .map(model => ({
      model,
      cost: calculateCost(inputTokens, outputTokens, model),
    }))
    .sort((a, b) => a.cost.totalCost - b.cost.totalCost);
}
