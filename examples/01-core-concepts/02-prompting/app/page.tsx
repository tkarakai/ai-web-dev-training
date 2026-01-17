'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Textarea } from '@examples/shared/components/ui/textarea';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { ChatThread } from '@examples/shared/components/chat/chat-thread';
import { useLlama } from '@examples/shared/lib/hooks';
import { Sparkles, Layers, Brain, Bot, AlertCircle } from 'lucide-react';

const PROMPT_EXAMPLES = {
  zeroShot: {
    name: 'Zero-Shot',
    prompt: 'Classify the sentiment of this review: "The product is okay but shipping was slow."',
    description: 'Direct instruction without examples',
  },
  fewShot: {
    name: 'Few-Shot',
    prompt: `Classify the sentiment as positive, negative, or neutral.

Examples:
- "Amazing product, fast delivery!" → positive
- "Terrible quality, waste of money." → negative
- "Product works as expected." → neutral

Review: "The product is okay but shipping was slow."
Sentiment:`,
    description: 'Provide examples to guide the model',
  },
  chainOfThought: {
    name: 'Chain-of-Thought',
    prompt: `Solve this problem step by step:

Problem: A store has 15 apples. They sell 40% of them in the morning and 1/3 of the remaining apples in the afternoon. How many apples are left?

Let's think step by step:`,
    description: 'Encourage reasoning process',
  },
};

export default function PromptingPage() {
  const [prompt, setPrompt] = React.useState(PROMPT_EXAMPLES.zeroShot.prompt);
  const [systemPrompt, setSystemPrompt] = React.useState('You are a helpful AI assistant.');
  const [selectedExample, setSelectedExample] = React.useState<keyof typeof PROMPT_EXAMPLES>('zeroShot');
  const [showMetadata, setShowMetadata] = React.useState(true);
  const [showRawData, setShowRawData] = React.useState(false);

  const { messages, isLoading, error, sendMessage, clearMessages, status } = useLlama({
    onError: (err) => console.error('LLM Error:', err),
  });

  const handleSend = async () => {
    if (!prompt.trim() || isLoading) return;
    await sendMessage(prompt, systemPrompt);
  };

  const loadExample = (key: keyof typeof PROMPT_EXAMPLES) => {
    setSelectedExample(key);
    setPrompt(PROMPT_EXAMPLES[key].prompt);
    clearMessages();
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Prompt Engineering</h1>
        <p className="text-muted-foreground">
          Learn prompting patterns: zero-shot, few-shot, chain-of-thought, and agent loops
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          📖 <Link href="https://github.com/yourusername/ai-web-dev-training/blob/main/docs/01-core-concepts/prompting.md" className="text-primary hover:underline">Read the documentation</Link>
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Link href="/">
          <Button variant="default">Playground</Button>
        </Link>
        <Link href="/few-shot">
          <Button variant="outline">Few-Shot Examples</Button>
        </Link>
        <Link href="/chain-of-thought">
          <Button variant="outline">Chain-of-Thought</Button>
        </Link>
        <Link href="/agent">
          <Button variant="outline">Agent Loop</Button>
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column - Input */}
        <div className="space-y-6">
          {/* Prompt Examples */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Prompt Patterns
              </CardTitle>
              <CardDescription>
                Try different prompting techniques
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(PROMPT_EXAMPLES).map(([key, example]) => (
                <div key={key} className="flex items-start gap-3">
                  <Button
                    variant={selectedExample === key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => loadExample(key as keyof typeof PROMPT_EXAMPLES)}
                    className="flex-shrink-0"
                  >
                    {example.name}
                  </Button>
                  <p className="text-sm text-muted-foreground pt-1">
                    {example.description}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* System Prompt */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">System Prompt</CardTitle>
              <CardDescription className="text-xs">
                Set the behavior and context for the AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a helpful AI assistant..."
                className="min-h-[100px] font-mono text-sm"
              />
            </CardContent>
          </Card>

          {/* User Prompt */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Your Prompt</CardTitle>
              <CardDescription className="text-xs">
                Enter your instruction or question
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt here..."
                className="min-h-[200px] font-mono text-sm"
              />

              <div className="flex gap-2">
                <Button
                  onClick={handleSend}
                  disabled={isLoading || !prompt.trim()}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Bot className="w-4 h-4 mr-2 animate-pulse" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Send
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={clearMessages}
                  disabled={messages.length === 0}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Status Info */}
          {error && (
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Connection Error</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {error.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Make sure llama-server is running on port 8033, or configure a fallback provider.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Response */}
        <div className="space-y-6">
          {/* Conversation Thread */}
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                Conversation
              </CardTitle>
              <CardDescription>
                {messages.length === 0
                  ? 'Send a prompt to start the conversation'
                  : `${messages.length} message${messages.length !== 1 ? 's' : ''}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ChatThread
                messages={messages}
                isLoading={isLoading}
                showMetadata={showMetadata}
                showRawData={showRawData}
                className="h-full"
              />
            </CardContent>
          </Card>

          {/* Display Options */}
          <Card>
            <CardHeader>
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

          {/* Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Layers className="w-4 h-4" />
                Prompting Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Be specific:</strong> Clear instructions produce better results</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Use examples:</strong> Few-shot prompting improves accuracy</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Request reasoning:</strong> "Think step by step" for complex tasks</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Iterate:</strong> Refine prompts based on responses</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
