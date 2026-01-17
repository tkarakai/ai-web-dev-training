/**
 * RAG (Retrieval-Augmented Generation) utilities
 * - Document chunking strategies
 * - Embedding and similarity search
 * - Hybrid search (semantic + keyword)
 * - Reranking
 * - Freshness handling
 * - Groundedness checking
 */

import { generateId } from '@examples/shared/lib/utils';

// Types
export interface Document {
  id: string;
  title: string;
  content: string;
  source: string;
  metadata: DocumentMetadata;
}

export interface DocumentMetadata {
  author?: string;
  createdAt: Date;
  updatedAt: Date;
  contentType: string;
  tenantId?: string;
  visibility: 'public' | 'tenant' | 'private';
  tags: string[];
}

export interface Chunk {
  id: string;
  docId: string;
  content: string;
  index: number;
  embedding?: number[];
  metadata: {
    title: string;
    section?: string;
    startChar: number;
    endChar: number;
  };
}

export interface SearchResult {
  chunk: Chunk;
  score: number;
  matchType: 'semantic' | 'keyword' | 'hybrid';
  highlighted?: string;
}

export interface RerankedResult extends SearchResult {
  originalRank: number;
  rerankedScore: number;
}

export interface Citation {
  claim: string;
  sourceId: string;
  sourceTitle: string;
  excerpt: string;
  confidence: number;
}

export interface GroundingResult {
  score: number;
  citations: Citation[];
  ungroundedClaims: string[];
}

export interface RAGResponse {
  answer: string;
  sources: { id: string; title: string; excerpt: string }[];
  grounding: GroundingResult;
}

// Chunking strategies
export type ChunkingStrategy = 'fixed' | 'semantic' | 'paragraph';

export function chunkDocument(
  doc: Document,
  strategy: ChunkingStrategy,
  options: { maxTokens?: number; overlap?: number } = {}
): Chunk[] {
  const maxTokens = options.maxTokens || 500;
  const overlap = options.overlap || 50;

  switch (strategy) {
    case 'fixed':
      return fixedSizeChunk(doc, maxTokens, overlap);
    case 'semantic':
      return semanticChunk(doc, maxTokens);
    case 'paragraph':
      return paragraphChunk(doc, maxTokens);
    default:
      return fixedSizeChunk(doc, maxTokens, overlap);
  }
}

function fixedSizeChunk(doc: Document, maxChars: number, overlap: number): Chunk[] {
  const chunks: Chunk[] = [];
  const content = doc.content;
  let start = 0;
  let index = 0;

  while (start < content.length) {
    const end = Math.min(start + maxChars, content.length);
    chunks.push({
      id: generateId('chunk'),
      docId: doc.id,
      content: content.slice(start, end),
      index,
      metadata: {
        title: doc.title,
        startChar: start,
        endChar: end,
      },
    });
    start += maxChars - overlap;
    index++;
  }

  return chunks;
}

