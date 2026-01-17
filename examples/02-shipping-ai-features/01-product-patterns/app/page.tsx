'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { ChatThread } from '@examples/shared/components/chat/chat-thread';
import { ChatInput } from '@examples/shared/components/chat/chat-input';
import { useLlama } from '@examples/shared/lib/hooks';
import { Sparkles, MessageSquare, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import type { AIMessage } from '@examples/shared/types';
import { generateId } from '@examples/shared/lib/utils';

const EXAMPLE_PROMPTS = [
  "Explain quantum computing in simple terms",
  "Write a haiku about coding",
  "What are the benefits of TypeScript?",
  "How does async/await work in JavaScript?",
];

export default function ProductPatternsPage() {
  const { messages, isLoading, sendMessage, clearMessages } = useLlama();
  const [showMetadata, setShowMetadata] = React.useState(true);
  const [showRawData, setShowRawData] = React.useState(false);

  const handleSend = async (message: string) => {
    await sendMessage(message);
  };

  // Simulate adding confidence and sources (in production, LLM would provide these)
  const enrichedMessages = React.useMemo(() => {
    return messages.map((msg) => {
      if (msg.role === 'assistant' && !msg.metadata?.confidence) {
        // Simulate confidence based on response length (demo purposes)
        const confidence: 'high' | 'medium' | 'low' = msg.content.length > 200 ? 'high'
          : msg.content.length > 100 ? 'medium'
          : 'low';

        // Simulate sources for longer responses
        const sources = msg.content.length > 150 ? [
          {
            id: generateId('source'),
            title: 'Documentation Reference',
            url: 'https://example.com/docs',
            excerpt: 'Relevant excerpt from the source...',
          },
        ] : undefined;

        return {
          ...msg,
          metadata: {
            ...msg.metadata,
            confidence,
            sources,
          },
        } as AIMessage;
      }
      return msg;
    });
  }, [messages]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Product Patterns & UX</h1>
        <p className="text-muted-foreground">
          Production-ready chat interface with streaming, confidence indicators, and citations
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          📖 <Link href="https://github.com/yourusername/ai-web-dev-training/blob/main/docs/04-shipping-ai-features/product-patterns-ux.md" className="text-primary hover:underline">Read the documentation</Link>
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Link href="/">
          <Button variant="default">Chat Interface</Button>
        </Link>
        <Link href="/streaming">
          <Button variant="outline">Streaming</Button>
        </Link>
        <Link href="/uncertainty">
          <Button variant="outline">Uncertainty</Button>
        </Link>
        <Link href="/citations">
          <Button variant="outline">Citations</Button>
        </Link>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Info */}
        <div className="space-y-6">
          {/* Quick Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="w-4 h-4 text-primary" />
                Key Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Streaming Responses</strong>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Real-time token-by-token display
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Confidence Indicators</strong>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Visual confidence levels (high/medium/low)
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Source Citations</strong>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Clickable references to source documents
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Error Handling</strong>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Graceful failure states with recovery
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Example Prompts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="w-4 h-4 text-primary" />
                Try These
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {EXAMPLE_PROMPTS.map((prompt, idx) => (
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

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Display Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
        </div>

        {/* Right Column - Chat */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chat Interface */}
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    AI Assistant
                  </CardTitle>
                  <CardDescription>
                    {messages.length === 0
                      ? 'Start a conversation or try an example prompt'
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
              <div className="flex-1 overflow-hidden mb-4">
                <ChatThread
                  messages={enrichedMessages}
                  isLoading={isLoading}
                  showMetadata={showMetadata}
                  showRawData={showRawData}
                  className="h-full"
                />
              </div>
              <ChatInput
                onSend={handleSend}
                disabled={isLoading}
                placeholder="Ask me anything..."
              />
            </CardContent>
          </Card>

          {/* UX Patterns Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">UX Best Practices</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge variant="success" className="text-xs">DO</Badge>
                  Good Patterns
                </h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Stream responses for perceived speed</li>
                  <li>• Show confidence when uncertain</li>
                  <li>• Provide sources for verification</li>
                  <li>• Handle errors gracefully</li>
                  <li>• Allow message regeneration</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">DON'T</Badge>
                  Anti-Patterns
                </h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Hide AI uncertainty</li>
                  <li>• Make up sources</li>
                  <li>• Show raw errors to users</li>
                  <li>• Block UI during generation</li>
                  <li>• Ignore edge cases</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
