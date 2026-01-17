'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { Textarea } from '@examples/shared/components/ui/textarea';
import { ChatInput } from '@examples/shared/components/chat/chat-input';
import { Message } from '@examples/shared/components/chat/message';
import { useLlama } from '@examples/shared/lib/hooks';
import { generateId } from '@examples/shared/lib/utils';
import { Brain, ArrowLeft, Lightbulb, RefreshCw, Layers } from 'lucide-react';
import type { AIMessage } from '@examples/shared/types';

type MemoryStrategy = 'full' | 'sliding_window' | 'summary' | 'hybrid';

const MEMORY_STRATEGIES: Record<MemoryStrategy, {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
}> = {
  full: {
    name: 'Full History',
    description: 'Send entire conversation history with each request',
    pros: ['Perfect recall', 'No information loss', 'Simple to implement'],
    cons: ['Context limit issues', 'Increasing costs', 'Slower responses'],
  },
  sliding_window: {
    name: 'Sliding Window',
    description: 'Keep only the last N messages',
    pros: ['Bounded context', 'Predictable costs', 'Fast responses'],
    cons: ['Loses early context', 'May miss important info', 'Arbitrary cutoff'],
  },
  summary: {
    name: 'Summary-Based',
    description: 'Periodically summarize and compress history',
    pros: ['Efficient context use', 'Retains key info', 'Scalable'],
    cons: ['Information loss', 'Extra API calls', 'Summary quality varies'],
  },
  hybrid: {
    name: 'Hybrid',
    description: 'Combine recent messages with summary of older ones',
    pros: ['Best of both worlds', 'Good context retention', 'Balanced costs'],
    cons: ['Complex implementation', 'Tuning required', 'Extra processing'],
  },
};

