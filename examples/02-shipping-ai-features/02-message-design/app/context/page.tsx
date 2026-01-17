'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { Textarea } from '@examples/shared/components/ui/textarea';
import { ArrowLeft, Ruler, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { estimateTokens } from '@examples/shared/lib/utils';

const CONTEXT_LIMITS: Record<string, number> = {
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'llama-3-70b': 8192,
  'llama-3-8b': 8192,
  'mistral-large': 32000,
  'gemini-1.5-pro': 1000000,
  'local-llama': 4096,
};

const EXAMPLE_TEXTS = {
  short: `Hello! How can I help you today?`,
  medium: `I'm working on a web application that uses AI to help users write better content.
The main features include:
1. Grammar and spelling correction
2. Tone adjustment (formal, casual, professional)
3. Content summarization
4. Translation to multiple languages

I need help optimizing the API calls to reduce latency while maintaining quality.`,
  long: `# Project Requirements Document

## Executive Summary
This document outlines the requirements for building an AI-powered content management system that will help organizations manage, create, and distribute content more efficiently.

## Background
Our organization has been struggling with content creation bottlenecks. The current process involves:
- Manual content creation by a small team
- Multiple review cycles
- Inconsistent quality across different authors
- Slow time-to-publish

## Proposed Solution
We propose implementing an AI-assisted content management system with the following capabilities:

### 1. Content Generation
- AI-powered draft generation based on outlines
- Multiple style options (formal, casual, technical)
- Brand voice consistency checking
- SEO optimization suggestions

### 2. Content Enhancement
- Grammar and style improvements
- Readability scoring and suggestions
- Fact-checking integration
- Citation management

### 3. Workflow Automation
- Automated routing based on content type
- AI-powered review suggestions
- Version comparison and tracking
- Publishing workflow integration

## Technical Requirements
- RESTful API architecture
- Support for real-time collaboration
- Integration with existing CMS platforms
- Comprehensive audit logging
- Role-based access control

## Success Metrics
- 50% reduction in content creation time
- 30% improvement in content quality scores
- 90% user satisfaction rating
- 99.9% system availability`,
};

export default function ContextWindowPage() {
  const [text, setText] = React.useState(EXAMPLE_TEXTS.medium);
  const [systemPrompt, setSystemPrompt] = React.useState('You are a helpful AI assistant.');
  const [selectedModel, setSelectedModel] = React.useState('local-llama');
  const [conversationHistory, setConversationHistory] = React.useState<string[]>([]);

  const systemTokens = estimateTokens(systemPrompt);
  const textTokens = estimateTokens(text);
  const historyTokens = conversationHistory.reduce((sum, msg) => sum + estimateTokens(msg), 0);
  const totalTokens = systemTokens + textTokens + historyTokens;
  const contextLimit = CONTEXT_LIMITS[selectedModel];
  const usagePercent = Math.min((totalTokens / contextLimit) * 100, 100);
  const remainingTokens = Math.max(contextLimit - totalTokens, 0);

  const getStatusColor = () => {
    if (usagePercent < 50) return 'bg-green-500';
    if (usagePercent < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (usagePercent < 50) return 'Plenty of room';
    if (usagePercent < 80) return 'Getting full';
    if (usagePercent < 100) return 'Nearly full';
    return 'Exceeds limit!';
  };

  const addToHistory = () => {
    if (text.trim()) {
      setConversationHistory(prev => [...prev, text]);
      setText('');
    }
  };

  const clearHistory = () => {
    setConversationHistory([]);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="mb-4 inline-block">
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Conversations
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-2">Context Window</h1>
        <p className="text-muted-foreground">
          Understand and visualize LLM context window limits
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Link href="/">
          <Button variant="outline">Conversations</Button>
        </Link>
        <Link href="/memory">
          <Button variant="outline">Memory Patterns</Button>
        </Link>
        <Link href="/context">
          <Button variant="default">Context Window</Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Context Visualization */}
        <div className="lg:col-span-2 space-y-6">
          {/* Usage Bar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ruler className="w-5 h-5 text-primary" />
                Context Usage
              </CardTitle>
              <CardDescription>
                {selectedModel}: {contextLimit.toLocaleString()} tokens
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {totalTokens.toLocaleString()} / {contextLimit.toLocaleString()} tokens
                  </span>
                  <Badge variant={usagePercent > 80 ? 'destructive' : 'secondary'}>
                    {usagePercent.toFixed(1)}%
                  </Badge>
                </div>
                <div className="h-4 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${getStatusColor()}`}
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {usagePercent >= 100 ? (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                  <span>{getStatusText()}</span>
                  <span className="text-muted-foreground">
                    ({remainingTokens.toLocaleString()} tokens remaining)
                  </span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-500">{systemTokens}</div>
                  <div className="text-xs text-muted-foreground">System Prompt</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">{historyTokens}</div>
                  <div className="text-xs text-muted-foreground">History ({conversationHistory.length} msgs)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-500">{textTokens}</div>
                  <div className="text-xs text-muted-foreground">Current Input</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Input Areas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">System Prompt</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a helpful AI assistant..."
                className="min-h-[80px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2">
                ~{systemTokens} tokens
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Current Input</CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setText(EXAMPLE_TEXTS.short)}
                  >
                    Short
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setText(EXAMPLE_TEXTS.medium)}
                  >
                    Medium
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setText(EXAMPLE_TEXTS.long)}
                  >
                    Long
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text to analyze..."
                className="min-h-[200px] font-mono text-sm"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  ~{textTokens} tokens • {text.length} characters • ~{text.split(/\s+/).filter(Boolean).length} words
                </p>
                <Button size="sm" onClick={addToHistory} disabled={!text.trim()}>
                  Add to History
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Conversation History */}
          {conversationHistory.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    Simulated History ({conversationHistory.length} messages)
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={clearHistory}>
                    Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[200px] overflow-y-auto">
                {conversationHistory.map((msg, idx) => (
                  <div key={idx} className="p-2 rounded bg-muted text-sm">
                    <div className="text-xs text-muted-foreground mb-1">
                      Message {idx + 1} (~{estimateTokens(msg)} tokens)
                    </div>
                    <div className="truncate">{msg}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Model Selection & Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Select Model</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(CONTEXT_LIMITS).map(([model, limit]) => (
                <button
                  key={model}
                  onClick={() => setSelectedModel(model)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedModel === model
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{model}</span>
                    <Badge variant="secondary" className="text-xs">
                      {limit >= 1000000
                        ? `${(limit / 1000000).toFixed(0)}M`
                        : limit >= 1000
                        ? `${(limit / 1000).toFixed(0)}K`
                        : limit}
                    </Badge>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Context Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Info className="w-4 h-4 text-primary" />
                Context Window Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <div>
                <strong className="text-foreground">What is context?</strong>
                <p>The total text (system prompt + history + input) the model "sees" at once.</p>
              </div>
              <div>
                <strong className="text-foreground">Token estimation</strong>
                <p>~4 characters per token for English. Code and special characters vary.</p>
              </div>
              <div>
                <strong className="text-foreground">Reserve space</strong>
                <p>Leave room for the response! Output tokens count against limits.</p>
              </div>
              <div>
                <strong className="text-foreground">Quality vs quantity</strong>
                <p>More context isn't always better. Key info can get lost in long contexts.</p>
              </div>
            </CardContent>
          </Card>

          {/* Warning Zone */}
          <Card className={usagePercent > 80 ? 'border-red-300 bg-red-50/50' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className={`w-4 h-4 ${usagePercent > 80 ? 'text-red-500' : 'text-yellow-500'}`} />
                Context Overflow
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>When context exceeds the limit:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>API returns an error</li>
                <li>Truncation may occur</li>
                <li>Quality degrades</li>
                <li>Costs increase unnecessarily</li>
              </ul>
              <div className="pt-2 border-t">
                <strong className="text-foreground">Solutions:</strong>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>Use sliding window</li>
                  <li>Summarize history</li>
                  <li>Chunk long inputs</li>
                  <li>Use larger context models</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
