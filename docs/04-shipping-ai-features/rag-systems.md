# Retrieval-Augmented Generation (RAG) Systems

> Building grounded AI systems that cite sources and admit when they don't know.

## TL;DR

- RAG = **retrieval + generation**: fetch relevant documents, then generate answers
- **Chunking strategy** matters more than embedding model choice
- Handle **freshness and staleness**—old documents cause wrong answers
- Implement **authorization-aware retrieval** for multi-tenant systems
- Design for **"I don't know"**—groundedness beats hallucination

## Core Concepts

### Context Window Management

When building AI features, you'll often encounter content that exceeds the model's context window. Understanding when and how to apply different strategies is crucial.

**Important**: Context quality degrades before reaching 100% capacity. Most models show degraded performance starting at 60-80% capacity due to attention dilution and the "lost in the middle" problem. Monitor context usage and apply these strategies proactively.

```
Content too large? ─┬─────────────────┬─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
              ┌──────────┐     ┌──────────┐     ┌──────────┐
              │  CHUNK   │     │ SUMMARIZE│     │ RETRIEVE │
              └────┬─────┘     └────┬─────┘     └────┬─────┘
                   │                │                │
              Split into       Condense to        Only fetch
              smaller          key points         relevant
              pieces                              parts
                   │                │                 │
                   ▼                ▼                 ▼
              Best for:        Best for:         Best for:
              Sequential       Verbose docs      Large corpus
              processing       Background        with retrieval
                               context           (RAG)
```

**1. Chunking: Process documents in pieces**

Use when you need to process a document larger than your context window and can handle it sequentially (e.g., extracting data from each section, translating page by page).

Chunking splits large documents so you can process them piece by piece. Each chunk goes through the LLM separately. This works when:
- The task is local to each chunk (extract entities, translate, summarize per section)
- You can aggregate results from multiple chunks
- Sequential processing is acceptable (not one unified answer)

**Example: Extract action items from a long meeting transcript**

```typescript
async function extractActionItems(transcript: string): Promise<ActionItem[]> {
  const chunks = chunkDocument(transcript, { maxTokens: 4000 });
  const allActionItems: ActionItem[] = [];

  for (const chunk of chunks) {
    const result = await llm.chat({
      messages: [{
        role: 'user',
        content: `Extract action items from this meeting segment:\n\n${chunk}`
      }]
    });
    allActionItems.push(...parseActionItems(result));
  }

  return allActionItems;
}

function chunkDocument(text: string, options: { maxTokens: number }): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split('\n\n');

  let currentChunk = '';
  for (const paragraph of paragraphs) {
    if (estimateTokens(currentChunk + paragraph) > options.maxTokens) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk += '\n\n' + paragraph;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
```

**Why this doesn't help with unified understanding**: If you need the LLM to answer a question requiring information from multiple chunks (e.g., "Compare the Q1 and Q4 results"), chunking alone fails. Use retrieval instead.

**2. Summarization: Condense verbose content**

Use when you have a large amount of background information but don't need every detail—only the key points relevant to your task.

```typescript
async function summarizeForContext(
  longDocument: string,
  focusArea: string
): Promise<string> {
  const response = await llm.chat({
    messages: [
      {
        role: 'system',
        content: 'Summarize the following document, focusing on information relevant to the specified area. Preserve specific details, code snippets, and technical specifications.',
      },
      {
        role: 'user',
        content: `Focus area: ${focusArea}\n\nDocument:\n${longDocument}`,
      },
    ],
  });

  return response.content;
}
```

**Trade-off**: Summarization loses detail. Use when overview is sufficient; avoid when precision matters.

**3. Retrieval (RAG): Only include what's relevant**

Use when you have a large knowledge base and need to answer questions that could draw from anywhere in it. This is the only strategy that scales to unlimited corpus size.

Retrieval-Augmented Generation (RAG) is a pattern where you search a knowledge base to find relevant documents, then include only those documents in the LLM's context.

```typescript
async function getRelevantContext(
  query: string,
  documents: Document[],
  maxChunks: number = 5
): Promise<string> {
  // Embed the query
  const queryEmbedding = await embed(query);

  // Find most similar chunks
  const ranked = documents
    .map((doc) => ({
      doc,
      similarity: cosineSimilarity(queryEmbedding, doc.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxChunks);

  return ranked.map((r) => r.doc.content).join('\n\n---\n\n');
}
```

