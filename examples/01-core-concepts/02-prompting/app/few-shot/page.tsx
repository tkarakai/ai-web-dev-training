'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { ChatInput } from '@examples/shared/components/chat/chat-input';
import { Message } from '@examples/shared/components/chat/message';
import { useLlama } from '@examples/shared/lib/hooks';
import { ArrowLeft, Copy, CheckCircle, Lightbulb, Target } from 'lucide-react';
import type { AIMessage } from '@examples/shared/types';

const FEW_SHOT_CATEGORIES = {
  classification: {
    name: 'Classification',
    description: 'Categorize or label inputs',
    icon: '🏷️',
    systemPrompt: 'You are a classifier. Given examples and a new input, classify it according to the pattern shown.',
    examples: [
      { input: 'I love this product!', output: 'Positive' },
      { input: 'Terrible experience, would not recommend.', output: 'Negative' },
      { input: 'It works as expected.', output: 'Neutral' },
    ],
    testInputs: [
      'This exceeded my expectations!',
      'Not worth the money.',
      'Average quality for the price.',
    ],
  },
  extraction: {
    name: 'Information Extraction',
    description: 'Extract structured data from text',
    icon: '🔍',
    systemPrompt: 'You are a data extractor. Given examples and a new input, extract information following the pattern shown.',
    examples: [
      {
        input: 'John Smith from Apple Inc. can be reached at john.smith@apple.com',
        output: '{"name": "John Smith", "company": "Apple Inc.", "email": "john.smith@apple.com"}',
      },
      {
        input: 'Contact Sarah Johnson at Microsoft, email: sjohnson@microsoft.com',
        output: '{"name": "Sarah Johnson", "company": "Microsoft", "email": "sjohnson@microsoft.com"}',
      },
    ],
    testInputs: [
      'Please reach out to Mike Chen at Google, his email is mike.chen@google.com',
      'For inquiries, contact Lisa Wong from Amazon at lwong@amazon.com',
    ],
  },
  transformation: {
    name: 'Text Transformation',
    description: 'Transform text format or style',
    icon: '🔄',
    systemPrompt: 'You are a text transformer. Given examples and a new input, transform it following the pattern shown.',
    examples: [
      { input: 'The cat sat on the mat', output: 'the_cat_sat_on_the_mat' },
      { input: 'Hello World Program', output: 'hello_world_program' },
      { input: 'User Authentication System', output: 'user_authentication_system' },
    ],
    testInputs: [
      'Database Connection Manager',
      'File Upload Handler',
      'Payment Processing Service',
    ],
  },
  generation: {
    name: 'Pattern Generation',
    description: 'Generate content following a pattern',
    icon: '✨',
    systemPrompt: 'You are a pattern generator. Given examples and a prompt, generate content following the pattern shown.',
    examples: [
      {
        input: 'Product: Laptop',
        output: 'Discover the power of productivity with our latest laptop. Lightweight, powerful, and built for professionals.',
      },
      {
        input: 'Product: Headphones',
        output: 'Immerse yourself in crystal-clear sound with our premium headphones. Comfort meets quality in every note.',
      },
    ],
    testInputs: [
      'Product: Smartphone',
      'Product: Smartwatch',
      'Product: Tablet',
    ],
  },
};

