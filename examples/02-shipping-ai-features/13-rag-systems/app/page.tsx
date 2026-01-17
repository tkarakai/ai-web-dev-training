'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { Input } from '@examples/shared/components/ui/input';
import {
  Document,
  Chunk,
  SearchResult,
  RerankedResult,
  GroundingResult,
  ChunkingStrategy,
  chunkDocument,
  semanticSearch,
  keywordSearch,
  hybridSearch,
  rerank,
  checkGrounding,
  sampleDocuments,
  sampleQueries,
  freshnessColors,
  getFreshnessStatus,
} from '../lib/rag';

type Tab = 'chunking' | 'search' | 'reranking' | 'grounding';
type SearchMode = 'semantic' | 'keyword' | 'hybrid';

export default function RAGPage() {
  const [activeTab, setActiveTab] = useState<Tab>('chunking');
  const [chunkingStrategy, setChunkingStrategy] = useState<ChunkingStrategy>('semantic');
  const [selectedDoc, setSelectedDoc] = useState<Document>(sampleDocuments[0]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('hybrid');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [rerankedResults, setRerankedResults] = useState<RerankedResult[]>([]);
  const [groundingResult, setGroundingResult] = useState<GroundingResult | null>(null);
  const [sampleAnswer, setSampleAnswer] = useState('');

  // All chunks from all documents
  const allChunks = useMemo(() => {
    return sampleDocuments.flatMap(doc => chunkDocument(doc, chunkingStrategy));
  }, [chunkingStrategy]);

  // Chunk selected document
  const handleChunk = useCallback(() => {
    const result = chunkDocument(selectedDoc, chunkingStrategy);
    setChunks(result);
  }, [selectedDoc, chunkingStrategy]);

  // Search
  const handleSearch = useCallback(() => {
    if (!query.trim()) return;

    let results: SearchResult[];
    switch (searchMode) {
      case 'semantic':
        results = semanticSearch(query, allChunks);
        break;
      case 'keyword':
        results = keywordSearch(query, allChunks);
        break;
      case 'hybrid':
        results = hybridSearch(query, allChunks);
        break;
    }

    setSearchResults(results);
    setRerankedResults([]);
    setGroundingResult(null);
    setSampleAnswer('');
  }, [query, searchMode, allChunks]);

  // Rerank
  const handleRerank = useCallback(() => {
    if (searchResults.length === 0) return;
    const reranked = rerank(query, searchResults);
    setRerankedResults(reranked);
  }, [query, searchResults]);

  // Generate answer and check grounding
  const handleGenerateAnswer = useCallback(() => {
    if (searchResults.length === 0) return;

    const topChunks = (rerankedResults.length > 0 ? rerankedResults : searchResults)
      .slice(0, 3)
      .map(r => r.chunk);

    // Simulate LLM answer based on query
    let answer = '';
    if (query.toLowerCase().includes('install')) {
      answer = 'To install the product, you need to run npm install our-product. Make sure you have Node.js 18 or later installed on your system. After installation, create a configuration file to set up your API key.';
    } else if (query.toLowerCase().includes('rate limit')) {
      answer = 'If you encounter a rate limit error, you should implement exponential backoff in your code. The API has a limit of 100 requests per minute. You can also use batch endpoints or upgrade to a higher tier for increased limits.';
    } else if (query.toLowerCase().includes('pro plan') || query.toLowerCase().includes('cost')) {
      answer = 'The Pro Plan costs $29 per month. It includes 50,000 API requests per month, priority support, advanced analytics, and up to 5 team members. Annual billing is available with a 20% discount.';
    } else if (query.toLowerCase().includes('authenticate') || query.toLowerCase().includes('api key')) {
      answer = 'To authenticate with the API, use the authenticate(apiKey) function with your API key. This returns a session token that you can use for subsequent requests. Make sure your API key is valid and hasn\'t expired.';
    } else if (query.toLowerCase().includes('refund')) {
      answer = 'Refunds are available within 14 days of purchase. To request a refund, contact support@example.com with your order details. The refund will be processed to your original payment method.';
    } else {
      answer = 'Based on the available documentation, I can help you with installation, configuration, API usage, troubleshooting, and pricing information. Please ask a more specific question.';
    }

    setSampleAnswer(answer);
    const grounding = checkGrounding(answer, topChunks);
    setGroundingResult(grounding);
  }, [query, searchResults, rerankedResults]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'chunking', label: 'Chunking' },
    { id: 'search', label: 'Search' },
    { id: 'reranking', label: 'Reranking' },
    { id: 'grounding', label: 'Grounding' },
  ];

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">RAG Systems</h1>
          <p className="text-muted-foreground mt-2">
            Retrieval-Augmented Generation: chunking, search, reranking, and grounding
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'chunking' && (
            <ChunkingTab
              documents={sampleDocuments}
              selectedDoc={selectedDoc}
              onSelectDoc={setSelectedDoc}
              strategy={chunkingStrategy}
              onStrategyChange={setChunkingStrategy}
              chunks={chunks}
              onChunk={handleChunk}
            />
          )}

          {activeTab === 'search' && (
            <SearchTab
              query={query}
              onQueryChange={setQuery}
              searchMode={searchMode}
              onSearchModeChange={setSearchMode}
              results={searchResults}
              onSearch={handleSearch}
              sampleQueries={sampleQueries}
            />
          )}

          {activeTab === 'reranking' && (
            <RerankingTab
              query={query}
              originalResults={searchResults}
              rerankedResults={rerankedResults}
              onRerank={handleRerank}
            />
          )}

          {activeTab === 'grounding' && (
            <GroundingTab
              query={query}
              results={rerankedResults.length > 0 ? rerankedResults : searchResults}
              answer={sampleAnswer}
              grounding={groundingResult}
              onGenerate={handleGenerateAnswer}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function ChunkingTab({
  documents,
  selectedDoc,
  onSelectDoc,
  strategy,
  onStrategyChange,
  chunks,
  onChunk,
}: {
  documents: Document[];
  selectedDoc: Document;
  onSelectDoc: (doc: Document) => void;
  strategy: ChunkingStrategy;
  onStrategyChange: (s: ChunkingStrategy) => void;
  chunks: Chunk[];
  onChunk: () => void;
}) {
  const strategies: { id: ChunkingStrategy; name: string; description: string }[] = [
    { id: 'fixed', name: 'Fixed Size', description: 'Split by character count with overlap' },
    { id: 'semantic', name: 'Semantic', description: 'Split by sections and paragraphs' },
    { id: 'paragraph', name: 'Paragraph', description: 'Split by paragraph boundaries' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Document Selection */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Source Documents</h3>
          <div className="space-y-2">
            {documents.map(doc => {
              const freshness = getFreshnessStatus(doc.metadata.updatedAt);
              return (
                <button
                  key={doc.id}
                  onClick={() => onSelectDoc(doc)}
                  className={`w-full text-left p-3 rounded border transition-colors ${
                    selectedDoc.id === doc.id
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-medium">{doc.title}</span>
                    <Badge className={freshnessColors[freshness]}>{freshness}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{doc.source}</p>
                  <div className="flex gap-1 mt-2">
                    {doc.metadata.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Chunking Strategy */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Chunking Strategy</h3>
          <div className="space-y-2 mb-4">
            {strategies.map(s => (
              <button
                key={s.id}
                onClick={() => onStrategyChange(s.id)}
                className={`w-full text-left p-3 rounded border transition-colors ${
                  strategy === s.id
                    ? 'bg-primary/10 border-primary'
                    : 'hover:bg-muted/50'
                }`}
              >
                <span className="font-medium">{s.name}</span>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </button>
            ))}
          </div>
          <Button onClick={onChunk} className="w-full">
            Chunk Document
          </Button>
        </Card>
      </div>

      {/* Chunks Preview */}
      {chunks.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-4">
            Chunks ({chunks.length} chunks from "{selectedDoc.title}")
          </h3>
          <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
            {chunks.map((chunk, i) => (
              <div key={chunk.id} className="p-3 border rounded bg-muted/30">
                <div className="flex justify-between items-center mb-2">
                  <Badge variant="outline">Chunk {i + 1}</Badge>
                  {chunk.metadata.section && (
                    <span className="text-xs text-muted-foreground">{chunk.metadata.section}</span>
                  )}
                </div>
                <p className="text-sm line-clamp-4">{chunk.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {chunk.content.length} chars | chars {chunk.metadata.startChar}-{chunk.metadata.endChar}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function SearchTab({
  query,
  onQueryChange,
  searchMode,
  onSearchModeChange,
  results,
  onSearch,
  sampleQueries,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  searchMode: SearchMode;
  onSearchModeChange: (m: SearchMode) => void;
  results: SearchResult[];
  onSearch: () => void;
  sampleQueries: string[];
}) {
  const modes: { id: SearchMode; name: string; description: string }[] = [
    { id: 'semantic', name: 'Semantic', description: 'Vector similarity search' },
    { id: 'keyword', name: 'Keyword', description: 'BM25-style text matching' },
    { id: 'hybrid', name: 'Hybrid', description: 'Combined with RRF fusion' },
  ];

  return (
    <div className="space-y-6">
      {/* Search Controls */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Search</h3>

        <div className="flex gap-2 mb-4">
          {modes.map(mode => (
            <button
              key={mode.id}
              onClick={() => onSearchModeChange(mode.id)}
              className={`px-4 py-2 rounded border transition-colors ${
                searchMode === mode.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {mode.name}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          <Input
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Enter your query..."
            onKeyDown={e => e.key === 'Enter' && onSearch()}
            className="flex-1"
          />
          <Button onClick={onSearch}>Search</Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Try:</span>
          {sampleQueries.map(q => (
            <button
              key={q}
              onClick={() => {
                onQueryChange(q);
              }}
              className="text-sm text-primary hover:underline"
            >
              "{q}"
            </button>
          ))}
        </div>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-4">
            Search Results ({results.length} matches)
          </h3>
          <div className="space-y-3">
            {results.map((result, i) => (
              <div key={result.chunk.id} className="p-3 border rounded">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">#{i + 1}</Badge>
                    <span className="font-medium">{result.chunk.metadata.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={result.matchType === 'hybrid' ? 'default' : 'secondary'}>
                      {result.matchType}
                    </Badge>
                    <span className="text-sm font-mono">
                      {result.score.toFixed(4)}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {result.highlighted || result.chunk.content}
                </p>
                {result.chunk.metadata.section && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Section: {result.chunk.metadata.section}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function RerankingTab({
  query,
  originalResults,
  rerankedResults,
  onRerank,
}: {
  query: string;
  originalResults: SearchResult[];
  rerankedResults: RerankedResult[];
  onRerank: () => void;
}) {
  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-semibold">Reranking</h3>
            <p className="text-sm text-muted-foreground">
              Second-stage ranking using cross-encoder relevance scoring
            </p>
          </div>
          <Button onClick={onRerank} disabled={originalResults.length === 0}>
            Rerank Results
          </Button>
        </div>

        {originalResults.length === 0 && (
          <p className="text-muted-foreground">
            Run a search first to get results to rerank.
          </p>
        )}
      </Card>

      {rerankedResults.length > 0 && (
        <div className="grid grid-cols-2 gap-6">
          {/* Original Order */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Original Order</h3>
            <div className="space-y-2">
              {originalResults.slice(0, 5).map((result, i) => (
                <div key={result.chunk.id} className="p-2 border rounded text-sm">
                  <div className="flex justify-between">
                    <span>#{i + 1} {result.chunk.metadata.title}</span>
                    <span className="font-mono text-xs">{result.score.toFixed(4)}</span>
                  </div>
                  <p className="text-muted-foreground text-xs line-clamp-2 mt-1">
                    {result.chunk.content.slice(0, 100)}...
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* Reranked Order */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Reranked Order</h3>
            <div className="space-y-2">
              {rerankedResults.slice(0, 5).map((result, i) => {
                const moved = result.originalRank - i;
                return (
                  <div key={result.chunk.id} className="p-2 border rounded text-sm">
                    <div className="flex justify-between">
                      <div className="flex items-center gap-2">
                        <span>#{i + 1} {result.chunk.metadata.title}</span>
                        {moved !== 0 && (
                          <Badge variant={moved > 0 ? 'success' : 'destructive'} className="text-xs">
                            {moved > 0 ? `+${moved}` : moved}
                          </Badge>
                        )}
                      </div>
                      <span className="font-mono text-xs">{result.rerankedScore.toFixed(4)}</span>
                    </div>
                    <p className="text-muted-foreground text-xs line-clamp-2 mt-1">
                      {result.chunk.content.slice(0, 100)}...
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function GroundingTab({
  query,
  results,
  answer,
  grounding,
  onGenerate,
}: {
  query: string;
  results: SearchResult[];
  answer: string;
  grounding: GroundingResult | null;
  onGenerate: () => void;
}) {
  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-semibold">Groundedness Check</h3>
            <p className="text-sm text-muted-foreground">
              Verify that the answer is supported by source documents
            </p>
          </div>
          <Button onClick={onGenerate} disabled={results.length === 0}>
            Generate & Check
          </Button>
        </div>

        {results.length === 0 && (
          <p className="text-muted-foreground">
            Run a search first to get source documents.
          </p>
        )}
      </Card>

      {answer && (
        <div className="grid grid-cols-2 gap-6">
          {/* Answer */}
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Generated Answer</h3>
              {grounding && (
                <Badge variant={grounding.score >= 0.8 ? 'success' : grounding.score >= 0.5 ? 'secondary' : 'destructive'}>
                  {(grounding.score * 100).toFixed(0)}% grounded
                </Badge>
              )}
            </div>
            <div className="bg-blue-50 p-4 rounded mb-4">
              <p className="text-sm">{answer}</p>
            </div>

            {grounding && grounding.ungroundedClaims.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-red-600 mb-2">Ungrounded Claims</h4>
                <div className="space-y-2">
                  {grounding.ungroundedClaims.map((claim, i) => (
                    <div key={i} className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                      {claim}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Citations */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Citations</h3>
            {grounding && grounding.citations.length > 0 ? (
              <div className="space-y-3">
                {grounding.citations.map((citation, i) => (
                  <div key={i} className="p-3 border rounded">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline">[{i + 1}]</Badge>
                      <span className="text-xs text-muted-foreground">
                        {(citation.confidence * 100).toFixed(0)}% confident
                      </span>
                    </div>
                    <p className="text-sm font-medium mb-1">"{citation.claim}"</p>
                    <p className="text-xs text-muted-foreground">
                      Source: {citation.sourceTitle}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {citation.excerpt}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                {grounding ? 'No citations found' : 'Generate an answer to see citations'}
              </p>
            )}
          </Card>
        </div>
      )}

      {/* Source Documents */}
      {results.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Source Documents Used</h3>
          <div className="grid grid-cols-3 gap-4">
            {results.slice(0, 3).map((result, i) => (
              <div key={result.chunk.id} className="p-3 border rounded bg-muted/30">
                <Badge variant="outline" className="mb-2">[{i + 1}]</Badge>
                <h4 className="font-medium text-sm">{result.chunk.metadata.title}</h4>
                <p className="text-xs text-muted-foreground line-clamp-4 mt-2">
                  {result.chunk.content}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