The rest of this document focuses on implementing production-grade RAG systems.

### RAG Architecture

```
RAG Pipeline Overview
─────────────────────

  User Query
      │
      ▼
┌──────────────┐
│   RETRIEVE   │ ─── Search vector DB for relevant documents
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   RERANK     │ ─── Score and re-order by relevance (optional)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   GENERATE   │ ─── LLM generates answer using retrieved docs
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   GROUND     │ ─── Verify answer is supported by sources
└──────┬───────┘
       │
       ▼
  Cited Response
```

> **RAG (Retrieval-Augmented Generation)**: Architecture where an LLM's response is grounded in retrieved documents rather than relying solely on training data. Reduces hallucination and enables citing sources.

```typescript
interface RAGPipeline {
  retriever: Retriever;
  reranker?: Reranker;
  generator: Generator;
  groundingChecker: GroundingChecker;
}

async function ragQuery(
  query: string,
  pipeline: RAGPipeline,
  context: QueryContext
): Promise<RAGResponse> {
  // Step 1: Retrieve relevant documents
  const retrieved = await pipeline.retriever.search(query, {
    limit: 20,
    filters: context.accessFilters,
  });

  // Step 2: Rerank for relevance (optional but recommended)
  const reranked = pipeline.reranker
    ? await pipeline.reranker.rerank(query, retrieved)
    : retrieved;

  // Step 3: Select top documents
  const topDocs = reranked.slice(0, 5);

  // Step 4: Generate response
  const response = await pipeline.generator.generate({
    query,
    documents: topDocs,
    systemPrompt: RAG_SYSTEM_PROMPT,
  });

  // Step 5: Check grounding
  const grounding = await pipeline.groundingChecker.check(response, topDocs);

  return {
    answer: response.content,
    sources: topDocs.map(d => ({ id: d.id, title: d.title, excerpt: d.excerpt })),
    grounding: {
      score: grounding.score,
      citations: grounding.citations,
      ungroundedClaims: grounding.ungrounded,
    },
  };
}
```

### Chunking Strategies

> **Chunking**: Splitting large documents into smaller pieces (chunks) for embedding and retrieval. Chunk size and boundaries significantly impact retrieval quality.

> **Embedding**: Converting text into a dense vector (array of numbers) that captures semantic meaning. Similar texts have similar embeddings, enabling semantic search.

How you split documents matters more than which embedding model you use.

**Fixed-size chunking:**

```typescript
function fixedSizeChunk(
  text: string,
  chunkSize: number = 512,
  overlap: number = 50
): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push({
      content: text.slice(start, end),
      startIndex: start,
      endIndex: end,
    });
    start += chunkSize - overlap;
  }

  return chunks;
}
```

**Semantic chunking** (better for coherent retrieval):

```typescript
function semanticChunk(document: Document): Chunk[] {
  const chunks: Chunk[] = [];

  // Split by natural boundaries
  const sections = splitBySections(document);

  for (const section of sections) {
    // Keep sections together if small enough
    if (tokenCount(section.content) <= MAX_CHUNK_TOKENS) {
      chunks.push({
        content: section.content,
        metadata: {
          title: section.title,
          path: section.path,
        },
      });
    } else {
      // Split large sections by paragraph
      const paragraphs = splitByParagraphs(section.content);
      let currentChunk = '';

      for (const para of paragraphs) {
        if (tokenCount(currentChunk + para) > MAX_CHUNK_TOKENS) {
          chunks.push({
            content: currentChunk,
            metadata: { title: section.title, path: section.path },
          });
          currentChunk = para;
        } else {
          currentChunk += '\n\n' + para;
        }
      }

      if (currentChunk) {
        chunks.push({
          content: currentChunk,
          metadata: { title: section.title, path: section.path },
        });
      }
    }
  }

  return chunks;
}
```

### Indexing and Embedding

