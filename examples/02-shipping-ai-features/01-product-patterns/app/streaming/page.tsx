'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { ChatInput } from '@examples/shared/components/chat/chat-input';
import { Message } from '@examples/shared/components/chat/message';
import { useLlama } from '@examples/shared/lib/hooks';
import { Play, Pause, RotateCcw, Zap, Info } from 'lucide-react';
import type { AIMessage } from '@examples/shared/types';

const STREAMING_EXAMPLES = [
  'Explain how React Server Components work',
  'Write a short story about a robot learning to paint',
  'Describe the benefits of TypeScript in detail',
];

export default function StreamingPage() {
  const { messages, isLoading, sendMessage, sendMessageStreaming, clearMessages } = useLlama();
  const [useStreaming, setUseStreaming] = React.useState(true);
  const [showTokens, setShowTokens] = React.useState(false);
  const [showMetadata, setShowMetadata] = React.useState(false);
  const [showRawData, setShowRawData] = React.useState(false);

  const handleSend = async (message: string) => {
    if (useStreaming) {
      await sendMessageStreaming(message);
    } else {
      await sendMessage(message);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Streaming Responses</h1>
        <p className="text-muted-foreground">
          Real-time token-by-token display for better perceived performance
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          📖 <Link href="https://github.com/yourusername/ai-web-dev-training/blob/main/docs/04-shipping-ai-features/product-patterns-ux.md#streaming-responses" className="text-primary hover:underline">Read about streaming patterns</Link>
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Link href="/">
          <Button variant="outline">Chat Interface</Button>
        </Link>
        <Link href="/streaming">
          <Button variant="default">Streaming</Button>
        </Link>
        <Link href="/uncertainty">
          <Button variant="outline">Uncertainty</Button>
        </Link>
        <Link href="/citations">
          <Button variant="outline">Citations</Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Info & Controls */}
        <div className="space-y-6">
          {/* Streaming Benefits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="w-4 h-4 text-primary" />
                Why Stream?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <strong className="text-primary">Faster Perceived Response</strong>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Users see results immediately, not after full generation
                </p>
              </div>
              <div>
                <strong className="text-primary">Better UX</strong>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Progressive disclosure keeps users engaged
                </p>
              </div>
              <div>
                <strong className="text-primary">Cancellable</strong>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Users can stop generation if they see irrelevant content
                </p>
              </div>
              <div>
                <strong className="text-primary">Lower Latency</strong>
                <p className="text-muted-foreground text-xs mt-0.5">
                  First token arrives in ~100-500ms vs waiting for full response
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Streaming Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Streaming Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Mode</label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={useStreaming ? 'default' : 'outline'}
                    onClick={() => setUseStreaming(true)}
                    disabled={isLoading}
                  >
                    <Zap className="w-4 h-4 mr-1" />
                    Streaming
                  </Button>
                  <Button
                    size="sm"
                    variant={!useStreaming ? 'default' : 'outline'}
                    onClick={() => setUseStreaming(false)}
                    disabled={isLoading}
                  >
                    <Pause className="w-4 h-4 mr-1" />
                    Non-Streaming
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {useStreaming
                    ? 'Tokens appear in real-time as generated'
                    : 'Wait for complete response before display'}
                </p>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTokens}
                    onChange={(e) => setShowTokens(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Show token boundaries</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Example Prompts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Play className="w-4 h-4 text-primary" />
                Try These
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {STREAMING_EXAMPLES.map((prompt, idx) => (
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

          {/* Technical Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="w-4 h-4 text-primary" />
                Implementation
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p><strong>Protocol:</strong> Server-Sent Events (SSE)</p>
              <p><strong>Format:</strong> Text or JSON chunks</p>
              <p><strong>Buffering:</strong> Token-by-token or word-by-word</p>
              <p><strong>Backpressure:</strong> Handled by browser</p>
            </CardContent>
          </Card>

          {/* Display Options */}
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
          {/* Streaming Demo */}
          <Card className="h-[700px] flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    Streaming Demo
                  </CardTitle>
                  <CardDescription>
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Streaming response...
                      </span>
                    ) : (
                      `${messages.length} message${messages.length !== 1 ? 's' : ''}`
                    )}
                  </CardDescription>
                </div>
                {messages.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearMessages}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
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
                        <Zap className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">Start a Conversation</h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        Send a message to see streaming in action. Responses appear token-by-token in real-time.
                      </p>
                    </div>
                  </div>
                )}
                {messages.map((message) => (
                  <Message
                    key={message.id}
                    message={message}
                    showMetadata={showMetadata}
                    showRawData={showRawData}
                  />
                ))}
                {isLoading && (
                  <div className="flex gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/30 max-w-[80%]">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase">assistant</span>
                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
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
                placeholder="Ask me anything to see streaming in action..."
              />
            </CardContent>
          </Card>

          {/* Best Practices */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Streaming Best Practices</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge variant="success" className="text-xs">DO</Badge>
                  Good Practices
                </h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Stream token-by-token or word-by-word</li>
                  <li>• Show streaming indicator while generating</li>
                  <li>• Allow users to stop generation</li>
                  <li>• Handle connection errors gracefully</li>
                  <li>• Buffer appropriately (50-100ms chunks)</li>
                  <li>• Show "thinking" state before first token</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">DON'T</Badge>
                  Anti-Patterns
                </h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Stream too fast (hard to read)</li>
                  <li>• Block UI during streaming</li>
                  <li>• Ignore reconnection logic</li>
                  <li>• Show full response at once</li>
                  <li>• Forget to handle incomplete JSON</li>
                  <li>• Skip error boundaries</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
