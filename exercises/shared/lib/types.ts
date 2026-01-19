/**
 * Shared types for all exercises
 * These are the fundamental building blocks for AI applications
 */

// =============================================================================
// Messages
// =============================================================================

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  role: MessageRole;
  content: string;
  name?: string; // For tool messages
}

export interface ChatMessage extends Message {
  id: string;
  createdAt: Date;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  tokens?: {
    input: number;
    output: number;
  };
  latencyMs?: number;
  model?: string;
  cached?: boolean;
}

// =============================================================================
// LLM Configuration
// =============================================================================

export interface LLMConfig {
  model?: string;
  temperature?: number;      // 0-2, controls randomness
  maxTokens?: number;        // Max tokens to generate
  topP?: number;             // Nucleus sampling threshold
  topK?: number;             // Top-k sampling
  stop?: string[];           // Stop sequences
  seed?: number;             // For reproducibility
}

export const DEFAULT_CONFIG: LLMConfig = {
  temperature: 0.7,
  maxTokens: 1024,
  topP: 0.9,
};

// =============================================================================
// LLM Responses
// =============================================================================

export interface LLMResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
  usage?: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// =============================================================================
// Tool Definitions (for Exercise 03+)
// =============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

// =============================================================================
// Streaming (for Exercise 04+)
// =============================================================================

export interface StreamChunk {
  content: string;
  done: boolean;
  finishReason?: 'stop' | 'length' | 'tool_calls';
}

// =============================================================================
// Utility Types
// =============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