```typescript
interface IndexingPipeline {
  embedder: EmbeddingModel;
  vectorStore: VectorStore;
  metadata: MetadataExtractor;
}

async function indexDocument(
  doc: Document,
  pipeline: IndexingPipeline
): Promise<void> {
  // Extract chunks
  const chunks = semanticChunk(doc);

  // Embed in batches
  const embeddings = await pipeline.embedder.embedBatch(
    chunks.map(c => c.content)
  );

  // Extract metadata
  const metadata = await pipeline.metadata.extract(doc);

  // Store with metadata
  for (let i = 0; i < chunks.length; i++) {
    await pipeline.vectorStore.upsert({
      id: `${doc.id}-chunk-${i}`,
      embedding: embeddings[i],
      content: chunks[i].content,
      metadata: {
        ...metadata,
        ...chunks[i].metadata,
        docId: doc.id,
        chunkIndex: i,
        indexed_at: new Date().toISOString(),
      },
    });
  }
}

// Embedding model options
const embeddingModels = {
  // Proprietary (best quality)
  'openai/text-embedding-3-large': { dimensions: 3072, quality: 'excellent' },
  'voyage/voyage-3': { dimensions: 1024, quality: 'excellent' },

  // Open source (good quality, self-hostable)
  'BAAI/bge-large-en-v1.5': { dimensions: 1024, quality: 'very good' },
  'sentence-transformers/all-MiniLM-L6-v2': { dimensions: 384, quality: 'good' },
};
```

### Hybrid Search

> **Hybrid Search**: Combining semantic search (embeddings) with keyword search (BM25/full-text) and merging results. Semantic finds conceptually similar content; keyword finds exact matches. Together they cover more cases.

Combine semantic search with keyword search for better results.

```typescript
interface HybridSearchConfig {
  semanticWeight: number;  // 0-1
  keywordWeight: number;   // 0-1
  minimumScore: number;
}

async function hybridSearch(
  query: string,
  config: HybridSearchConfig
): Promise<SearchResult[]> {
  // Parallel search
  const [semanticResults, keywordResults] = await Promise.all([
    semanticSearch(query),
    keywordSearch(query),  // BM25 or similar
  ]);

  // Combine with Reciprocal Rank Fusion (RRF)
  const combined = reciprocalRankFusion([
    { results: semanticResults, weight: config.semanticWeight },
    { results: keywordResults, weight: config.keywordWeight },
  ]);

  return combined.filter(r => r.score >= config.minimumScore);
}

function reciprocalRankFusion(
  resultSets: { results: SearchResult[]; weight: number }[]
): SearchResult[] {
  const scores = new Map<string, number>();
  const k = 60;  // RRF constant

  for (const { results, weight } of resultSets) {
    for (let rank = 0; rank < results.length; rank++) {
      const doc = results[rank];
      const rrfScore = weight / (k + rank + 1);
      scores.set(doc.id, (scores.get(doc.id) || 0) + rrfScore);
    }
  }

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
```

### Reranking

> **Reranking**: A second-stage ranking pass using a more expensive cross-encoder model to re-score the initial retrieval results. First-stage retrieval prioritizes recall; reranking prioritizes precision.

Improve relevance after initial retrieval.

```typescript
// Cross-encoder reranking
async function rerank(
  query: string,
  documents: Document[],
  model: string = 'cross-encoder/ms-marco-MiniLM-L-6-v2'
): Promise<Document[]> {
  const pairs = documents.map(doc => ({
    query,
    passage: doc.content,
    docId: doc.id,
  }));

  const scores = await crossEncoderScore(pairs, model);

  return documents
    .map((doc, i) => ({ ...doc, relevanceScore: scores[i] }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// Cohere Rerank API (production-ready)
async function cohereRerank(
  query: string,
  documents: Document[]
): Promise<Document[]> {
  const response = await cohere.rerank({
    model: 'rerank-english-v3.0',
    query,
    documents: documents.map(d => d.content),
    topN: 10,
  });

  return response.results.map(r => ({
    ...documents[r.index],
    relevanceScore: r.relevanceScore,
  }));
}
```

### Freshness and Staleness

Old documents cause wrong answers. Handle it.

```typescript
interface FreshnessPolicy {
  maxAge: Record<string, number>;  // days by content type
  staleBehavior: 'warn' | 'exclude' | 'downrank';
  refreshStrategy: 'on-access' | 'scheduled' | 'webhook';
}

async function searchWithFreshness(
  query: string,
  policy: FreshnessPolicy
): Promise<SearchResult[]> {
  const results = await vectorStore.search(query);

  return results.map(result => {
    const docAge = daysSince(result.metadata.indexed_at);
    const maxAge = policy.maxAge[result.metadata.contentType] || 30;
    const isStale = docAge > maxAge;

    if (isStale) {
      switch (policy.staleBehavior) {
        case 'exclude':
          return null;
        case 'downrank':
          return { ...result, score: result.score * 0.5 };
        case 'warn':
          return {
            ...result,
            metadata: { ...result.metadata, staleWarning: true },
          };
      }
    }

    return result;
  }).filter(Boolean);
}

// Scheduled refresh
async function refreshStaleDocuments(): Promise<void> {
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - MAX_DOCUMENT_AGE);

  const staleDocs = await db.documents.findMany({
    where: { indexedAt: { lt: staleThreshold } },
  });

  for (const doc of staleDocs) {
    const fresh = await fetchLatestVersion(doc.sourceUrl);
    if (fresh.content !== doc.content) {
      await reindexDocument(fresh);
    }
  }
}
```