function semanticChunk(doc: Document, maxChars: number): Chunk[] {
  const chunks: Chunk[] = [];
  const sections = doc.content.split(/\n#{1,3}\s+/);
  let index = 0;
  let charOffset = 0;

  for (const section of sections) {
    if (section.trim().length === 0) continue;

    const lines = section.split('\n');
    const sectionTitle = lines[0].trim();
    const sectionContent = lines.slice(1).join('\n').trim();

    if (sectionContent.length <= maxChars) {
      chunks.push({
        id: generateId('chunk'),
        docId: doc.id,
        content: sectionContent || sectionTitle,
        index,
        metadata: {
          title: doc.title,
          section: sectionTitle,
          startChar: charOffset,
          endChar: charOffset + section.length,
        },
      });
      index++;
    } else {
      // Split large sections by paragraph
      const paragraphs = sectionContent.split('\n\n');
      let currentChunk = '';

      for (const para of paragraphs) {
        if ((currentChunk + para).length > maxChars && currentChunk.length > 0) {
          chunks.push({
            id: generateId('chunk'),
            docId: doc.id,
            content: currentChunk.trim(),
            index,
            metadata: {
              title: doc.title,
              section: sectionTitle,
              startChar: charOffset,
              endChar: charOffset + currentChunk.length,
            },
          });
          index++;
          currentChunk = para;
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + para;
        }
      }

      if (currentChunk.trim()) {
        chunks.push({
          id: generateId('chunk'),
          docId: doc.id,
          content: currentChunk.trim(),
          index,
          metadata: {
            title: doc.title,
            section: sectionTitle,
            startChar: charOffset,
            endChar: charOffset + currentChunk.length,
          },
        });
        index++;
      }
    }

    charOffset += section.length + 1;
  }

  return chunks;
}

function paragraphChunk(doc: Document, maxChars: number): Chunk[] {
  const chunks: Chunk[] = [];
  const paragraphs = doc.content.split('\n\n');
  let currentChunk = '';
  let index = 0;
  let startChar = 0;

  for (const para of paragraphs) {
    if ((currentChunk + para).length > maxChars && currentChunk.length > 0) {
      chunks.push({
        id: generateId('chunk'),
        docId: doc.id,
        content: currentChunk.trim(),
        index,
        metadata: {
          title: doc.title,
          startChar,
          endChar: startChar + currentChunk.length,
        },
      });
      index++;
      startChar += currentChunk.length + 2;
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      id: generateId('chunk'),
      docId: doc.id,
      content: currentChunk.trim(),
      index,
      metadata: {
        title: doc.title,
        startChar,
        endChar: startChar + currentChunk.length,
      },
    });
  }

  return chunks;
}

// Simulated embedding (in production, use a real embedding model)
export function simulateEmbedding(text: string): number[] {
  // Create a deterministic but varied embedding based on text content
  const embedding: number[] = [];
  const normalized = text.toLowerCase();

  for (let i = 0; i < 64; i++) {
    let value = 0;
    for (let j = 0; j < normalized.length; j++) {
      value += normalized.charCodeAt(j) * Math.sin((i + 1) * (j + 1));
    }
    embedding.push(Math.tanh(value / normalized.length));
  }

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map(v => v / magnitude);
}

