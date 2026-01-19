/**
 * RAG Pipeline (Retrieval-Augmented Generation)
 *
 * Build a complete RAG system using llama-server embeddings.
 *
 * KEY CONCEPTS:
 * 1. Chunking - Split documents into manageable pieces
 * 2. Embeddings - Convert text to vectors using llama-server
 * 3. Vector search - Find similar content using cosine similarity
 * 4. Grounded generation - Answer questions using retrieved context
 *
 * REQUIRES: llama-server with --embedding flag
 */

import { LlamaClient, type Message } from '../../shared/lib/llama-client';

// =============================================================================
// TYPES
// =============================================================================

export interface Document {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  chunk: Chunk;
  score: number;
}

export interface RAGResponse {
  answer: string;
  sources: SearchResult[];
  query: string;
}

// =============================================================================
// CHUNKING
// =============================================================================

export interface ChunkingConfig {
  /** Maximum characters per chunk */
  maxChunkSize: number;
  /** Overlap between chunks in characters */
  overlap: number;
  /** Split on these delimiters (in priority order) */
  delimiters: string[];
}

const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  maxChunkSize: 500,
  overlap: 50,
  delimiters: ['\n\n', '\n', '. ', ' '],
};

/**
 * Split document into chunks
 */
export function chunkDocument(
  document: Document,
  config: Partial<ChunkingConfig> = {}
): Chunk[] {
  const { maxChunkSize, overlap, delimiters } = {
    ...DEFAULT_CHUNKING_CONFIG,
    ...config,
  };

  const chunks: Chunk[] = [];
  let remaining = document.content;
  let chunkIndex = 0;

  while (remaining.length > 0) {
    let chunkEnd = maxChunkSize;

    if (remaining.length > maxChunkSize) {
      // Find best split point
      chunkEnd = findSplitPoint(remaining, maxChunkSize, delimiters);
    } else {
      chunkEnd = remaining.length;
    }

    const chunkContent = remaining.slice(0, chunkEnd).trim();

    if (chunkContent.length > 0) {
      chunks.push({
        id: `${document.id}-chunk-${chunkIndex}`,
        documentId: document.id,
        content: chunkContent,
        metadata: {
          ...document.metadata,
          chunkIndex,
          startOffset: document.content.length - remaining.length,
        },
      });
      chunkIndex++;
    }

    // Move forward with overlap
    const advance = Math.max(1, chunkEnd - overlap);
    remaining = remaining.slice(advance);
  }

  return chunks;
}

/**
 * Find best split point using delimiters
 */
function findSplitPoint(text: string, maxLength: number, delimiters: string[]): number {
  for (const delimiter of delimiters) {
    const lastIndex = text.slice(0, maxLength).lastIndexOf(delimiter);
    if (lastIndex > maxLength * 0.3) {
      return lastIndex + delimiter.length;
    }
  }
  return maxLength;
}

/**
 * Chunk multiple documents
 */
export function chunkDocuments(
  documents: Document[],
  config: Partial<ChunkingConfig> = {}
): Chunk[] {
  return documents.flatMap((doc) => chunkDocument(doc, config));
}

// =============================================================================
// EMBEDDINGS
// =============================================================================

/**
 * Get embedding from llama-server
 *
 * Requires: llama-server --embedding
 */
