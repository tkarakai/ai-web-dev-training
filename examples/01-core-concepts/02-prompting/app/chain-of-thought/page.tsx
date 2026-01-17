'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { ChatThread } from '@examples/shared/components/chat/chat-thread';
import { useLlama } from '@examples/shared/lib/hooks';
import { Brain, ArrowLeft, Lightbulb } from 'lucide-react';

const COT_EXAMPLES = [
  {
    id: 'math',
    title: 'Math Problem',
    prompt: `Solve this problem step by step:

A store has 150 items. In the morning, they sell 30% of them. In the afternoon, they sell half of what remains. How many items are left at the end of the day?

Let's think step by step:`,
    description: 'Mathematical reasoning with multiple steps',
  },
  {
    id: 'logic',
    title: 'Logic Puzzle',
    prompt: `All roses are flowers. Some flowers fade quickly. Does this mean some roses fade quickly?

Let's reason through this step by step:`,
    description: 'Logical deduction requiring careful analysis',
  },
  {
    id: 'code',
    title: 'Code Analysis',
    prompt: `Is this code correct? Explain your reasoning step by step:

\`\`\`python
def is_prime(n):
    if n < 2:
        return False
    for i in range(2, n):
        if n % i == 0:
            return False
    return True
\`\`\`

Let's analyze this step by step:`,
    description: 'Code review with systematic analysis',
  },
];

export default function ChainOfThoughtPage() {
  const { messages, isLoading, sendMessage, clearMessages } = useLlama();
  const [selectedExample, setSelectedExample] = React.useState(COT_EXAMPLES[0]);
  const [showMetadata, setShowMetadata] = React.useState(true);
  const [showRawData, setShowRawData] = React.useState(false);

  const handleRunExample = async () => {
    clearMessages();
    await sendMessage(selectedExample.prompt);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="mb-4 inline-block">
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Playground
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-2">Chain-of-Thought Reasoning</h1>
        <p className="text-muted-foreground">
          Encourage the model to break down complex problems into steps
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column - Examples */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                Example Problems
              </CardTitle>
              <CardDescription>
                Select an example to see step-by-step reasoning
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {COT_EXAMPLES.map((example) => (
                <div
                  key={example.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedExample.id === example.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedExample(example)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold">{example.title}</h3>
                    {selectedExample.id === example.id && (
                      <Badge variant="default" className="text-xs">Selected</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {example.description}
                  </p>
                </div>
              ))}

              <Button
                onClick={handleRunExample}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Thinking...' : 'Run Example'}
              </Button>
            </CardContent>
          </Card>

          {/* Explanation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                How Chain-of-Thought Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Key Technique</h4>
                <p className="text-muted-foreground">
                  Adding "Let's think step by step" or similar phrases encourages the model to break down complex problems into intermediate reasoning steps.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Why It Works</h4>
                <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                  <li>Forces explicit reasoning</li>
                  <li>Reduces errors in multi-step problems</li>
                  <li>Makes the thought process transparent</li>
                  <li>Helps catch logical mistakes</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Best For</h4>
                <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                  <li>Math and arithmetic problems</li>
                  <li>Logic puzzles and reasoning</li>
                  <li>Code debugging and analysis</li>
                  <li>Multi-step decision making</li>
                </ul>
              </div>

              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  <strong>Tip:</strong> The model's reasoning steps are visible in its response, allowing you to verify its logic.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          <Card className="h-[700px] flex flex-col">
            <CardHeader>
              <CardTitle>Reasoning Process</CardTitle>
              <CardDescription>
                {messages.length === 0
                  ? 'Run an example to see step-by-step reasoning'
                  : 'Watch the model think through the problem'}
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
        </div>
      </div>
    </div>
  );
}