### Authorization-Aware Retrieval

For multi-tenant systems, enforce access control.

```typescript
interface AccessPolicy {
  userId: string;
  tenantId: string;
  roles: string[];
  documentACL: DocumentACL;
}

async function authorizedSearch(
  query: string,
  policy: AccessPolicy
): Promise<SearchResult[]> {
  // Build filter from access policy
  const accessFilter = buildAccessFilter(policy);

  // Search with filter
  const results = await vectorStore.search(query, {
    filter: accessFilter,
  });

  // Double-check authorization (belt and suspenders)
  return results.filter(r => canAccess(r.metadata, policy));
}

function buildAccessFilter(policy: AccessPolicy): VectorFilter {
  return {
    $or: [
      // Public documents
      { visibility: 'public' },
      // Tenant documents
      { tenantId: policy.tenantId },
      // Explicitly shared
      { sharedWith: { $contains: policy.userId } },
      // Role-based access
      { requiredRoles: { $in: policy.roles } },
    ],
  };
}

// Document-level ACL
interface DocumentACL {
  owner: string;
  visibility: 'public' | 'tenant' | 'private';
  sharedWith: string[];
  requiredRoles: string[];
}
```

### Groundedness and Citations

> **Groundedness**: The degree to which an LLM's response is supported by the provided source documents. A "grounded" response makes claims only from the sources; an "ungrounded" response invents information.

Ensure answers are supported by sources.

```typescript
interface GroundingResult {
  score: number;  // 0-1, how well grounded
  citations: Citation[];
  ungroundedClaims: string[];
}

async function checkGrounding(
  response: string,
  sources: Document[]
): Promise<GroundingResult> {
  // Extract claims from response
  const claims = await extractClaims(response);

  const citations: Citation[] = [];
  const ungroundedClaims: string[] = [];

  for (const claim of claims) {
    // Find supporting source
    const support = await findSupport(claim, sources);

    if (support) {
      citations.push({
        claim,
        sourceId: support.document.id,
        excerpt: support.excerpt,
        confidence: support.confidence,
      });
    } else {
      ungroundedClaims.push(claim);
    }
  }

  const score = citations.length / (citations.length + ungroundedClaims.length);

  return { score, citations, ungroundedClaims };
}

// RAG prompt that encourages grounding
const RAG_SYSTEM_PROMPT = `
You are a helpful assistant that answers questions based on the provided documents.

Rules:
- Only answer based on information in the provided documents
- If the documents don't contain the answer, say "I don't have information about that"
- Cite your sources using [1], [2], etc.
- Don't make up information not in the documents
- If you're unsure, express uncertainty

Documents will be provided in the next message.
`;
```

### Vector Database Options

| Database | Strengths | Best For |
|----------|-----------|----------|
| [Pinecone](https://pinecone.io) | Managed, scalable | Production, minimal ops |
| [Weaviate](https://weaviate.io) | Hybrid search, OSS | Self-hosted, flexibility |
| [Qdrant](https://qdrant.tech) | Performance, Rust | Cost-sensitive, edge |
| [Chroma](https://trychroma.com) | Simple, lightweight | Prototyping, small scale |
| [pgvector](https://github.com/pgvector/pgvector) | Postgres integration | Existing Postgres users |

## Common Pitfalls

- **Bad chunking.** Splitting mid-sentence or mid-paragraph hurts retrieval quality.
- **No reranking.** Initial retrieval is noisy; reranking significantly improves relevance.
- **Stale documents.** Old information presented as current causes user distrust.
- **No access control.** Multi-tenant RAG without ACLs leaks data.

## Related

- [LLM Mechanics](../01-core-concepts/llm-mechanics.md) — Context windows and token costs
- [API Integration](./api-integration.md) — Caching and performance
- [Security](./security.md) — Indirect injection via retrieved content
