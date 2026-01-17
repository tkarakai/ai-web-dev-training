'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { ChatInput } from '@examples/shared/components/chat/chat-input';
import { Message } from '@examples/shared/components/chat/message';
import { useLlama } from '@examples/shared/lib/hooks';
import { AlertTriangle, CheckCircle2, HelpCircle, TrendingUp, Info } from 'lucide-react';
import type { AIMessage } from '@examples/shared/types';

type ConfidenceLevel = 'high' | 'medium' | 'low';

const UNCERTAINTY_EXAMPLES = [
  {
    prompt: 'What is the capital of France?',
    expectedConfidence: 'high',
    description: 'Factual, verifiable question - should have high confidence'
  },
  {
    prompt: 'What might be the best programming language for beginners?',
    expectedConfidence: 'medium',
    description: 'Subjective question - should have medium confidence'
  },
  {
    prompt: 'What will be the most popular framework in 2030?',
    expectedConfidence: 'low',
    description: 'Future prediction - should have low confidence'
  },
];

function getConfidenceIcon(confidence?: ConfidenceLevel) {
  switch (confidence) {
    case 'high':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'medium':
      return <HelpCircle className="w-4 h-4 text-yellow-500" />;
    case 'low':
      return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    default:
      return null;
  }
}

function getConfidenceColor(confidence?: ConfidenceLevel) {
  switch (confidence) {
    case 'high':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'low':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

export default function UncertaintyPage() {
  const { messages, isLoading, sendMessage, clearMessages } = useLlama();
  const [showConfidenceExplanation, setShowConfidenceExplanation] = React.useState(true);
  const [showMetadata, setShowMetadata] = React.useState(false);
  const [showRawData, setShowRawData] = React.useState(false);

  // Simulate confidence scoring (in production, LLM would provide this)
  const enrichedMessages = React.useMemo(() => {
    return messages.map((msg) => {
      if (msg.role === 'assistant' && !msg.metadata?.confidence) {
        // Simulate confidence based on response characteristics
        const hasHedging = /maybe|perhaps|might|possibly|likely|probably/i.test(msg.content);
        const hasQualifiers = /it depends|generally|typically|usually|often/i.test(msg.content);
        const length = msg.content.length;

        let confidence: ConfidenceLevel;
        if (hasHedging || hasQualifiers) {
          confidence = length > 200 ? 'medium' : 'low';
        } else {
          confidence = length > 150 ? 'high' : 'medium';
        }

        return {
          ...msg,
          metadata: {
            ...msg.metadata,
            confidence,
            hasHedging,
            hasQualifiers,
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
        <h1 className="text-4xl font-bold mb-2">Uncertainty & Confidence</h1>
        <p className="text-muted-foreground">
          Communicating AI confidence levels and handling uncertain responses
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          📖 <Link href="https://github.com/yourusername/ai-web-dev-training/blob/main/docs/04-shipping-ai-features/product-patterns-ux.md#uncertainty-handling" className="text-primary hover:underline">Read about uncertainty patterns</Link>
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
          <Button variant="default">Uncertainty</Button>
        </Link>
        <Link href="/citations">
          <Button variant="outline">Citations</Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Info & Controls */}
        <div className="space-y-6">
          {/* Confidence Levels */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4 text-primary" />
                Confidence Levels
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-green-700">High Confidence</strong>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Factual, verifiable information with clear sources
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-yellow-700">Medium Confidence</strong>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Qualified statements, subjective opinions, general guidance
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-orange-700">Low Confidence</strong>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Uncertain, speculative, or outside training data
                  </p>
                </div>
              </div>
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
                  checked={showConfidenceExplanation}
                  onChange={(e) => setShowConfidenceExplanation(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Show confidence explanations</span>
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
                <Info className="w-4 h-4 text-primary" />
                Test Cases
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {UNCERTAINTY_EXAMPLES.map((example, idx) => (
                <div key={idx} className="space-y-1">
                  <button
                    onClick={() => handleSend(example.prompt)}
                    disabled={isLoading}
                    className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {example.prompt}
                  </button>
                  <p className="text-xs text-muted-foreground px-3">
                    Expected: <Badge variant="secondary" className="text-xs">{example.expectedConfidence}</Badge>
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Why This Matters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Why Show Confidence?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p><strong>Builds Trust:</strong> Users appreciate honesty about uncertainty</p>
              <p><strong>Reduces Harm:</strong> Prevents over-reliance on uncertain answers</p>
              <p><strong>Legal Protection:</strong> Shows due diligence in high-stakes domains</p>
              <p><strong>User Empowerment:</strong> Helps users make informed decisions</p>
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
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Confidence Demo
                  </CardTitle>
                  <CardDescription>
                    {messages.length === 0
                      ? 'Ask questions to see confidence indicators in action'
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
                        <TrendingUp className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">Test Confidence Levels</h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        Try the example questions to see how confidence indicators work with different types of queries.
                      </p>
                    </div>
                  </div>
                )}
                {enrichedMessages.map((message) => (
                  <div key={message.id}>
                    <Message
                      message={message}
                      showMetadata={showMetadata}
                      showRawData={showRawData}
                    />
                    {message.role === 'assistant' && showConfidenceExplanation && message.metadata?.confidence && (
                      <div className="mt-3 ml-11 p-3 bg-background/50 rounded-lg border text-xs">
                        <p className="font-medium mb-1">Confidence Analysis:</p>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• Level: <strong>{message.metadata.confidence}</strong></li>
                          {(message.metadata as any).hasHedging && (
                            <li>• Contains hedging language (maybe, perhaps, might, etc.)</li>
                          )}
                          {(message.metadata as any).hasQualifiers && (
                            <li>• Contains qualifiers (it depends, generally, typically, etc.)</li>
                          )}
                          <li>• Response length: {message.content.length} characters</li>
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && enrichedMessages[enrichedMessages.length - 1]?.role !== 'assistant' && (
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
                placeholder="Ask a question to see confidence indicators..."
              />
            </CardContent>
          </Card>

          {/* Implementation Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Implementation Approaches</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Automatic Detection</h4>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>• Analyze hedging language patterns</li>
                  <li>• Check for qualifying statements</li>
                  <li>• Evaluate response certainty markers</li>
                  <li>• Use prompt engineering to request confidence</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">LLM-Provided Scores</h4>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>• Request confidence in system prompt</li>
                  <li>• Use structured outputs with confidence field</li>
                  <li>• Parse confidence from response metadata</li>
                  <li>• Validate against ground truth when available</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Best Practices */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Uncertainty Best Practices</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge variant="success" className="text-xs">DO</Badge>
                  Good Practices
                </h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Always show uncertainty when present</li>
                  <li>• Use clear visual indicators</li>
                  <li>• Explain why confidence is low</li>
                  <li>• Suggest verification methods</li>
                  <li>• Allow users to give feedback</li>
                  <li>• Document confidence thresholds</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">DON'T</Badge>
                  Anti-Patterns
                </h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Hide or downplay uncertainty</li>
                  <li>• Present guesses as facts</li>
                  <li>• Skip confidence for high-stakes queries</li>
                  <li>• Use confusing confidence scales</li>
                  <li>• Ignore model calibration</li>
                  <li>• Over-rely on automated scoring</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
