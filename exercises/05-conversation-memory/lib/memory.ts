/**
 * Conversation Memory - Managing context windows and message history
 *
 * WHAT YOU'LL LEARN:
 * 1. Context window limits and why they matter
 * 2. Message pruning strategies (sliding window, summarization)
 * 3. Token counting for memory management
 * 4. Conversation state persistence patterns
 *
 * KEY INSIGHT: LLMs have limited memory (context window). You must decide
 * what to keep and what to drop. The wrong strategy loses important context.
 */

// =============================================================================
// Types
// =============================================================================

export interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokens?: number;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  systemPrompt?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryConfig {
  maxTokens: number;           // Max tokens for context
  reserveForOutput: number;    // Tokens to reserve for response
  strategy: 'sliding-window' | 'summarize' | 'importance';
  summarizationThreshold?: number;  // When to trigger summarization
}

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Estimate tokens in a message
 *
 * Rough estimate: ~4 chars per token for English
 * Real tokenization varies by model - use tiktoken for precision
 */
export function estimateMessageTokens(message: Message): number {
  // Role adds ~4 tokens, content varies
  const roleTokens = 4;
  const contentTokens = Math.ceil(message.content.length / 4);
  return roleTokens + contentTokens;
}

/**
 * Estimate total tokens in conversation
 */
export function estimateConversationTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}

// =============================================================================
// Memory Management Strategies
// =============================================================================

/**
 * Sliding Window Strategy
 *
 * Keep the most recent messages that fit in context.
 * Simple and predictable, but may lose important early context.
 */
export function applySlidingWindow(
  messages: Message[],
  maxTokens: number,
  reserveForOutput: number
): Message[] {
  const available = maxTokens - reserveForOutput;
  const result: Message[] = [];
  let totalTokens = 0;

  // Always keep system message if present
  const systemMessage = messages.find(m => m.role === 'system');
  if (systemMessage) {
    totalTokens += estimateMessageTokens(systemMessage);
    result.push(systemMessage);
  }

  // Add messages from most recent, working backwards
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
    const msg = nonSystemMessages[i];
    const msgTokens = estimateMessageTokens(msg);

    if (totalTokens + msgTokens <= available) {
      result.unshift(msg);
      totalTokens += msgTokens;
    } else {
      break; // Can't fit more
    }
  }

  // Put system message back at the start
  if (systemMessage && result[0] !== systemMessage) {
    result.unshift(systemMessage);
  }

  return result;
}

/**
 * Importance-based Strategy
 *
 * Score messages by importance, keep highest-scoring ones.
 * Better context preservation, but more complex.
 */
