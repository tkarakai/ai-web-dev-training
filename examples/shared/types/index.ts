/**
 * Shared TypeScript types for AI web development examples
 */

// ============================================================================
// AI Types
// ============================================================================

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  model?: string;
  latencyMs?: number;
  tokenCount?: {
    input?: number;
    output?: number;
    total?: number;
  };
  sources?: Source[];
  confidence?: 'high' | 'medium' | 'low';
  feedback?: 'helpful' | 'not_helpful';
  error?: string;
  rawRequest?: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body: any;
  };
  rawResponse?: {
    status?: number;
    headers?: Record<string, string>;
    body: any;
  };
}

export interface Source {
  id: string;
  title: string;
  url?: string;
  excerpt: string;
  relevanceScore?: number;
  retrievedAt?: Date;
}

export interface Citation {
  id: string;
  text: string;
  source: Source;
  confidence: number;
}

// ============================================================================
// LLM Configuration
// ============================================================================

export interface LLMConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  seed?: number;
  stream?: boolean;
}

export interface LLMProvider {
  name: 'llama-local' | 'openai' | 'anthropic' | 'google';
  apiKey?: string;
  baseURL?: string;
  model: string;
}

// ============================================================================
// Chat Types
// ============================================================================

export interface Conversation {
  id: string;
  title?: string;
  messages: AIMessage[];
  context?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatCompletionOptions {
  messages: AIMessage[];
  config?: LLMConfig;
  onStream?: (chunk: string) => void;
  onComplete?: (response: AIMessage) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Response Types
// ============================================================================

export interface AIResponse {
  content: string;
  confidence?: 'high' | 'medium' | 'low';
  sources?: Source[];
  citations?: Citation[];
  caveats?: string[];
  metadata?: ResponseMetadata;
}

export interface ResponseMetadata {
  model: string;
  latencyMs: number;
  tokenCount: {
    input: number;
    output: number;
    total: number;
  };
  cost?: {
    input: number;
    output: number;
    total: number;
  };
  cached?: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

export interface AIError {
  type: 'timeout' | 'rate_limit' | 'content_filter' | 'model_error' | 'network_error' | 'validation_error';
  message: string;
  retryAfter?: number;
  details?: Record<string, unknown>;
}

// ============================================================================
// Agent Types
// ============================================================================

export interface AgentAction {
  id: string;
  type: 'read' | 'write' | 'execute' | 'send';
  description: string;
  target: string;
  requiresApproval: boolean;
  risk: 'low' | 'medium' | 'high';
  status?: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
}

export interface AgentContext {
  conversationId: string;
  userId?: string;
  sessionId?: string;
  tools?: Tool[];
  memory?: Record<string, unknown>;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

// ============================================================================
// Evaluation Types
// ============================================================================

export interface EvalCase {
  id: string;
  input: string;
  expectedOutput?: string;
  context?: Record<string, unknown>;
  tags?: string[];
}

export interface EvalResult {
  caseId: string;
  passed: boolean;
  score?: number;
  actualOutput: string;
  metrics?: Record<string, number>;
  error?: string;
}

export interface EvalSet {
  name: string;
  description?: string;
  cases: EvalCase[];
  config?: EvalConfig;
}

export interface EvalConfig {
  model?: string;
  temperature?: number;
  threshold?: number;
  metrics?: string[];
}

// ============================================================================
// RAG Types
// ============================================================================

export interface Document {
  id: string;
  content: string;
  metadata: DocumentMetadata;
  embedding?: number[];
}

export interface DocumentMetadata {
  title?: string;
  url?: string;
  contentType?: string;
  indexed_at?: string;
  docId?: string;
  chunkIndex?: number;
  path?: string;
  [key: string]: unknown;
}

export interface Chunk {
  content: string;
  startIndex?: number;
  endIndex?: number;
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  score: number;
  document?: Document;
  chunk?: Chunk;
  metadata?: Record<string, unknown>;
}

export interface RAGResponse {
  answer: string;
  sources: Source[];
  grounding: {
    score: number;
    citations: Citation[];
    ungroundedClaims?: string[];
  };
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];
