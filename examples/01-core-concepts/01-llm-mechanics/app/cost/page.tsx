'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { Slider } from '@examples/shared/components/ui/slider';
import { MODEL_PRICING, formatCost, calculateModelCost } from '@examples/shared/lib/utils';
import { ArrowLeft, DollarSign, TrendingUp, Calculator, Zap } from 'lucide-react';

const USAGE_SCENARIOS = {
  'chatbot-light': {
    name: 'Light Chatbot',
    description: 'Simple Q&A, 1000 users/month, 5 msgs each',
    inputTokens: 100,
    outputTokens: 150,
    requestsPerMonth: 5000,
  },
  'chatbot-heavy': {
    name: 'Heavy Chatbot',
    description: 'Support bot, 5000 users/month, 20 msgs each',
    inputTokens: 200,
    outputTokens: 300,
    requestsPerMonth: 100000,
  },
  'content-generation': {
    name: 'Content Generation',
    description: 'Blog posts, 100 articles/month',
    inputTokens: 500,
    outputTokens: 2000,
    requestsPerMonth: 100,
  },
  'code-assistant': {
    name: 'Code Assistant',
    description: 'IDE copilot, 50 devs, 200 completions/day each',
    inputTokens: 1000,
    outputTokens: 500,
    requestsPerMonth: 300000,
  },
  'document-analysis': {
    name: 'Document Analysis',
    description: 'PDF processing, 1000 docs/month',
    inputTokens: 5000,
    outputTokens: 1000,
    requestsPerMonth: 1000,
  },
};

