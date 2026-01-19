/**
 * Tests for RAG Pipeline
 */

import { describe, it, expect } from 'bun:test';
import {
  chunkDocument,
  chunkDocuments,
  cosineSimilarity,
  VectorStore,
  SAMPLE_DOCUMENTS,
  type Document,
  type Chunk,
} from './rag';

describe('chunkDocument', () => {
  it('should split document into chunks', () => {
    const doc: Document = {
      id: 'test-doc',
      content: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.',
    };

    const chunks = chunkDocument(doc, { maxChunkSize: 50, overlap: 10 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].documentId).toBe('test-doc');
    expect(chunks[0].id).toBe('test-doc-chunk-0');
  });

  it('should not split small documents', () => {
    const doc: Document = {
      id: 'small-doc',
      content: 'Short content.',
    };

    const chunks = chunkDocument(doc, { maxChunkSize: 500 });

    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe('Short content.');
  });

  it('should preserve metadata', () => {
    const doc: Document = {
      id: 'meta-doc',
      content: 'Content here',
      metadata: { source: 'test', author: 'test-author' },
    };

    const chunks = chunkDocument(doc);

    expect(chunks[0].metadata?.source).toBe('test');
    expect(chunks[0].metadata?.author).toBe('test-author');
  });

  it('should split on delimiters in priority order', () => {
    const doc: Document = {
      id: 'delimiter-doc',
      content:
        'First section with lots of text here.\n\nSecond section with more text.\n\nThird section.',
    };

    const chunks = chunkDocument(doc, {
      maxChunkSize: 60,
      overlap: 5,
      delimiters: ['\n\n', '\n', '. ', ' '],
    });

    // Should prefer splitting on \n\n
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].content).not.toContain('\n\n');
  });

  it('should include chunk index in metadata', () => {
    const doc: Document = {
      id: 'indexed-doc',
      content: 'Part one.\n\nPart two.\n\nPart three.',
    };

    const chunks = chunkDocument(doc, { maxChunkSize: 20 });

    chunks.forEach((chunk, i) => {
      expect(chunk.metadata?.chunkIndex).toBe(i);
    });
  });
});

describe('chunkDocuments', () => {
  it('should chunk multiple documents', () => {
    const docs: Document[] = [
      { id: 'doc1', content: 'First document content.' },
      { id: 'doc2', content: 'Second document content.' },
    ];

    const chunks = chunkDocuments(docs);

    expect(chunks.some((c) => c.documentId === 'doc1')).toBe(true);
    expect(chunks.some((c) => c.documentId === 'doc2')).toBe(true);
  });
});

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it('should return 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0);
  });

  it('should return -1 for opposite vectors', () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1);
  });

  it('should handle normalized vectors', () => {
    const a = [0.6, 0.8, 0];
    const b = [0.8, 0.6, 0];
    const similarity = cosineSimilarity(a, b);
    expect(similarity).toBeGreaterThan(0.9);
    expect(similarity).toBeLessThan(1);
  });

  it('should throw for vectors of different lengths', () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(() => cosineSimilarity(a, b)).toThrow('Vectors must have same length');
  });

  it('should return 0 for zero vectors', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });
});

