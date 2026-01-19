'use client';

import { useState, useCallback } from 'react';

interface Document {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface Chunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
}

interface SearchResult {
  chunk: Chunk;
  score: number;
}

interface RAGResponse {
  answer: string;
  sources: SearchResult[];
  query: string;
}

interface PipelineStats {
  chunkCount: number;
  documentCount: number;
  isReady: boolean;
}

const SAMPLE_DOCUMENTS: Document[] = [
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

export default function RAGPage() {
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:8033');
  const [stats, setStats] = useState<PipelineStats>({
    chunkCount: 0,
    documentCount: 0,
    isReady: false,
  });
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<RAGResponse | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ingest' | 'search' | 'query'>('ingest');

  // Ingest documents
  const handleIngest = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Chunk documents locally
      const allChunks: Chunk[] = [];
      let chunkIndex = 0;

      for (const doc of SAMPLE_DOCUMENTS) {
        // Simple chunking
        const maxChunkSize = 300;
        let remaining = doc.content;

        while (remaining.length > 0) {
          let chunkEnd = maxChunkSize;
          if (remaining.length > maxChunkSize) {
            // Find split point
            const lastNewline = remaining.slice(0, maxChunkSize).lastIndexOf('\n\n');
            if (lastNewline > maxChunkSize * 0.3) {
              chunkEnd = lastNewline;
            }
          } else {
            chunkEnd = remaining.length;
          }

          const content = remaining.slice(0, chunkEnd).trim();
          if (content.length > 0) {
            allChunks.push({
              id: `${doc.id}-chunk-${chunkIndex}`,
              documentId: doc.id,
              content,
            });
            chunkIndex++;
          }

          remaining = remaining.slice(Math.max(1, chunkEnd - 30));
        }
      }

      // Get embeddings for each chunk
      const embeddedChunks: Chunk[] = [];
      for (const chunk of allChunks) {
        const res = await fetch(`${baseUrl}/embedding`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: chunk.content }),
        });

        if (!res.ok) {
          throw new Error(`Embedding failed: ${res.statusText}. Make sure llama-server has --embedding flag.`);
        }

        const data = await res.json();
        embeddedChunks.push({
          ...chunk,
          embedding: data.embedding,
        });
      }

      setChunks(embeddedChunks);
      setStats({
        chunkCount: embeddedChunks.length,
        documentCount: SAMPLE_DOCUMENTS.length,
        isReady: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ingestion failed');
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  // Search without generation
  const handleSearch = useCallback(async () => {
    if (!query.trim() || chunks.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Get query embedding
      const res = await fetch(`${baseUrl}/embedding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: query }),
      });

      if (!res.ok) {
        throw new Error(`Embedding failed: ${res.statusText}`);
      }

      const data = await res.json();
      const queryEmbedding: number[] = data.embedding;

      // Calculate similarities
      const results: SearchResult[] = [];
      for (const chunk of chunks) {
        if (!chunk.embedding) continue;

        // Cosine similarity
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < queryEmbedding.length; i++) {
          dot += queryEmbedding[i] * chunk.embedding[i];
          normA += queryEmbedding[i] * queryEmbedding[i];
          normB += chunk.embedding[i] * chunk.embedding[i];
        }
        const score = dot / (Math.sqrt(normA) * Math.sqrt(normB));

        results.push({ chunk, score });
      }

      // Sort by score
      results.sort((a, b) => b.score - a.score);
      setSearchResults(results.slice(0, 5));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [baseUrl, query, chunks]);

  // Query with generation (full RAG)
  const handleQuery = useCallback(async () => {
    if (!query.trim() || chunks.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Get query embedding
      const embRes = await fetch(`${baseUrl}/embedding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: query }),
      });

      if (!embRes.ok) {
        throw new Error(`Embedding failed: ${embRes.statusText}`);
      }

      const embData = await embRes.json();
      const queryEmbedding: number[] = embData.embedding;

      // Calculate similarities
      const results: SearchResult[] = [];
      for (const chunk of chunks) {
        if (!chunk.embedding) continue;

        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < queryEmbedding.length; i++) {
          dot += queryEmbedding[i] * chunk.embedding[i];
          normA += queryEmbedding[i] * queryEmbedding[i];
          normB += chunk.embedding[i] * chunk.embedding[i];
        }
        const score = dot / (Math.sqrt(normA) * Math.sqrt(normB));

        results.push({ chunk, score });
      }

      results.sort((a, b) => b.score - a.score);
      const topResults = results.slice(0, 3).filter((r) => r.score > 0.3);

      // Build context
      const context = topResults
        .map((r, i) => `[Source ${i + 1}]: ${r.chunk.content}`)
        .join('\n\n');

      // Generate answer
      const systemPrompt = `You are a helpful assistant that answers questions based on the provided context.
If the context doesn't contain enough information to answer, say so.
Always base your answer on the provided context.`;

      const userPrompt = context
        ? `Context:\n${context}\n\nQuestion: ${query}\n\nAnswer based on the context above:`
        : `Question: ${query}\n\nI don't have specific context for this question.`;

      const chatRes = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
        }),
      });

      if (!chatRes.ok) {
        throw new Error(`Chat failed: ${chatRes.statusText}`);
      }

      const chatData = await chatRes.json();
      const answer = chatData.choices?.[0]?.message?.content || 'No response';

      setResponse({
        answer,
        sources: topResults,
        query,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setLoading(false);
    }
  }, [baseUrl, query, chunks]);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Exercise 15: RAG Pipeline</h1>
        <p className="text-gray-400 mb-8">
          Retrieval-Augmented Generation - Ground LLM responses in your documents
        </p>

        {/* Server Config */}
        <div className="bg-gray-900 rounded-lg p-4 mb-6">
          <label className="block text-sm text-gray-400 mb-2">
            llama-server URL (requires --embedding flag)
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono"
          />
        </div>

        {/* Status */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-2xl font-bold">{stats.documentCount}</div>
            <div className="text-sm text-gray-400">Documents</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-2xl font-bold">{stats.chunkCount}</div>
            <div className="text-sm text-gray-400">Chunks</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className={`text-2xl font-bold ${stats.isReady ? 'text-green-400' : 'text-yellow-400'}`}>
              {stats.isReady ? 'Ready' : 'Not Ready'}
            </div>
            <div className="text-sm text-gray-400">Pipeline Status</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['ingest', 'search', 'query'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg capitalize ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {tab === 'query' ? 'RAG Query' : tab}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6 text-red-200">
            {error}
          </div>
        )}

        {/* Ingest Tab */}
        {activeTab === 'ingest' && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Sample Documents</h2>
              <p className="text-gray-400 mb-4">
                Click "Ingest Documents" to chunk and embed these sample documents.
              </p>

              <div className="space-y-4 mb-6">
                {SAMPLE_DOCUMENTS.map((doc) => (
                  <div key={doc.id} className="bg-gray-800 rounded p-4">
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">{doc.id}</span>
                      <span className="text-sm text-gray-500">
                        {doc.content.length} chars
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-3">
                      {doc.content}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {Object.entries(doc.metadata || {}).map(([k, v]) => (
                        <span
                          key={k}
                          className="text-xs bg-gray-700 px-2 py-1 rounded"
                        >
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleIngest}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2 rounded-lg"
              >
                {loading ? 'Ingesting...' : 'Ingest Documents'}
              </button>
            </div>

            {chunks.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Chunks Created</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {chunks.map((chunk) => (
                    <div key={chunk.id} className="bg-gray-800 rounded p-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-mono text-gray-400">{chunk.id}</span>
                        <span className="text-gray-500">
                          {chunk.embedding ? `${chunk.embedding.length}d vector` : 'no embedding'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 line-clamp-2">
                        {chunk.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Vector Search</h2>
              <p className="text-gray-400 mb-4">
                Search for similar chunks using cosine similarity (no generation).
              </p>

              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter search query..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  disabled={loading || !stats.isReady}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2 rounded-lg"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>

              {!stats.isReady && (
                <p className="text-yellow-400 text-sm">
                  Please ingest documents first.
                </p>
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Search Results</h2>
                <div className="space-y-4">
                  {searchResults.map((result, i) => (
                    <div key={result.chunk.id} className="bg-gray-800 rounded p-4">
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">#{i + 1} - {result.chunk.documentId}</span>
                        <span
                          className={`px-2 py-1 rounded text-sm ${
                            result.score > 0.7
                              ? 'bg-green-900 text-green-300'
                              : result.score > 0.5
                              ? 'bg-yellow-900 text-yellow-300'
                              : 'bg-gray-700 text-gray-300'
                          }`}
                        >
                          {(result.score * 100).toFixed(1)}% match
                        </span>
                      </div>
                      <p className="text-gray-300">{result.chunk.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Query Tab */}
        {activeTab === 'query' && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">RAG Query</h2>
              <p className="text-gray-400 mb-4">
                Ask a question - retrieves relevant chunks and generates a grounded answer.
              </p>

              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask a question about the documents..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2"
                  onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                />
                <button
                  onClick={handleQuery}
                  disabled={loading || !stats.isReady}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-6 py-2 rounded-lg"
                >
                  {loading ? 'Querying...' : 'Ask'}
                </button>
              </div>

              {!stats.isReady && (
                <p className="text-yellow-400 text-sm">
                  Please ingest documents first.
                </p>
              )}

              <div className="text-sm text-gray-500">
                Example questions:
                <ul className="list-disc list-inside mt-1">
                  <li>What is TypeScript?</li>
                  <li>How does React use the virtual DOM?</li>
                  <li>What are common applications of LLMs?</li>
                </ul>
              </div>
            </div>

            {response && (
              <div className="space-y-4">
                <div className="bg-gray-900 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Answer</h2>
                  <div className="bg-gray-800 rounded p-4">
                    <p className="text-gray-200 whitespace-pre-wrap">{response.answer}</p>
                  </div>
                </div>

                {response.sources.length > 0 && (
                  <div className="bg-gray-900 rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">
                      Sources ({response.sources.length})
                    </h2>
                    <div className="space-y-3">
                      {response.sources.map((result, i) => (
                        <div key={result.chunk.id} className="bg-gray-800 rounded p-3">
                          <div className="flex justify-between mb-1 text-sm">
                            <span className="text-gray-400">
                              Source {i + 1}: {result.chunk.documentId}
                            </span>
                            <span className="text-blue-400">
                              {(result.score * 100).toFixed(1)}% relevance
                            </span>
                          </div>
                          <p className="text-sm text-gray-300 line-clamp-3">
                            {result.chunk.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Code Reference */}
        <div className="mt-8 bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Code to Study</h2>
          <pre className="bg-gray-800 p-4 rounded text-sm overflow-x-auto">
{`// lib/rag.ts - Key patterns

// 1. Document Chunking with overlap
export function chunkDocument(doc: Document, config: ChunkingConfig): Chunk[]

// 2. Embedding via llama-server
export async function getEmbedding(baseUrl: string, text: string): Promise<number[]>

// 3. Cosine Similarity search
export function cosineSimilarity(a: number[], b: number[]): number

// 4. VectorStore for in-memory search
class VectorStore {
  add(chunks: Chunk[]): void
  search(queryEmbedding: number[], topK: number): SearchResult[]
}

// 5. Complete RAG Pipeline
class RAGPipeline {
  async ingest(documents: Document[]): Promise<number>
  async query(question: string): Promise<RAGResponse>
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
