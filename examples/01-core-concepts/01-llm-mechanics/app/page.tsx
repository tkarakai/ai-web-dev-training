'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Textarea } from '@examples/shared/components/ui/textarea';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { estimateTokens, estimateTokensAccurate, formatTokenCount, formatCost, calculateModelCost, MODEL_PRICING } from '@examples/shared/lib/utils';
import { Zap, DollarSign, Clock, Book } from 'lucide-react';

const SAMPLE_TEXTS = {
  short: 'Hello, world!',
  function: `function isPrime(n) {
  if (n <= 1) return false;
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) return false;
  }
  return true;
}`,
  paragraph: `The quick brown fox jumps over the lazy dog. This sentence contains every letter of the English alphabet. It's commonly used for testing fonts and keyboards. The pangram has been around since at least 1885 and remains popular today.`,
};

export default function LLMMechanicsPage() {
  const [text, setText] = React.useState(SAMPLE_TEXTS.paragraph);
  const [selectedModel, setSelectedModel] = React.useState<keyof typeof MODEL_PRICING>('gpt-4o-mini');

  const tokens = estimateTokensAccurate(text);
  const cost = calculateModelCost(selectedModel, tokens, tokens);

  const modelOptions = Object.keys(MODEL_PRICING) as (keyof typeof MODEL_PRICING)[];

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">LLM Mechanics</h1>
        <p className="text-muted-foreground">
          Interactive tools for understanding tokens, context windows, sampling, and costs
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          📖 <Link href="https://github.com/yourusername/ai-web-dev-training/blob/main/docs/01-core-concepts/llm-mechanics.md" className="text-primary hover:underline">Read the documentation</Link>
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Link href="/">
          <Button variant="default">Token Visualizer</Button>
        </Link>
        <Link href="/context">
          <Button variant="outline">Context Window</Button>
        </Link>
        <Link href="/sampling">
          <Button variant="outline">Sampling</Button>
        </Link>
        <Link href="/cost">
          <Button variant="outline">Cost Calculator</Button>
        </Link>
      </div>

      {/* Main Content */}
      <div className="grid gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Token Visualizer</CardTitle>
            <CardDescription>
              Enter text below to see how it's tokenized and estimated token count
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Sample Text
              </label>
              <div className="flex gap-2 mb-3 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setText(SAMPLE_TEXTS.short)}
                >
                  Short
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setText(SAMPLE_TEXTS.function)}
                >
                  Function
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setText(SAMPLE_TEXTS.paragraph)}
                >
                  Paragraph
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setText('')}
                >
                  Clear
                </Button>
              </div>
            </div>

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text to analyze..."
              className="min-h-[200px] font-mono text-sm"
            />

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{text.length} characters</span>
              <span>•</span>
              <span>{text.split(/\s+/).filter(Boolean).length} words</span>
            </div>
          </CardContent>
        </Card>

        {/* Results Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Token Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Token Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-3xl font-bold text-primary">
                  {formatTokenCount(tokens)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Estimated token count
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chars per token:</span>
                  <span className="font-medium">{(text.length / tokens).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Simple estimate:</span>
                  <span className="font-medium">{estimateTokens(text)} tokens</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Accurate estimate:</span>
                  <span className="font-medium">{tokens} tokens</span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> These are rough estimates. For precise tokenization, use tiktoken or your model's tokenizer.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cost Calculator */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Cost Estimate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as keyof typeof MODEL_PRICING)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                >
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCost(cost.totalCost)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total cost (input + output)
                  </p>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Input cost:</span>
                    <span className="font-medium">{formatCost(cost.inputCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Output cost:</span>
                    <span className="font-medium">{formatCost(cost.outputCost)}</span>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Input price:</span>
                      <span>${MODEL_PRICING[selectedModel].input}/1M tokens</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Output price:</span>
                      <span>${MODEL_PRICING[selectedModel].output}/1M tokens</span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedModel === 'gpt-oss-20b' && (
                <Badge variant="success" className="w-full justify-center">
                  <Zap className="w-3 h-3 mr-1" />
                  Local model - Free!
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Key Concepts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Book className="w-5 h-5" />
              Key Concepts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Tokens</h3>
                <p className="text-sm text-muted-foreground">
                  The smallest unit of text an LLM processes. Roughly 4 characters or ¾ of a word in English.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Context Window</h3>
                <p className="text-sm text-muted-foreground">
                  Maximum tokens an LLM can process in a single request, including both input and output.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Cost Structure</h3>
                <p className="text-sm text-muted-foreground">
                  Total cost = (input tokens × input price) + (output tokens × output price). Output costs 2-5x more.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Clock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium">About This Example</p>
                <p className="text-sm text-muted-foreground">
                  This example demonstrates token estimation without making any AI API calls. It's a pure frontend tool that helps you understand how LLMs count tokens and calculate costs.
                </p>
                <p className="text-sm text-muted-foreground">
                  For production applications, use precise tokenizers like <code className="bg-muted px-1 py-0.5 rounded text-xs">tiktoken</code> for OpenAI models or your specific model's tokenizer.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