export default function CostCalculatorPage() {
  const [selectedModel, setSelectedModel] = React.useState<keyof typeof MODEL_PRICING>('gpt-4o-mini');
  const [scenario, setScenario] = React.useState<keyof typeof USAGE_SCENARIOS>('chatbot-light');
  const [customInputTokens, setCustomInputTokens] = React.useState([100]);
  const [customOutputTokens, setCustomOutputTokens] = React.useState([150]);
  const [customRequests, setCustomRequests] = React.useState([5000]);
  const [useCustom, setUseCustom] = React.useState(false);

  const scenarioData = useCustom
    ? {
        name: 'Custom Scenario',
        description: 'Your custom configuration',
        inputTokens: customInputTokens[0],
        outputTokens: customOutputTokens[0],
        requestsPerMonth: customRequests[0],
      }
    : USAGE_SCENARIOS[scenario];

  const totalInputTokens = scenarioData.inputTokens * scenarioData.requestsPerMonth;
  const totalOutputTokens = scenarioData.outputTokens * scenarioData.requestsPerMonth;
  const totalTokens = totalInputTokens + totalOutputTokens;

  const cost = calculateModelCost(selectedModel, totalInputTokens, totalOutputTokens);
  const costPerRequest = cost.totalCost / scenarioData.requestsPerMonth;

  const modelOptions = Object.keys(MODEL_PRICING) as (keyof typeof MODEL_PRICING)[];

  // Calculate all models for comparison
  const allModelCosts = modelOptions.map((model) => {
    const modelCost = calculateModelCost(model, totalInputTokens, totalOutputTokens);
    return {
      model,
      ...modelCost,
    };
  }).sort((a, b) => a.totalCost - b.totalCost);

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
        <h1 className="text-4xl font-bold mb-2">Cost Calculator</h1>
        <p className="text-muted-foreground">
          Estimate monthly costs for different models and usage patterns
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Configuration */}
        <div className="space-y-6">
          {/* Model Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Select Model</CardTitle>
            </CardHeader>
            <CardContent>
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
              <div className="mt-3 pt-3 border-t space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Input:</span>
                  <span>${MODEL_PRICING[selectedModel].input}/1M tokens</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Output:</span>
                  <span>${MODEL_PRICING[selectedModel].output}/1M tokens</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scenario Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Usage Scenario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {Object.entries(USAGE_SCENARIOS).map(([key, data]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setScenario(key as keyof typeof USAGE_SCENARIOS);
                      setUseCustom(false);
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      scenario === key && !useCustom
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary hover:bg-accent'
                    }`}
                  >
                    <div className="font-medium text-sm">{data.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{data.description}</div>
                  </button>
                ))}
                <button
                  onClick={() => setUseCustom(true)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    useCustom
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary hover:bg-accent'
                  }`}
                >
                  <div className="font-medium text-sm">Custom Configuration</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Define your own parameters</div>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Custom Configuration */}
          {useCustom && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Custom Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium mb-2 block">
                    Input tokens per request: {customInputTokens[0]}
                  </label>
                  <Slider
                    min={10}
                    max={10000}
                    step={10}
                    value={customInputTokens}
                    onValueChange={setCustomInputTokens}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-2 block">
                    Output tokens per request: {customOutputTokens[0]}
                  </label>
                  <Slider
                    min={10}
                    max={10000}
                    step={10}
                    value={customOutputTokens}
                    onValueChange={setCustomOutputTokens}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-2 block">
                    Requests per month: {customRequests[0].toLocaleString()}
                  </label>
                  <Slider
                    min={100}
                    max={1000000}
                    step={100}
                    value={customRequests}
                    onValueChange={setCustomRequests}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cost Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                Cost Summary
              </CardTitle>
              <CardDescription>{scenarioData.name} - {scenarioData.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{formatCost(cost.totalCost)}</div>
                  <p className="text-sm text-muted-foreground mt-1">Monthly Cost</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCost(cost.totalCost * 12)}/year
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{formatCost(costPerRequest)}</div>
                  <p className="text-sm text-muted-foreground mt-1">Per Request</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {scenarioData.requestsPerMonth.toLocaleString()} requests/mo
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">{(totalTokens / 1000000).toFixed(2)}M</div>
                  <p className="text-sm text-muted-foreground mt-1">Total Tokens</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {((totalInputTokens / totalTokens) * 100).toFixed(0)}% input
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Input cost ({(totalInputTokens / 1000000).toFixed(2)}M tokens):</span>
                  <span className="font-medium">{formatCost(cost.inputCost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Output cost ({(totalOutputTokens / 1000000).toFixed(2)}M tokens):</span>
                  <span className="font-medium">{formatCost(cost.outputCost)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium pt-2 border-t">
                  <span>Total monthly cost:</span>
                  <span className="text-green-600">{formatCost(cost.totalCost)}</span>
                </div>
              </div>

              {selectedModel === 'gpt-oss-20b' && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg flex items-center gap-2 text-sm">
                  <Zap className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span className="text-green-700 dark:text-green-400">
                    This is a local model - running it costs $0 in API fees!
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Model Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4 text-primary" />
                Model Cost Comparison
              </CardTitle>
              <CardDescription className="text-xs">
                Same scenario across all available models
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {allModelCosts.map((item, index) => (
                  <div
                    key={item.model}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      item.model === selectedModel
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {index === 0 && <Badge variant="success" className="text-xs">Cheapest</Badge>}
                      {index === allModelCosts.length - 1 && <Badge variant="secondary" className="text-xs">Most Expensive</Badge>}
                      <span className="text-sm font-medium">{item.model}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{formatCost(item.totalCost)}/mo</span>
                      {item.model === selectedModel && (
                        <Badge variant="outline" className="text-xs">Selected</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Cost Optimization Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cost Optimization Tips</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-semibold">Reduce Token Usage</h4>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>• Use shorter system prompts</li>
                  <li>• Implement conversation summarization</li>
                  <li>• Limit context window size</li>
                  <li>• Cache common responses</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Choose Right Model</h4>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>• Use smaller models for simple tasks</li>
                  <li>• Reserve large models for complex queries</li>
                  <li>• Consider local models for high volume</li>
                  <li>• Implement model routing strategies</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Optimize Output</h4>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>• Set max_tokens limits</li>
                  <li>• Use stop sequences</li>
                  <li>• Request concise responses</li>
                  <li>• Output tokens cost 2-5x more</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Architectural Patterns</h4>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>• Implement request batching</li>
                  <li>• Use streaming for better UX</li>
                  <li>• Add request deduplication</li>
                  <li>• Monitor and set budget alerts</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