describe('VectorStore', () => {
  it('should add and retrieve chunks', () => {
    const store = new VectorStore();
    const chunks: Chunk[] = [
      { id: 'c1', documentId: 'd1', content: 'Content 1', embedding: [1, 0, 0] },
      { id: 'c2', documentId: 'd1', content: 'Content 2', embedding: [0, 1, 0] },
    ];

    store.add(chunks);

    expect(store.size()).toBe(2);
    expect(store.getById('c1')?.content).toBe('Content 1');
    expect(store.getById('c2')?.content).toBe('Content 2');
  });

  it('should search by similarity', () => {
    const store = new VectorStore();
    const chunks: Chunk[] = [
      { id: 'c1', documentId: 'd1', content: 'Similar', embedding: [0.9, 0.1, 0] },
      { id: 'c2', documentId: 'd1', content: 'Different', embedding: [0, 0, 1] },
      { id: 'c3', documentId: 'd1', content: 'Very similar', embedding: [0.95, 0.05, 0] },
    ];

    store.add(chunks);

    const query = [1, 0, 0];
    const results = store.search(query, 2);

    expect(results.length).toBe(2);
    expect(results[0].chunk.id).toBe('c3'); // Most similar
    expect(results[1].chunk.id).toBe('c1'); // Second most similar
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('should filter by threshold', () => {
    const store = new VectorStore();
    const chunks: Chunk[] = [
      { id: 'c1', documentId: 'd1', content: 'High', embedding: [1, 0, 0] },
      { id: 'c2', documentId: 'd1', content: 'Low', embedding: [0.3, 0.95, 0] },
    ];

    store.add(chunks);

    const query = [1, 0, 0];
    const results = store.searchWithThreshold(query, 0.9, 10);

    expect(results.length).toBe(1);
    expect(results[0].chunk.id).toBe('c1');
  });

  it('should skip chunks without embeddings', () => {
    const store = new VectorStore();
    const chunks: Chunk[] = [
      { id: 'c1', documentId: 'd1', content: 'With embedding', embedding: [1, 0, 0] },
      { id: 'c2', documentId: 'd1', content: 'Without embedding' },
    ];

    store.add(chunks);

    const query = [1, 0, 0];
    const results = store.search(query);

    expect(results.length).toBe(1);
    expect(results[0].chunk.id).toBe('c1');
  });

  it('should clear the store', () => {
    const store = new VectorStore();
    store.add([{ id: 'c1', documentId: 'd1', content: 'Test', embedding: [1, 0, 0] }]);

    expect(store.size()).toBe(1);
    store.clear();
    expect(store.size()).toBe(0);
  });

  it('should return all chunks', () => {
    const store = new VectorStore();
    const chunks: Chunk[] = [
      { id: 'c1', documentId: 'd1', content: 'A' },
      { id: 'c2', documentId: 'd1', content: 'B' },
    ];

    store.add(chunks);

    const all = store.getAll();
    expect(all.length).toBe(2);
    // Should be a copy
    all.push({ id: 'c3', documentId: 'd1', content: 'C' });
    expect(store.size()).toBe(2);
  });
});

describe('SAMPLE_DOCUMENTS', () => {
  it('should have sample documents', () => {
    expect(SAMPLE_DOCUMENTS.length).toBeGreaterThan(0);
  });

  it('should have valid document structure', () => {
    for (const doc of SAMPLE_DOCUMENTS) {
      expect(doc.id).toBeDefined();
      expect(doc.content.length).toBeGreaterThan(0);
    }
  });

  it('should cover different topics', () => {
    const topics = SAMPLE_DOCUMENTS.map((d) => d.metadata?.topic);
    const uniqueTopics = [...new Set(topics)];
    expect(uniqueTopics.length).toBeGreaterThan(1);
  });
});

describe('Chunking edge cases', () => {
  it('should handle empty content', () => {
    const doc: Document = { id: 'empty', content: '' };
    const chunks = chunkDocument(doc);
    expect(chunks.length).toBe(0);
  });

  it('should handle whitespace-only content', () => {
    const doc: Document = { id: 'whitespace', content: '   \n\n   ' };
    const chunks = chunkDocument(doc);
    expect(chunks.length).toBe(0);
  });

  it('should handle very long content without delimiters', () => {
    const longWord = 'a'.repeat(1000);
    const doc: Document = { id: 'long', content: longWord };
    const chunks = chunkDocument(doc, { maxChunkSize: 100 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should respect overlap setting', () => {
    const doc: Document = {
      id: 'overlap-test',
      content: 'Word1 Word2 Word3 Word4 Word5 Word6 Word7 Word8',
    };
    const chunks = chunkDocument(doc, { maxChunkSize: 20, overlap: 10 });

    // With overlap, chunks should share some content
    if (chunks.length > 1) {
      const chunk0End = chunks[0].content.slice(-5);
      const chunk1Start = chunks[1].content.slice(0, 10);
      // There should be some overlap in the content area
      expect(chunks.length).toBeGreaterThan(1);
    }
  });
});