export function applyImportanceStrategy(
  messages: Message[],
  maxTokens: number,
  reserveForOutput: number
): Message[] {
  const available = maxTokens - reserveForOutput;

  // Score each message
  const scored = messages.map((msg, index) => ({
    message: msg,
    score: calculateImportanceScore(msg, index, messages.length),
  }));

  // Always keep system message
  const systemMessage = messages.find(m => m.role === 'system');
  let totalTokens = systemMessage ? estimateMessageTokens(systemMessage) : 0;

  // Sort by score (descending) and pick until we run out of space
  const result: Message[] = systemMessage ? [systemMessage] : [];

  const nonSystem = scored
    .filter(s => s.message.role !== 'system')
    .sort((a, b) => b.score - a.score);

  for (const { message } of nonSystem) {
    const msgTokens = estimateMessageTokens(message);
    if (totalTokens + msgTokens <= available) {
      result.push(message);
      totalTokens += msgTokens;
    }
  }

  // Re-sort by timestamp to maintain conversation order
  return result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Calculate importance score for a message
 */
function calculateImportanceScore(
  message: Message,
  index: number,
  totalMessages: number
): number {
  let score = 0;

  // Recency: more recent = higher score
  const recencyScore = (index / totalMessages) * 40;
  score += recencyScore;

  // Role importance
  if (message.role === 'system') score += 100; // Always keep system
  if (message.role === 'user') score += 20;    // User messages are important
  if (message.role === 'assistant') score += 10;

  // Content indicators
  const content = message.content.toLowerCase();

  // Questions are important
  if (content.includes('?')) score += 15;

  // Instructions/commands
  if (content.match(/\b(please|must|should|need|want|help)\b/)) score += 10;

  // Code blocks might be important context
  if (content.includes('```')) score += 15;

  // Short messages are less important
  if (message.content.length < 20) score -= 10;

  // First user message often contains the main task
  if (message.role === 'user' && index <= 1) score += 30;

  return score;
}

// =============================================================================
// Summarization Strategy
// =============================================================================

/**
 * Check if summarization is needed
 */
export function needsSummarization(
  messages: Message[],
  maxTokens: number,
  threshold: number = 0.8
): boolean {
  const currentTokens = estimateConversationTokens(messages);
  return currentTokens > maxTokens * threshold;
}

/**
 * Create a summarization prompt
 */
export function createSummarizationPrompt(messages: Message[]): string {
  const content = messages
    .filter(m => m.role !== 'system')
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');

  return `Summarize the following conversation, preserving:
- The main topic and user's goal
- Key decisions and conclusions
- Important details mentioned
- Any pending questions or tasks

Keep the summary concise (under 200 words).

Conversation:
${content}

Summary:`;
}

/**
 * Apply summarization to old messages
 */
export function applySummarization(
  messages: Message[],
  summary: string,
  keepRecent: number = 4
): Message[] {
  const systemMessage = messages.find(m => m.role === 'system');
  const nonSystem = messages.filter(m => m.role !== 'system');

  // Keep recent messages
  const recentMessages = nonSystem.slice(-keepRecent);

  // Create summary message
  const summaryMessage: Message = {
    id: `summary-${Date.now()}`,
    role: 'system',
    content: `[Previous conversation summary]\n${summary}`,
    timestamp: new Date(),
  };

  const result: Message[] = [];
  if (systemMessage) result.push(systemMessage);
  result.push(summaryMessage);
  result.push(...recentMessages);

  return result;
}

// =============================================================================
// Conversation Manager
// =============================================================================

export class ConversationManager {
  private conversations = new Map<string, Conversation>();
  private config: MemoryConfig;

  constructor(config: MemoryConfig) {
    this.config = config;
  }

  createConversation(systemPrompt?: string): Conversation {
    const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const conversation: Conversation = {
      id,
      title: 'New Conversation',
      messages: [],
      systemPrompt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (systemPrompt) {
      conversation.messages.push({
        id: `msg-${Date.now()}`,
        role: 'system',
        content: systemPrompt,
        timestamp: new Date(),
      });
    }

    this.conversations.set(id, conversation);
    return conversation;
  }

  addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string
  ): Message {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new MemoryError(`Conversation not found: ${conversationId}`, 'NOT_FOUND');
    }

    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role,
      content,
      timestamp: new Date(),
      tokens: estimateMessageTokens({ role, content } as Message),
    };

    conversation.messages.push(message);
    conversation.updatedAt = new Date();

    // Auto-title from first user message
    if (role === 'user' && conversation.title === 'New Conversation') {
      conversation.title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
    }

    return message;
  }

  getContextWindow(conversationId: string): Message[] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new MemoryError(`Conversation not found: ${conversationId}`, 'NOT_FOUND');
    }

    switch (this.config.strategy) {
      case 'sliding-window':
        return applySlidingWindow(
          conversation.messages,
          this.config.maxTokens,
          this.config.reserveForOutput
        );

      case 'importance':
        return applyImportanceStrategy(
          conversation.messages,
          this.config.maxTokens,
          this.config.reserveForOutput
        );

      case 'summarize':
        // For summarization, we still use sliding window but mark when summarization is needed
        return applySlidingWindow(
          conversation.messages,
          this.config.maxTokens,
          this.config.reserveForOutput
        );

      default:
        return conversation.messages;
    }
  }

  getConversation(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  listConversations(): Conversation[] {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  deleteConversation(id: string): boolean {
    return this.conversations.delete(id);
  }

  getStats(conversationId: string): ConversationStats {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new MemoryError(`Conversation not found: ${conversationId}`, 'NOT_FOUND');
    }

    const totalTokens = estimateConversationTokens(conversation.messages);
    const contextWindow = this.getContextWindow(conversationId);
    const contextTokens = estimateConversationTokens(contextWindow);

    return {
      totalMessages: conversation.messages.length,
      contextMessages: contextWindow.length,
      droppedMessages: conversation.messages.length - contextWindow.length,
      totalTokens,
      contextTokens,
      availableTokens: this.config.maxTokens - contextTokens - this.config.reserveForOutput,
      percentUsed: (contextTokens / this.config.maxTokens) * 100,
    };
  }
}

export interface ConversationStats {
  totalMessages: number;
  contextMessages: number;
  droppedMessages: number;
  totalTokens: number;
  contextTokens: number;
  availableTokens: number;
  percentUsed: number;
}

// =============================================================================
// Errors
// =============================================================================

export class MemoryError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'OVERFLOW' | 'INVALID'
  ) {
    super(message);
    this.name = 'MemoryError';
  }
}

// =============================================================================
// Utility
// =============================================================================

export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
