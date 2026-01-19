# Exercise 15: RAG Pipeline

Build a complete Retrieval-Augmented Generation system using llama-server embeddings.

## What You'll Learn

1. **Chunking** - Split documents into overlapping pieces for retrieval
2. **Embeddings** - Convert text to vectors using llama-server `/embedding` endpoint
3. **Vector Search** - Find similar content using cosine similarity
4. **Grounded Generation** - Answer questions using retrieved context

## Prerequisites

**llama-server must be running WITH embedding support:**

```bash
llama-server -m your-model.gguf --port 8033 --embedding
```

The `--embedding` flag is required for the `/embedding` endpoint.

## The Code to Study

```
lib/rag.ts       <- THE MAIN FILE - chunking, embeddings, vector store, RAG pipeline
lib/rag.test.ts  <- Unit tests for chunking, similarity, vector store
```

## Key Concepts

### 1. Document Chunking

```typescript
interface ChunkingConfig {
  maxChunkSize: number;    // Max chars per chunk
  overlap: number;         // Overlap between chunks
  delimiters: string[];    // Split on these (priority order)
}

// Chunk a document
const chunks = chunkDocument(document, {
  maxChunkSize: 500,
  overlap: 50,
  delimiters: ['\n\n', '\n', '. ', ' '],
});
```

**Why overlap?** If a relevant sentence spans two chunks, overlap ensures it's captured in at least one chunk completely.

### 2. Embeddings via llama-server

```typescript
// Single embedding
const embedding = await getEmbedding(baseUrl, 'Your text here');
// Returns: number[] (e.g., 384, 768, or 4096 dimensions)

// Batch embeddings with concurrency control
const embeddings = await getEmbeddings(baseUrl, [
  'First text',
  'Second text',
  'Third text',
]);
```

### 3. Cosine Similarity

```typescript
// Measure similarity between vectors
const similarity = cosineSimilarity(vectorA, vectorB);
// Returns: -1 to 1 (1 = identical, 0 = orthogonal, -1 = opposite)

// Higher is more similar
if (similarity > 0.7) {
  console.log('Very relevant');
}
```

### 4. Vector Store

```typescript
const store = new VectorStore();

// Add embedded chunks
store.add(embeddedChunks);

// Search by similarity
const results = store.search(queryEmbedding, 5);  // top 5
// Returns: { chunk, score }[]

// Search with minimum threshold
const filtered = store.searchWithThreshold(queryEmbedding, 0.5, 5);
```

### 5. Complete RAG Pipeline

```typescript
const rag = new RAGPipeline({
  baseUrl: 'http://127.0.0.1:8033',
  topK: 3,           // Retrieve top 3 chunks
  minScore: 0.3,     // Minimum relevance threshold
  includeSources: true,
});

// Ingest documents
const chunkCount = await rag.ingest(documents);

// Query with grounded generation
const response = await rag.query('What is TypeScript?');
console.log(response.answer);    // LLM's answer using retrieved context
console.log(response.sources);   // The chunks used as context
```

## Run the Exercise

```bash
# Install dependencies
bun install

# Run tests
bun test

# Start the UI (requires llama-server with --embedding)
bun dev
```

Open http://localhost:3015 to see RAG in action.

## RAG Flow

```
User Query
    │
    ▼
┌─────────────────┐
│ Get Query       │  ← Embed the question
│ Embedding       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Vector Search   │  ← Find similar chunks
│ (cosine sim)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Build Context   │  ← Combine top chunks
│                 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate Answer │  ← LLM with context
│ (grounded)      │
└────────┬────────┘
         │
         ▼
   Answer + Sources
```

## Code Patterns to Note

### Smart Chunking

```typescript
function findSplitPoint(text: string, maxLength: number, delimiters: string[]): number {
  // Try each delimiter in priority order
  for (const delimiter of delimiters) {
    const lastIndex = text.slice(0, maxLength).lastIndexOf(delimiter);
    // Only use if we're past 30% of the chunk (avoid tiny chunks)
    if (lastIndex > maxLength * 0.3) {
      return lastIndex + delimiter.length;
    }
  }
  return maxLength;  // Hard cut if no good split point
}
```

### Grounded System Prompt

```typescript
const systemPrompt = `You are a helpful assistant that answers questions based on the provided context.
If the context doesn't contain enough information to answer, say so.
Always base your answer on the provided context.`;

const userPrompt = `Context:
${context}

Question: ${question}

Answer based on the context above:`;
```

### Concurrency-Limited Embeddings

```typescript
async function getEmbeddings(baseUrl: string, texts: string[]): Promise<number[][]> {
  const concurrency = 5;  // Don't overwhelm the server
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(text => getEmbedding(baseUrl, text))
    );
    results.push(...batchResults);
  }

  return results;
}
```

## Exercises to Try

1. **Implement hybrid search** - Combine vector search with keyword matching (BM25)
2. **Add re-ranking** - Use a cross-encoder to re-rank search results
3. **Chunk by semantics** - Split on topic changes instead of fixed size
4. **Add metadata filtering** - Filter by document source, date, etc.
5. **Implement persistence** - Save/load the vector store to disk

## Common Issues

### "Embedding request failed"
- Make sure llama-server is running with `--embedding` flag
- Check the model supports embeddings

### Low similarity scores
- Increase chunk overlap
- Try different chunking sizes
- Use a model better suited for embeddings

### Answer not grounded
- Lower the temperature (0.1-0.3)
- Add more explicit grounding instructions
- Increase topK to provide more context

## Next Exercise

[Exercise 16: Model Routing](../16-model-routing) - Route requests to different models based on complexity.
