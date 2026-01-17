'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { ChatInput } from '@examples/shared/components/chat/chat-input';
import { Message } from '@examples/shared/components/chat/message';
import { useLlama } from '@examples/shared/lib/hooks';
import { ExternalLink, BookOpen, CheckCircle, XCircle, FileText, Info } from 'lucide-react';
import type { AIMessage } from '@examples/shared/types';
import { generateId } from '@examples/shared/lib/utils';

interface Source {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  relevanceScore?: number;
  verified?: boolean;
}

const CITATION_EXAMPLES = [
  'What are the key features of React 19?',
  'Explain the benefits of TypeScript for large projects',
  'How does Next.js App Router differ from Pages Router?',
];

// Simulated knowledge base for demo purposes
const MOCK_SOURCES: Record<string, Source[]> = {
  'react': [
    {
      id: 'src-1',
      title: 'React 19 Release Notes',
      url: 'https://react.dev/blog/2024/12/05/react-19',
      excerpt: 'React 19 introduces the new React Compiler, Server Components, and improved performance...',
      relevanceScore: 0.95,
      verified: true,
    },
    {
      id: 'src-2',
      title: 'React Documentation - Server Components',
      url: 'https://react.dev/reference/rsc/server-components',
      excerpt: 'Server Components allow you to write components that render on the server...',
      relevanceScore: 0.88,
      verified: true,
    },
  ],
  'typescript': [
    {
      id: 'src-3',
      title: 'TypeScript Handbook - Why TypeScript',
      url: 'https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html',
      excerpt: 'TypeScript adds optional types to JavaScript that support tools for large-scale applications...',
      relevanceScore: 0.92,
      verified: true,
    },
    {
      id: 'src-4',
      title: 'TypeScript Best Practices for Enterprise',
      url: 'https://example.com/typescript-enterprise',
      excerpt: 'In large codebases, TypeScript provides type safety, better IDE support, and improved refactoring...',
      relevanceScore: 0.85,
      verified: false,
    },
  ],
  'nextjs': [
    {
      id: 'src-5',
      title: 'Next.js Documentation - App Router',
      url: 'https://nextjs.org/docs/app',
      excerpt: 'The App Router is a new paradigm for building applications using React latest features...',
      relevanceScore: 0.93,
      verified: true,
    },
  ],
};

function getSources(query: string): Source[] {
  const lowerQuery = query.toLowerCase();
  if (lowerQuery.includes('react')) return MOCK_SOURCES.react;
  if (lowerQuery.includes('typescript')) return MOCK_SOURCES.typescript;
  if (lowerQuery.includes('next')) return MOCK_SOURCES.nextjs;
  return [];
}

