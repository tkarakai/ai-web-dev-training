'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Textarea } from '@examples/shared/components/ui/textarea';
import { Badge } from '@examples/shared/components/ui/badge';
import { estimateTokensAccurate, formatTokenCount } from '@examples/shared/lib/utils';
import { ArrowLeft, Plus, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';

const CONTEXT_WINDOWS = {
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'claude-3-5-sonnet': 200000,
  'claude-3-5-haiku': 200000,
  'gemini-1.5-pro': 2000000,
  'llama-3-8b': 8192,
  'gpt-oss-20b': 8192,
};

type Message = {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  tokens: number;
};

export default function ContextWindowPage() {
  const [selectedModel, setSelectedModel] = React.useState<keyof typeof CONTEXT_WINDOWS>('gpt-4o-mini');
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: 'You are a helpful assistant.',
      tokens: estimateTokensAccurate('You are a helpful assistant.'),
    },
  ]);
  const [newMessageContent, setNewMessageContent] = React.useState('');
  const [newMessageRole, setNewMessageRole] = React.useState<'user' | 'assistant'>('user');

  const contextWindow = CONTEXT_WINDOWS[selectedModel];
  const totalTokens = messages.reduce((sum, msg) => sum + msg.tokens, 0);
  const percentageUsed = (totalTokens / contextWindow) * 100;
  const isNearLimit = percentageUsed > 80;
  const isAtLimit = percentageUsed > 95;

  const addMessage = () => {
    if (!newMessageContent.trim()) return;

    const tokens = estimateTokensAccurate(newMessageContent);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: newMessageRole,
        content: newMessageContent,
        tokens,
      },
    ]);
    setNewMessageContent('');
  };

  const removeMessage = (id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  };

  const fillContext = (percentage: number) => {
    const targetTokens = Math.floor(contextWindow * (percentage / 100));
    const currentTokens = totalTokens;
    const tokensNeeded = targetTokens - currentTokens;

    if (tokensNeeded <= 0) return;

    // Generate filler text (roughly 4 chars per token)
    const fillerText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(
      Math.ceil((tokensNeeded * 4) / 56)
    );
    const tokens = estimateTokensAccurate(fillerText);

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'user',
        content: fillerText.substring(0, tokensNeeded * 4),
        tokens,
      },
    ]);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="mb-4 inline-block">
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Token Visualizer
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-2">Context Window Simulator</h1>
        <p className="text-muted-foreground">
          Visualize context window limits and understand how messages consume available tokens
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Controls */}
        <div className="space-y-6">
          {/* Model Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Select Model</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as keyof typeof CONTEXT_WINDOWS)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
              >
                {Object.entries(CONTEXT_WINDOWS).map(([model, tokens]) => (
                  <option key={model} value={model}>
                    {model} ({formatTokenCount(tokens)} tokens)
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          {/* Context Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Context Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Used:</span>
                  <span className="font-medium">{formatTokenCount(totalTokens)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Available:</span>
                  <span className="font-medium">{formatTokenCount(contextWindow)}</span>
                </div>
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-muted-foreground">Percentage:</span>
                  <span className={`font-medium ${isAtLimit ? 'text-red-500' : isNearLimit ? 'text-yellow-500' : 'text-green-500'}`}>
                    {percentageUsed.toFixed(1)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                  />
                </div>
              </div>

              {isAtLimit && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-sm text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Context window nearly full! Remove messages or switch to a larger model.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Fill</CardTitle>
              <CardDescription className="text-xs">Test context limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button size="sm" variant="outline" className="w-full" onClick={() => fillContext(50)}>
                Fill to 50%
              </Button>
              <Button size="sm" variant="outline" className="w-full" onClick={() => fillContext(80)}>
                Fill to 80%
              </Button>
              <Button size="sm" variant="outline" className="w-full" onClick={() => fillContext(95)}>
                Fill to 95%
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="w-full"
                onClick={() => setMessages(messages.slice(0, 1))}
                disabled={messages.length === 1}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear All (Keep System)
              </Button>
            </CardContent>
          </Card>

          {/* Key Concepts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Key Concepts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <div>
                <strong className="text-foreground">Context Window:</strong> The maximum number of tokens (input + output) a model can process in a single request.
              </div>
              <div>
                <strong className="text-foreground">Token Limits:</strong> Different models have different context windows. Larger windows cost more to run.
              </div>
              <div>
                <strong className="text-foreground">Lost in the Middle:</strong> Models pay less attention to information in the middle of long contexts. Important info should be at the start or end.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Messages */}
        <div className="lg:col-span-2 space-y-6">
          {/* Add Message */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={newMessageRole === 'user' ? 'default' : 'outline'}
                  onClick={() => setNewMessageRole('user')}
                >
                  User
                </Button>
                <Button
                  size="sm"
                  variant={newMessageRole === 'assistant' ? 'default' : 'outline'}
                  onClick={() => setNewMessageRole('assistant')}
                >
                  Assistant
                </Button>
              </div>
              <Textarea
                value={newMessageContent}
                onChange={(e) => setNewMessageContent(e.target.value)}
                placeholder="Enter message content..."
                className="min-h-[100px] text-sm"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  ~{formatTokenCount(estimateTokensAccurate(newMessageContent))} tokens
                </span>
                <Button size="sm" onClick={addMessage} disabled={!newMessageContent.trim()}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Message
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Message List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Conversation ({messages.length} messages)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`p-3 rounded-lg border ${
                      message.role === 'system'
                        ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30'
                        : message.role === 'user'
                        ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/30'
                        : 'border-slate-300 bg-slate-50 dark:bg-slate-900/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {message.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTokenCount(message.tokens)} tokens
                        </span>
                        {index === 0 && (
                          <Badge variant="outline" className="text-xs">First</Badge>
                        )}
                        {index === messages.length - 1 && index > 0 && (
                          <Badge variant="outline" className="text-xs">Last</Badge>
                        )}
                        {index > 0 && index < messages.length - 1 && messages.length > 5 && (
                          <Badge variant="warning" className="text-xs">Middle - Less Attention</Badge>
                        )}
                      </div>
                      {message.role !== 'system' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeMessage(message.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words line-clamp-3">
                      {message.content}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