export default function MemoryPatternsPage() {
  const [messages, setMessages] = React.useState<AIMessage[]>([]);
  const [strategy, setStrategy] = React.useState<MemoryStrategy>('full');
  const [windowSize, setWindowSize] = React.useState(10);
  const [summary, setSummary] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [showMetadata, setShowMetadata] = React.useState(true);
  const [showRawData, setShowRawData] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getContextMessages = (): AIMessage[] => {
    switch (strategy) {
      case 'full':
        return messages;

      case 'sliding_window':
        return messages.slice(-windowSize);

      case 'summary':
        if (summary) {
          return [
            {
              id: generateId('summary'),
              role: 'system',
              content: `Previous conversation summary: ${summary}`,
              timestamp: new Date(),
            },
            ...messages.slice(-3), // Keep last 3 messages for continuity
          ];
        }
        return messages.slice(-5);

      case 'hybrid':
        if (summary && messages.length > windowSize) {
          return [
            {
              id: generateId('summary'),
              role: 'system',
              content: `Previous conversation summary: ${summary}`,
              timestamp: new Date(),
            },
            ...messages.slice(-windowSize),
          ];
        }
        return messages.slice(-windowSize);

      default:
        return messages;
    }
  };

  const handleSend = async (content: string) => {
    const userMessage: AIMessage = {
      id: generateId('msg'),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const contextMessages = getContextMessages();
      const allMessages = [...contextMessages, userMessage];

      const response = await fetch('http://127.0.0.1:8033/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-oss-20b',
          messages: [
            { role: 'system', content: 'You are a helpful AI assistant. Be conversational and remember our discussion.' },
            ...allMessages.map(m => ({ role: m.role, content: m.content })),
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

      const data = await response.json();
      const assistantContent = data.choices?.[0]?.message?.content || 'No response';

      const assistantMessage: AIMessage = {
        id: generateId('msg'),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        metadata: {
          model: 'gpt-oss-20b',
          latencyMs: Date.now() - userMessage.timestamp.getTime(),
          tokenCount: data.usage ? {
            input: data.usage.prompt_tokens,
            output: data.usage.completion_tokens,
            total: data.usage.total_tokens,
          } : undefined,
          contextMessages: allMessages.length,
          memoryStrategy: strategy,
        },
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: AIMessage = {
        id: generateId('msg'),
        role: 'assistant',
        content: 'Error connecting to the AI. Please check llama-server.',
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSummary = async () => {
    if (messages.length < 4) return;

    setIsLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8033/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-oss-20b',
          messages: [
            {
              role: 'system',
              content: 'Summarize this conversation in 2-3 sentences, capturing the key topics and any important information exchanged.',
            },
            {
              role: 'user',
              content: messages.map(m => `${m.role}: ${m.content}`).join('\n'),
            },
          ],
          temperature: 0.3,
        }),
      });

      const data = await response.json();
      const summaryText = data.choices?.[0]?.message?.content || '';
      setSummary(summaryText);
    } catch (error) {
      console.error('Failed to generate summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const strategyInfo = MEMORY_STRATEGIES[strategy];

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="mb-4 inline-block">
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Conversations
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-2">Memory Patterns</h1>
        <p className="text-muted-foreground">
          Explore different strategies for managing conversation context and memory
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Link href="/">
          <Button variant="outline">Conversations</Button>
        </Link>
        <Link href="/memory">
          <Button variant="default">Memory Patterns</Button>
        </Link>
        <Link href="/context">
          <Button variant="outline">Context Window</Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Strategy Selection */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                Memory Strategy
              </CardTitle>
              <CardDescription>Select how context is managed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(Object.keys(MEMORY_STRATEGIES) as MemoryStrategy[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setStrategy(key)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    strategy === key
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{MEMORY_STRATEGIES[key].name}</span>
                    {strategy === key && (
                      <Badge variant="default" className="text-xs">Active</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {MEMORY_STRATEGIES[key].description}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Strategy Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                {strategyInfo.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="text-xs font-medium text-green-600 mb-1">Advantages</h4>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {strategyInfo.pros.map((pro, i) => (
                    <li key={i}>+ {pro}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-medium text-red-600 mb-1">Drawbacks</h4>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {strategyInfo.cons.map((con, i) => (
                    <li key={i}>- {con}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          {(strategy === 'sliding_window' || strategy === 'hybrid') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Window Size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="3"
                    max="20"
                    value={windowSize}
                    onChange={(e) => setWindowSize(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-8">{windowSize}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Keep last {windowSize} messages in context
                </p>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {(strategy === 'summary' || strategy === 'hybrid') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>Conversation Summary</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={generateSummary}
                    disabled={isLoading || messages.length < 4}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Generate
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary ? (
                  <p className="text-sm text-muted-foreground">{summary}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No summary yet. Have a conversation and click Generate.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Display Options */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Display Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMetadata}
                  onChange={(e) => setShowMetadata(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Show metadata</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRawData}
                  onChange={(e) => setShowRawData(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Show raw HTTP</span>
              </label>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Chat */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-primary" />
                    Memory Test
                  </CardTitle>
                  <CardDescription>
                    {messages.length} messages • {strategy} strategy
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setMessages([])}>
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <div className="space-y-2">
                      <Brain className="w-12 h-12 text-primary mx-auto opacity-50" />
                      <h3 className="font-semibold">Test Memory Patterns</h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        Have a conversation to see how different memory strategies affect context retention.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <Message
                        key={message.id}
                        message={message}
                        showMetadata={showMetadata}
                        showRawData={showRawData}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
              <ChatInput
                onSend={handleSend}
                disabled={isLoading}
                placeholder="Test memory retention..."
              />
            </CardContent>
          </Card>

          {/* Context Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Current Context</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {messages.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Messages</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {getContextMessages().length}
                  </div>
                  <div className="text-xs text-muted-foreground">In Context</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {messages.length - getContextMessages().length}
                  </div>
                  <div className="text-xs text-muted-foreground">Excluded</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