// Cosine similarity
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Semantic search
export function semanticSearch(
  query: string,
  chunks: Chunk[],
  limit: number = 10
): SearchResult[] {
  const queryEmbedding = simulateEmbedding(query);

  return chunks
    .map(chunk => {
      const chunkEmbedding = chunk.embedding || simulateEmbedding(chunk.content);
      const score = cosineSimilarity(queryEmbedding, chunkEmbedding);
      return {
        chunk,
        score,
        matchType: 'semantic' as const,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Keyword search (BM25-like)
export function keywordSearch(
  query: string,
  chunks: Chunk[],
  limit: number = 10
): SearchResult[] {
  const queryTerms = query.toLowerCase().split(/\s+/);

  return chunks
    .map(chunk => {
      const content = chunk.content.toLowerCase();
      let score = 0;
      let highlighted = chunk.content;

      for (const term of queryTerms) {
        const regex = new RegExp(term, 'gi');
        const matches = content.match(regex);
        if (matches) {
          score += matches.length * (1 / Math.log(content.length + 1));
          highlighted = highlighted.replace(regex, `**${term}**`);
        }
      }

      return {
        chunk,
        score,
        matchType: 'keyword' as const,
        highlighted: score > 0 ? highlighted : undefined,
      };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Hybrid search with RRF
export function hybridSearch(
  query: string,
  chunks: Chunk[],
  options: { semanticWeight?: number; keywordWeight?: number; limit?: number } = {}
): SearchResult[] {
  const semanticWeight = options.semanticWeight || 0.7;
  const keywordWeight = options.keywordWeight || 0.3;
  const limit = options.limit || 10;
  const k = 60; // RRF constant

  const semanticResults = semanticSearch(query, chunks, 20);
  const keywordResults = keywordSearch(query, chunks, 20);

  // Reciprocal Rank Fusion
  const scores = new Map<string, { score: number; chunk: Chunk; highlighted?: string }>();

  semanticResults.forEach((result, rank) => {
    const rrfScore = semanticWeight / (k + rank + 1);
    const existing = scores.get(result.chunk.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(result.chunk.id, { score: rrfScore, chunk: result.chunk });
    }
  });

  keywordResults.forEach((result, rank) => {
    const rrfScore = keywordWeight / (k + rank + 1);
    const existing = scores.get(result.chunk.id);
    if (existing) {
      existing.score += rrfScore;
      if (result.highlighted) existing.highlighted = result.highlighted;
    } else {
      scores.set(result.chunk.id, {
        score: rrfScore,
        chunk: result.chunk,
        highlighted: result.highlighted,
      });
    }
  });

  return Array.from(scores.values())
    .map(({ score, chunk, highlighted }) => ({
      chunk,
      score,
      matchType: 'hybrid' as const,
      highlighted,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Simulated reranking
export function rerank(
  query: string,
  results: SearchResult[]
): RerankedResult[] {
  // Simulate cross-encoder reranking with query-document relevance
  const queryTerms = new Set(query.toLowerCase().split(/\s+/));

  return results
    .map((result, originalRank) => {
      const content = result.chunk.content.toLowerCase();

      // Simulate more sophisticated relevance scoring
      let relevance = 0;

      // Term overlap
      for (const term of queryTerms) {
        if (content.includes(term)) {
          relevance += 0.2;
        }
      }

      // Position bonus (terms at start are more relevant)
      const firstTermPos = Array.from(queryTerms)
        .map(t => content.indexOf(t))
        .filter(p => p >= 0)
        .sort((a, b) => a - b)[0];

      if (firstTermPos !== undefined && firstTermPos < 100) {
        relevance += 0.3 * (1 - firstTermPos / 100);
      }

      // Length penalty (prefer concise answers)
      relevance -= Math.log(content.length) / 100;

      // Original score contribution
      relevance += result.score * 0.5;

      return {
        ...result,
        originalRank,
        rerankedScore: Math.max(0, Math.min(1, relevance)),
      };
    })
    .sort((a, b) => b.rerankedScore - a.rerankedScore);
}

// Check groundedness
export function checkGrounding(
  response: string,
  sources: Chunk[]
): GroundingResult {
  // Extract claims (simplified - in production use NLI model)
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const citations: Citation[] = [];
  const ungroundedClaims: string[] = [];

  for (const sentence of sentences) {
    const claim = sentence.trim();
    if (!claim) continue;

    // Find supporting source
    let bestMatch: { chunk: Chunk; confidence: number } | null = null;
    const claimTerms = claim.toLowerCase().split(/\s+/);

    for (const chunk of sources) {
      const chunkLower = chunk.content.toLowerCase();
      let matchCount = 0;

      for (const term of claimTerms) {
        if (term.length > 3 && chunkLower.includes(term)) {
          matchCount++;
        }
      }

      const confidence = matchCount / claimTerms.length;
      if (confidence > 0.3 && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = { chunk, confidence };
      }
    }

    if (bestMatch && bestMatch.confidence > 0.4) {
      citations.push({
        claim,
        sourceId: bestMatch.chunk.docId,
        sourceTitle: bestMatch.chunk.metadata.title,
        excerpt: bestMatch.chunk.content.slice(0, 200) + '...',
        confidence: bestMatch.confidence,
      });
    } else {
      ungroundedClaims.push(claim);
    }
  }

  const totalClaims = citations.length + ungroundedClaims.length;
  const score = totalClaims > 0 ? citations.length / totalClaims : 0;

  return { score, citations, ungroundedClaims };
}

// Sample documents for demo
export const sampleDocuments: Document[] = [
  {
    id: 'doc-1',
    title: 'Product Documentation',
    content: `# Getting Started

Welcome to our product documentation. This guide will help you get started quickly.

## Installation

To install the product, run the following command:

\`\`\`bash
npm install our-product
\`\`\`

Make sure you have Node.js 18 or later installed.

## Configuration

Create a configuration file named \`config.json\` in your project root:

\`\`\`json
{
  "apiKey": "your-api-key",
  "environment": "production"
}
\`\`\`

## API Reference

### authenticate(apiKey)

Authenticates with the API using your API key. Returns a session token.

### fetchData(query)

Fetches data based on the provided query. Supports pagination with \`limit\` and \`offset\` parameters.

### updateSettings(settings)

Updates user settings. The settings object should contain the fields you want to update.`,
    source: 'docs.example.com',
    metadata: {
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-06-01'),
      contentType: 'documentation',
      visibility: 'public',
      tags: ['getting-started', 'api', 'configuration'],
    },
  },
  {
    id: 'doc-2',
    title: 'Troubleshooting Guide',
    content: `# Troubleshooting

This guide covers common issues and their solutions.

## Authentication Errors

### Error: Invalid API Key

If you see this error, check that:
1. Your API key is correctly copied from the dashboard
2. The key hasn't expired (keys expire after 90 days)
3. You're using the correct environment (test vs production)

To generate a new API key, go to Settings > API Keys > Create New.

### Error: Rate Limited

Our API has rate limits of 100 requests per minute. If you exceed this:
- Implement exponential backoff
- Use batch endpoints where available
- Consider upgrading to a higher tier

## Data Issues

### Missing Data

If data appears to be missing:
1. Check your query filters
2. Verify the data exists in your account
3. Ensure you have the correct permissions

### Slow Queries

For slow queries:
- Add appropriate indexes
- Use pagination for large result sets
- Consider caching frequently accessed data`,
    source: 'support.example.com',
    metadata: {
      createdAt: new Date('2024-02-20'),
      updatedAt: new Date('2024-05-15'),
      contentType: 'support',
      visibility: 'public',
      tags: ['troubleshooting', 'errors', 'support'],
    },
  },
  {
    id: 'doc-3',
    title: 'Pricing and Plans',
    content: `# Pricing

We offer flexible pricing plans to meet your needs.

## Free Tier

- 1,000 API requests per month
- Basic support
- Community access
- Single user

## Pro Plan - $29/month

- 50,000 API requests per month
- Priority support
- Advanced analytics
- Up to 5 team members
- Custom integrations

## Enterprise Plan - Custom

- Unlimited API requests
- 24/7 dedicated support
- Custom SLA
- Unlimited team members
- On-premise deployment option
- SSO and SAML

## Billing

All plans are billed monthly. Annual billing is available with a 20% discount.

Refunds are available within 14 days of purchase. Contact support@example.com for refund requests.`,
    source: 'pricing.example.com',
    metadata: {
      createdAt: new Date('2024-03-01'),
      updatedAt: new Date('2024-04-10'),
      contentType: 'pricing',
      visibility: 'public',
      tags: ['pricing', 'plans', 'billing'],
    },
  },
];

// Sample queries for demo
export const sampleQueries = [
  'How do I install the product?',
  'What should I do if I get a rate limit error?',
  'How much does the Pro plan cost?',
  'How do I authenticate with the API?',
  'What is the refund policy?',
];

// RAG system prompt
export const RAG_SYSTEM_PROMPT = `You are a helpful assistant that answers questions based on the provided documents.

Rules:
- Only answer based on information in the provided documents
- If the documents don't contain the answer, say "I don't have information about that"
- Cite your sources using [1], [2], etc.
- Don't make up information not in the documents
- If you're unsure, express uncertainty

Documents will be provided in the next message.`;

// Freshness status colors
export const freshnessColors: Record<string, string> = {
  fresh: 'bg-green-100 text-green-800 border-green-200',
  stale: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  expired: 'bg-red-100 text-red-800 border-red-200',
};

// Get freshness status
export function getFreshnessStatus(updatedAt: Date, maxAgeDays: number = 30): 'fresh' | 'stale' | 'expired' {
  const ageMs = Date.now() - updatedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= maxAgeDays * 0.5) return 'fresh';
  if (ageDays <= maxAgeDays) return 'stale';
  return 'expired';
}