export async function getEmbedding(
  baseUrl: string,
  text: string
): Promise<number[]> {
  const response = await fetch(`${baseUrl}/embedding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: text }),
  });

  if (!response.ok) {
    throw new Error(`Embedding request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.embedding;
}

/**
 * Get embeddings for multiple texts
 */
export async function getEmbeddings(
  baseUrl: string,
  texts: string[]
): Promise<number[][]> {
  // Process in parallel with concurrency limit
  const concurrency = 5;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((text) => getEmbedding(baseUrl, text))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Add embeddings to chunks
 */
export async function embedChunks(
  baseUrl: string,
  chunks: Chunk[]
): Promise<Chunk[]> {
  const texts = chunks.map((c) => c.content);
  const embeddings = await getEmbeddings(baseUrl, texts);

  return chunks.map((chunk, i) => ({
    ...chunk,
    embedding: embeddings[i],
  }));
}

// =============================================================================
// VECTOR STORE
// =============================================================================

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Simple in-memory vector store
 */
export class VectorStore {
  private chunks: Chunk[] = [];

  /**
   * Add chunks to the store
   */
  add(chunks: Chunk[]): void {
    this.chunks.push(...chunks);
  }

  /**
   * Search for similar chunks
   */
  search(queryEmbedding: number[], topK: number = 5): SearchResult[] {
    const results: SearchResult[] = [];

    for (const chunk of this.chunks) {
      if (!chunk.embedding) continue;

      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      results.push({ chunk, score });
    }

    // Sort by score descending and take top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Search with minimum score threshold
   */
  searchWithThreshold(
    queryEmbedding: number[],
    minScore: number = 0.5,
    topK: number = 5
  ): SearchResult[] {
    return this.search(queryEmbedding, topK).filter((r) => r.score >= minScore);
  }

  /**
   * Get all chunks
   */
  getAll(): Chunk[] {
    return [...this.chunks];
  }

  /**
   * Get chunk by ID
   */
  getById(id: string): Chunk | undefined {
    return this.chunks.find((c) => c.id === id);
  }

  /**
   * Clear the store
   */
  clear(): void {
    this.chunks = [];
  }

  /**
   * Get store size
   */
  size(): number {
    return this.chunks.length;
  }
}

// =============================================================================
// RAG PIPELINE
// =============================================================================

export interface RAGConfig {
  /** Base URL for llama-server */
  baseUrl: string;
  /** Number of chunks to retrieve */
  topK: number;
  /** Minimum similarity score */
  minScore: number;
  /** Include sources in response */
  includeSources: boolean;
}

const DEFAULT_RAG_CONFIG: RAGConfig = {
  baseUrl: 'http://127.0.0.1:8033',
  topK: 3,
  minScore: 0.3,
  includeSources: true,
};

/**
 * Complete RAG Pipeline
 */
export class RAGPipeline {
  private client: LlamaClient;
  private vectorStore: VectorStore;
  private config: RAGConfig;

  constructor(config: Partial<RAGConfig> = {}) {
    this.config = { ...DEFAULT_RAG_CONFIG, ...config };
    this.client = new LlamaClient(this.config.baseUrl);
    this.vectorStore = new VectorStore();
  }

  /**
   * Ingest documents into the pipeline
   */
  async ingest(documents: Document[], chunkingConfig?: Partial<ChunkingConfig>): Promise<number> {
    // Chunk documents
    const chunks = chunkDocuments(documents, chunkingConfig);

    // Generate embeddings
    const embeddedChunks = await embedChunks(this.config.baseUrl, chunks);

    // Store in vector store
    this.vectorStore.add(embeddedChunks);

    return embeddedChunks.length;
  }

  /**
   * Query the RAG pipeline
   */
  async query(question: string): Promise<RAGResponse> {
    // Get query embedding
    const queryEmbedding = await getEmbedding(this.config.baseUrl, question);

    // Search for relevant chunks
    const searchResults = this.vectorStore.searchWithThreshold(
      queryEmbedding,
      this.config.minScore,
      this.config.topK
    );

    // Build context from retrieved chunks
    const context = searchResults
      .map((r, i) => `[Source ${i + 1}]: ${r.chunk.content}`)
      .join('\n\n');

    // Generate answer with context
    const systemPrompt = `You are a helpful assistant that answers questions based on the provided context.
If the context doesn't contain enough information to answer, say so.
Always base your answer on the provided context.`;

    const userPrompt = context
      ? `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer based on the context above:`
      : `Question: ${question}\n\nI don't have specific context for this question, but I'll try to help:`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const answer = await this.client.chat(messages, { temperature: 0.3 });

    return {
      answer,
      sources: this.config.includeSources ? searchResults : [],
      query: question,
    };
  }

  /**
   * Search without generating an answer
   */
  async search(query: string, topK?: number): Promise<SearchResult[]> {
    const queryEmbedding = await getEmbedding(this.config.baseUrl, query);
    return this.vectorStore.search(queryEmbedding, topK || this.config.topK);
  }

  /**
   * Get pipeline statistics
   */
  getStats(): { chunkCount: number; config: RAGConfig } {
    return {
      chunkCount: this.vectorStore.size(),
      config: this.config,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.vectorStore.clear();
  }
}

// =============================================================================
// SAMPLE DATA
// =============================================================================

/**
 * Sample documents for testing
 */
export const SAMPLE_DOCUMENTS: Document[] = [
  {
    id: 'typescript-intro',
    content: `TypeScript is a strongly typed programming language that builds on JavaScript.
It adds optional static typing and class-based object-oriented programming to the language.
TypeScript is developed and maintained by Microsoft.

TypeScript code is transpiled to JavaScript, which means it can run in any JavaScript environment.
The TypeScript compiler checks for errors at compile time, catching many bugs before runtime.

Key features of TypeScript include:
- Static type checking
- Interfaces and type aliases
- Generics
- Enums
- Decorators
- Namespaces and modules

TypeScript has become very popular for large-scale JavaScript applications because it helps
teams maintain code quality and catch errors early in development.`,
    metadata: { topic: 'programming', language: 'typescript' },
  },
  {
    id: 'react-basics',
    content: `React is a JavaScript library for building user interfaces.
It was developed by Facebook and is now maintained by Meta and a community of developers.

React uses a component-based architecture where UIs are built from small, reusable pieces.
Each component manages its own state and can be composed to create complex interfaces.

Key concepts in React:
- Components: The building blocks of React applications
- JSX: A syntax extension that allows writing HTML-like code in JavaScript
- Props: Data passed from parent to child components
- State: Internal data managed by a component
- Hooks: Functions that let you use state and other React features in functional components

React uses a virtual DOM to efficiently update the actual DOM, making it fast and performant.
It follows a unidirectional data flow, making applications easier to debug and understand.`,
    metadata: { topic: 'programming', framework: 'react' },
  },
  {
    id: 'llm-overview',
    content: `Large Language Models (LLMs) are AI systems trained on vast amounts of text data.
They can understand and generate human-like text across many tasks.

LLMs work by predicting the next token in a sequence based on the context provided.
They use transformer architecture with attention mechanisms to capture relationships in text.

Common applications of LLMs include:
- Text generation and completion
- Question answering
- Summarization
- Translation
- Code generation
- Conversational AI

Popular LLMs include GPT-4, Claude, Llama, and Mistral.
These models vary in size from millions to hundreds of billions of parameters.

Key considerations when using LLMs:
- Prompt engineering: How you phrase requests affects output quality
- Temperature: Controls randomness in generation
- Context window: Maximum input length the model can process
- Cost: API calls are typically priced per token`,
    metadata: { topic: 'ai', category: 'llm' },
  },
];