export default function FewShotPage() {
  const { messages, isLoading, sendMessage, clearMessages } = useLlama();
  const [selectedCategory, setSelectedCategory] = React.useState<keyof typeof FEW_SHOT_CATEGORIES>('classification');
  const [copiedPrompt, setCopiedPrompt] = React.useState(false);
  const [showMetadata, setShowMetadata] = React.useState(true);
  const [showRawData, setShowRawData] = React.useState(false);

  const category = FEW_SHOT_CATEGORIES[selectedCategory];

  const buildFewShotPrompt = () => {
    let prompt = `${category.systemPrompt}\n\n`;
    prompt += 'Here are some examples:\n\n';

    category.examples.forEach((example, idx) => {
      prompt += `Example ${idx + 1}:\n`;
      prompt += `Input: ${example.input}\n`;
      prompt += `Output: ${example.output}\n\n`;
    });

    prompt += 'Now, given this new input, provide the output following the same pattern:\n';

    return prompt;
  };

  const handleTestInput = async (testInput: string) => {
    const fullPrompt = buildFewShotPrompt() + `\nInput: ${testInput}`;
    await sendMessage(fullPrompt);
  };

  const copyPrompt = () => {
    const prompt = buildFewShotPrompt();
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="mb-4 inline-block">
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Playground
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-2">Few-Shot Examples</h1>
        <p className="text-muted-foreground">
          Learn patterns through examples - few-shot prompting across different domains
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Category Selection */}
        <div className="space-y-6">
          {/* Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Select Category</CardTitle>
              <CardDescription className="text-xs">
                Choose a few-shot learning pattern
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(FEW_SHOT_CATEGORIES).map(([key, cat]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedCategory(key as keyof typeof FEW_SHOT_CATEGORIES);
                    clearMessages();
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedCategory === key
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{cat.icon}</span>
                    <span className="font-medium text-sm">{cat.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Key Concepts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Lightbulb className="w-4 h-4 text-primary" />
                How Few-Shot Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <div>
                <strong className="text-foreground">Pattern Learning:</strong> The model learns from 2-5 examples rather than needing explicit instructions.
              </div>
              <div>
                <strong className="text-foreground">Task Specification:</strong> Examples define the input-output relationship more precisely than descriptions.
              </div>
              <div>
                <strong className="text-foreground">Consistency:</strong> More examples generally lead to more consistent outputs following the pattern.
              </div>
              <div>
                <strong className="text-foreground">Cost vs Accuracy:</strong> Balance the number of examples (cost) with output quality (accuracy).
              </div>
            </CardContent>
          </Card>

          {/* Best Practices */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Best Practices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Use 2-5 diverse examples that cover edge cases</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Keep examples clear and unambiguous</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Maintain consistent formatting across examples</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Order examples from simple to complex</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Test with edge cases not in training examples</span>
              </div>
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

        {/* Right Column - Examples & Testing */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Category Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">{category.icon}</span>
                {category.name}
              </CardTitle>
              <CardDescription>{category.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">System Prompt</label>
                <div className="p-3 bg-muted rounded-lg text-sm font-mono">
                  {category.systemPrompt}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Examples ({category.examples.length})</label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyPrompt}
                  >
                    {copiedPrompt ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Full Prompt
                      </>
                    )}
                  </Button>
                </div>
                <div className="space-y-3">
                  {category.examples.map((example, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-border">
                      <Badge variant="secondary" className="text-xs mb-2">
                        Example {idx + 1}
                      </Badge>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Input:</span>
                          <div className="mt-1 font-mono text-xs bg-blue-50 dark:bg-blue-950/30 p-2 rounded">
                            {example.input}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Output:</span>
                          <div className="mt-1 font-mono text-xs bg-green-50 dark:bg-green-950/30 p-2 rounded">
                            {example.output}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Test Inputs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="w-4 h-4 text-primary" />
                Test the Pattern
              </CardTitle>
              <CardDescription className="text-xs">
                Try these inputs to see if the model learned the pattern
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {category.testInputs.map((testInput, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTestInput(testInput)}
                  disabled={isLoading}
                  className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Badge variant="outline" className="text-xs mb-1">
                    Test {idx + 1}
                  </Badge>
                  <div className="font-mono text-xs">{testInput}</div>
                </button>
              ))}

              <div className="pt-4">
                <ChatInput
                  onSend={handleTestInput}
                  disabled={isLoading}
                  placeholder="Or enter your own test input..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Generated Outputs ({messages.length})</CardTitle>
              <CardDescription className="text-xs">
                Compare how well the model follows the pattern
              </CardDescription>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No outputs yet. Click a test input or enter your own to see results.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {messages.map((message) => (
                    <Message
                      key={message.id}
                      message={message}
                      showMetadata={showMetadata}
                      showRawData={showRawData}
                    />
                  ))}
                </div>
              )}

              {messages.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearMessages}
                  >
                    Clear All Results
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tips for This Category */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tips for {category.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              {selectedCategory === 'classification' && (
                <>
                  <p>• Include examples for all categories you want to detect</p>
                  <p>• Use balanced examples (similar number per category)</p>
                  <p>• Test with ambiguous cases to check reliability</p>
                  <p>• Consider adding a "uncertain" or "other" category</p>
                </>
              )}
              {selectedCategory === 'extraction' && (
                <>
                  <p>• Show examples with all fields present</p>
                  <p>• Include examples with missing fields if applicable</p>
                  <p>• Use consistent JSON formatting across examples</p>
                  <p>• Test with variations in input format</p>
                </>
              )}
              {selectedCategory === 'transformation' && (
                <>
                  <p>• Show the transformation rule clearly through examples</p>
                  <p>• Include edge cases (numbers, special characters)</p>
                  <p>• Test with inputs of varying lengths</p>
                  <p>• Be consistent with formatting decisions</p>
                </>
              )}
              {selectedCategory === 'generation' && (
                <>
                  <p>• Examples should show style and structure consistency</p>
                  <p>• Include diverse content within the same pattern</p>
                  <p>• Test with different types of input topics</p>
                  <p>• Specify desired length or format if important</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
