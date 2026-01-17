/**
 * Token estimation utilities
 *
 * Provides rough token estimation for text. For precise tokenization,
 * use tiktoken or your model's specific tokenizer.
 */

/**
 * Rough token estimate (approximately 4 characters per token for English)
 * This is a simple heuristic and not precise.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * More accurate token estimation considering word boundaries
 */
export function estimateTokensAccurate(text: string): number {
  // Remove extra whitespace
  const normalized = text.trim().replace(/\s+/g, ' ');

  // Count words
  const words = normalized.split(' ').length;

  // Average ~1.3 tokens per word in English
  const fromWords = Math.ceil(words * 1.3);

  // Also consider character-based estimate
  const fromChars = Math.ceil(normalized.length / 4);

  // Return the average of both methods
  return Math.ceil((fromWords + fromChars) / 2);
}

/**
 * Estimate tokens for an array of messages
 */
export function estimateMessagesTokens(
  messages: Array<{ role: string; content: string }>
): number {
  let total = 0;

  for (const message of messages) {
    // Each message has overhead for role and formatting
    total += estimateTokensAccurate(message.content);
    total += 4; // Overhead per message
  }

  return total;
}

/**
 * Check if text fits within token limit
 */
export function fitsInContext(text: string, maxTokens: number): boolean {
  return estimateTokens(text) <= maxTokens;
}

/**
 * Truncate text to fit within token limit
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const estimated = estimateTokens(text);

  if (estimated <= maxTokens) {
    return text;
  }

  // Calculate approximate character limit
  const charLimit = maxTokens * 4;

  // Truncate at word boundary
  const truncated = text.slice(0, charLimit);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 0) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Split text into chunks that fit within token limit
 */
export function chunkByTokens(text: string, maxTokensPerChunk: number): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split('\n\n');

  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const potentialChunk = currentChunk
      ? `${currentChunk}\n\n${paragraph}`
      : paragraph;

    if (estimateTokens(potentialChunk) > maxTokensPerChunk) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = paragraph;
    } else {
      currentChunk = potentialChunk;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Format token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return `${tokens} tokens`;
  } else if (tokens < 1000000) {
    return `${(tokens / 1000).toFixed(1)}K tokens`;
  } else {
    return `${(tokens / 1000000).toFixed(2)}M tokens`;
  }
}

/**
 * Estimate API cost based on token usage
 * Prices are per 1M tokens
 */
export interface TokenCost {
  inputTokens: number;
  outputTokens: number;
  inputPricePer1M: number;
  outputPricePer1M: number;
}

export function estimateCost(usage: TokenCost): number {
  const inputCost = (usage.inputTokens / 1000000) * usage.inputPricePer1M;
  const outputCost = (usage.outputTokens / 1000000) * usage.outputPricePer1M;
  return inputCost + outputCost;
}

/**
 * Model pricing (USD per 1M tokens) - as of Jan 2026
 */
export const MODEL_PRICING = {
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'claude-sonnet-4.5': { input: 3.0, output: 15.0 },
  'claude-haiku-4.5': { input: 1.0, output: 5.0 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gpt-oss-20b': { input: 0, output: 0 }, // Local model - free
} as const;

/**
 * Calculate cost for a specific model
 */
export function calculateModelCost(
  model: keyof typeof MODEL_PRICING,
  inputTokens: number,
  outputTokens: number
): { inputCost: number; outputCost: number; totalCost: number } {
  const pricing = MODEL_PRICING[model];

  const inputCost = (inputTokens / 1000000) * pricing.input;
  const outputCost = (outputTokens / 1000000) * pricing.output;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost === 0) {
    return 'Free';
  } else if (cost < 0.01) {
    return `$${(cost * 1000).toFixed(2)}‱`; // Show in basis points if very small
  } else {
    return `$${cost.toFixed(4)}`;
  }
}