export default function CitationsPage() {
  const { messages, isLoading, sendMessage, clearMessages } = useLlama();
  const [showRelevanceScores, setShowRelevanceScores] = React.useState(true);
  const [highlightVerified, setHighlightVerified] = React.useState(true);
  const [showMetadata, setShowMetadata] = React.useState(false);
  const [showRawData, setShowRawData] = React.useState(false);

  // Enrich messages with simulated citations
  const enrichedMessages = React.useMemo(() => {
    return messages.map((msg, idx) => {
      if (msg.role === 'assistant' && !msg.metadata?.sources) {
        // Get sources based on previous user message
        const prevUserMsg = messages[idx - 1];
        const sources = prevUserMsg ? getSources(prevUserMsg.content) : [];

        return {
          ...msg,
          metadata: {
            ...msg.metadata,
            sources: sources.length > 0 ? sources : undefined,
          },
        };
      }
      return msg;
    });
  }, [messages]);

  const handleSend = async (message: string) => {
    await sendMessage(message);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Citations & Sources</h1>
        <p className="text-muted-foreground">
          Source attribution and verification for trustworthy AI responses
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          📖 <Link href="https://github.com/yourusername/ai-web-dev-training/blob/main/docs/04-shipping-ai-features/product-patterns-ux.md#citations" className="text-primary hover:underline">Read about citation patterns</Link>
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Link href="/">
          <Button variant="outline">Chat Interface</Button>
        </Link>
        <Link href="/streaming">
          <Button variant="outline">Streaming</Button>
        </Link>
        <Link href="/uncertainty">
          <Button variant="outline">Uncertainty</Button>
        </Link>
        <Link href="/citations">
          <Button variant="default">Citations</Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Info & Controls */}
        <div className="space-y-6">
          {/* Why Citations Matter */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="w-4 h-4 text-primary" />
                Why Citations?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <strong className="text-primary">Verifiability</strong>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Users can verify AI claims against original sources
                </p>
              </div>
              <div>
                <strong className="text-primary">Trust</strong>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Transparency about information sources builds confidence
                </p>
              </div>
              <div>
                <strong className="text-primary">Accountability</strong>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Clear attribution prevents misinformation spread
                </p>
              </div>
              <div>
                <strong className="text-primary">Learning</strong>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Users can explore sources for deeper understanding
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Display Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Display Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRelevanceScores}
                  onChange={(e) => setShowRelevanceScores(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Show relevance scores</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={highlightVerified}
                  onChange={(e) => setHighlightVerified(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Highlight verified sources</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMetadata}
                  onChange={(e) => setShowMetadata(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Show metadata (model, tokens, latency)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRawData}
                  onChange={(e) => setShowRawData(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Show raw HTTP request/response</span>
              </label>
            </CardContent>
          </Card>

          {/* Example Prompts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="w-4 h-4 text-primary" />
                Try These
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {CITATION_EXAMPLES.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  disabled={isLoading}
                  className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {prompt}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Citation Quality */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="w-4 h-4 text-primary" />
                Quality Indicators
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Verified</strong>
                  <p className="text-muted-foreground text-xs">Official or authoritative source</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ExternalLink className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>External</strong>
                  <p className="text-muted-foreground text-xs">Third-party, needs verification</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Unverified</strong>
                  <p className="text-muted-foreground text-xs">Use with caution</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Chat */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chat Interface */}
          <Card className="h-[700px] flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    Citations Demo
                  </CardTitle>
                  <CardDescription>
                    {messages.length === 0
                      ? 'Ask questions to see source citations'
                      : `${messages.length} message${messages.length !== 1 ? 's' : ''}`}
                  </CardDescription>
                </div>
                {messages.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearMessages}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                {messages.length === 0 && (
                  <div className="h-full flex items-center justify-center text-center">
                    <div className="space-y-2">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                        <BookOpen className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">Test Citation Patterns</h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        Try the example questions to see how sources are attributed and displayed.
                      </p>
                    </div>
                  </div>
                )}
                {enrichedMessages.map((message) => (
                  <div key={message.id} className="space-y-3">
                    <Message
                      message={message}
                      showMetadata={showMetadata}
                      showRawData={showRawData}
                    />

                    {/* Sources */}
                    {message.role === 'assistant' && message.metadata?.sources && (
                      <div className="ml-4 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
                          <BookOpen className="w-3 h-3" />
                          Sources ({message.metadata.sources.length})
                        </p>
                        {(message.metadata.sources as Source[]).map((source) => (
                          <div
                            key={source.id}
                            className={`p-3 rounded-lg border ${
                              highlightVerified && source.verified
                                ? 'border-green-300 bg-green-50/50'
                                : 'border-border bg-background'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                                  >
                                    {source.title}
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {source.excerpt}
                                </p>
                              </div>
                              <div className="flex flex-col gap-1 items-end">
                                {source.verified && highlightVerified && (
                                  <Badge variant="success" className="text-xs flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    Verified
                                  </Badge>
                                )}
                                {showRelevanceScores && source.relevanceScore && (
                                  <Badge variant="secondary" className="text-xs">
                                    {Math.round(source.relevanceScore * 100)}% relevant
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary truncate block"
                            >
                              {source.url}
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/30 max-w-[90%]">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase">assistant</span>
                      </div>
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <ChatInput
                onSend={handleSend}
                disabled={isLoading}
                placeholder="Ask a question to see citations..."
              />
            </CardContent>
          </Card>

          {/* Implementation Approaches */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Citation Strategies</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">RAG-Based</h4>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>• Retrieve relevant documents first</li>
                  <li>• Include sources in context</li>
                  <li>• LLM references sources in response</li>
                  <li>• Return both answer and source metadata</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Post-Processing</h4>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>• Generate response first</li>
                  <li>• Extract claims from response</li>
                  <li>• Match claims to knowledge base</li>
                  <li>• Add citations retroactively</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Best Practices */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Citation Best Practices</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge variant="success" className="text-xs">DO</Badge>
                  Good Practices
                </h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Always cite sources for factual claims</li>
                  <li>• Link to original, authoritative sources</li>
                  <li>• Show relevance scores when available</li>
                  <li>• Indicate verified vs unverified</li>
                  <li>• Make citations clickable</li>
                  <li>• Include source excerpts</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">DON'T</Badge>
                  Anti-Patterns
                </h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Fabricate or hallucinate sources</li>
                  <li>• Use dead or broken links</li>
                  <li>• Cite sources without verification</li>
                  <li>• Hide citations in footnotes only</li>
                  <li>• Cite irrelevant or misleading sources</li>
                  <li>• Skip attribution for opinions</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
