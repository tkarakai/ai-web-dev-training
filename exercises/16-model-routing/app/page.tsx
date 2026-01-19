'use client';

import { useState, useCallback } from 'react';

type ComplexityLevel = 'simple' | 'moderate' | 'complex';
type ModelCapability = 'chat' | 'code' | 'reasoning' | 'math' | 'creative' | 'fast' | 'multilingual';

interface ModelConfig {
  id: string;
  name: string;
  costPer1kTokens: number;
  latencyMs: number;
  capabilities: ModelCapability[];
}

interface ComplexitySignals {
  wordCount: number;
  sentenceCount: number;
  hasCode: boolean;
  hasMath: boolean;
  hasMultiStep: boolean;
  technicalTermCount: number;
  questionCount: number;
  reasoningIndicators: number;
}

interface RoutingDecision {
  model: ModelConfig;
  reason: string;
  complexity: ComplexityLevel;
  confidence: number;
}

const MODELS: ModelConfig[] = [
  {
    id: 'small',
    name: 'Small Model (0.5B)',
    costPer1kTokens: 0.0001,
    latencyMs: 100,
    capabilities: ['chat', 'fast'],
  },
  {
    id: 'medium',
    name: 'Medium Model (3B)',
    costPer1kTokens: 0.0005,
    latencyMs: 300,
    capabilities: ['chat', 'code', 'reasoning'],
  },
  {
    id: 'large',
    name: 'Large Model (7B+)',
    costPer1kTokens: 0.002,
    latencyMs: 800,
    capabilities: ['chat', 'code', 'reasoning', 'math', 'creative', 'multilingual'],
  },
];

const EXAMPLE_INPUTS = [
  { label: 'Simple greeting', text: 'Hello, how are you?' },
  { label: 'Code request', text: 'Write a function to sort an array in TypeScript' },
  { label: 'Math problem', text: 'Solve the equation x^2 + 5x - 6 = 0' },
  {
    label: 'Complex analysis',
    text: 'Analyze the trade-offs between microservices and monolithic architecture. Consider scalability, complexity, and deployment.',
  },
  {
    label: 'Multi-step task',
    text: 'First, explain how React hooks work. Then, show an example of useState. Finally, explain common pitfalls.',
  },
];

function analyzeComplexity(input: string): ComplexitySignals {
  const words = input.split(/\s+/).filter((w) => w.length > 0);
  const sentences = input.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  const codePatterns = [/```/, /function\s+\w+/, /const\s+\w+/, /let\s+\w+/, /class\s+\w+/, /import\s+/, /export\s+/, /=>/, /\{\s*\}/];
  const hasCode = codePatterns.some((p) => p.test(input));

  const mathPatterns = [/\d+\s*[\+\-\*\/\^]\s*\d+/, /calculate/i, /compute/i, /solve/i, /equation/i, /formula/i, /derivative/i, /integral/i];
  const hasMath = mathPatterns.some((p) => p.test(input));

  const multiStepPatterns = [/first.*then/i, /step\s*\d/i, /\d+\.\s+/, /and then/i, /after that/i, /finally/i];
  const hasMultiStep = multiStepPatterns.some((p) => p.test(input));

  const technicalTerms = ['algorithm', 'architecture', 'database', 'api', 'framework', 'protocol', 'encryption', 'authentication', 'optimization', 'concurrency'];
  const lowerInput = input.toLowerCase();
  const technicalTermCount = technicalTerms.filter((t) => lowerInput.includes(t)).length;

  const questionCount = (input.match(/\?/g) || []).length;

  const reasoningPatterns = [/why\s/i, /how\s/i, /explain/i, /compare/i, /analyze/i, /evaluate/i, /what if/i, /pros and cons/i, /trade-?off/i];
  const reasoningIndicators = reasoningPatterns.filter((p) => p.test(input)).length;

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    hasCode,
    hasMath,
    hasMultiStep,
    technicalTermCount,
    questionCount,
    reasoningIndicators,
  };
}

function classifyComplexity(signals: ComplexitySignals): { level: ComplexityLevel; confidence: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (signals.wordCount > 100) {
    score += 2;
    reasons.push('Long input');
  } else if (signals.wordCount > 50) {
    score += 1;
    reasons.push('Medium-length input');
  }

  if (signals.hasCode) {
    score += 2;
    reasons.push('Contains code');
  }
  if (signals.hasMath) {
    score += 2;
    reasons.push('Mathematical content');
  }
  if (signals.hasMultiStep) {
    score += 2;
    reasons.push('Multi-step task');
  }

  if (signals.technicalTermCount >= 3) {
    score += 2;
    reasons.push('Highly technical');
  } else if (signals.technicalTermCount >= 1) {
    score += 1;
    reasons.push('Some technical terms');
  }

  if (signals.questionCount > 2) {
    score += 2;
    reasons.push('Multiple questions');
  }

  if (signals.reasoningIndicators >= 2) {
    score += 2;
    reasons.push('Requires reasoning');
  } else if (signals.reasoningIndicators >= 1) {
    score += 1;
    reasons.push('Some analysis needed');
  }

  let level: ComplexityLevel;
  let confidence: number;

  if (score >= 6) {
    level = 'complex';
    confidence = Math.min(0.95, 0.7 + score * 0.03);
  } else if (score >= 3) {
    level = 'moderate';
    confidence = 0.7 + Math.abs(score - 4.5) * 0.05;
  } else {
    level = 'simple';
    confidence = Math.min(0.95, 0.8 + (3 - score) * 0.05);
  }

  if (reasons.length === 0) {
    reasons.push('Straightforward query');
  }

  return { level, confidence, reasons };
}

function routeToModel(input: string): RoutingDecision {
  const signals = analyzeComplexity(input);
  const { level, confidence, reasons } = classifyComplexity(signals);

  // Score models
  const scoredModels = MODELS.map((model) => {
    let score = 0;

    if (signals.hasCode && model.capabilities.includes('code')) score += 20;
    if (signals.hasMath && model.capabilities.includes('math')) score += 20;
    if (signals.reasoningIndicators > 0 && model.capabilities.includes('reasoning')) score += 15;

    if (level === 'complex') {
      score += model.capabilities.length * 5;
    } else if (level === 'simple') {
      score += (1 - model.costPer1kTokens / 0.01) * 10;
      score += (1 - model.latencyMs / 1000) * 10;
    }

    score -= model.costPer1kTokens * 1000 * 3;

    return { model, score };
  });

  scoredModels.sort((a, b) => b.score - a.score);

  return {
    model: scoredModels[0].model,
    reason: reasons.join(', '),
    complexity: level,
    confidence,
  };
}

export default function ModelRoutingPage() {
  const [input, setInput] = useState('');
  const [signals, setSignals] = useState<ComplexitySignals | null>(null);
  const [decision, setDecision] = useState<RoutingDecision | null>(null);

  const handleAnalyze = useCallback(() => {
    if (!input.trim()) return;

    const s = analyzeComplexity(input);
    setSignals(s);

    const d = routeToModel(input);
    setDecision(d);
  }, [input]);

  const handleExample = useCallback((text: string) => {
    setInput(text);
    const s = analyzeComplexity(text);
    setSignals(s);
    setDecision(routeToModel(text));
  }, []);

  const getComplexityColor = (level: ComplexityLevel) => {
    switch (level) {
      case 'simple': return 'bg-green-900 text-green-300';
      case 'moderate': return 'bg-yellow-900 text-yellow-300';
      case 'complex': return 'bg-red-900 text-red-300';
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Exercise 16: Model Routing</h1>
        <p className="text-gray-400 mb-8">
          Route requests to different models based on complexity and cost
        </p>

        {/* Models Overview */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Available Models</h2>
          <div className="grid grid-cols-3 gap-4">
            {MODELS.map((model) => (
              <div key={model.id} className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-medium mb-2">{model.name}</h3>
                <div className="text-sm text-gray-400 space-y-1">
                  <p>Cost: ${model.costPer1kTokens}/1K tokens</p>
                  <p>Latency: ~{model.latencyMs}ms</p>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {model.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Routing</h2>

          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Example Inputs:</label>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_INPUTS.map((example) => (
                <button
                  key={example.label}
                  onClick={() => handleExample(example.text)}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm"
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter a query to see how it would be routed..."
            className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg p-3 mb-4"
          />

          <button
            onClick={handleAnalyze}
            disabled={!input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2 rounded-lg"
          >
            Analyze & Route
          </button>
        </div>

        {/* Analysis Results */}
        {signals && (
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Signals */}
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Complexity Signals</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Word Count</span>
                  <span>{signals.wordCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Sentences</span>
                  <span>{signals.sentenceCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Has Code</span>
                  <span className={signals.hasCode ? 'text-green-400' : 'text-gray-500'}>
                    {signals.hasCode ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Has Math</span>
                  <span className={signals.hasMath ? 'text-green-400' : 'text-gray-500'}>
                    {signals.hasMath ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Multi-Step</span>
                  <span className={signals.hasMultiStep ? 'text-green-400' : 'text-gray-500'}>
                    {signals.hasMultiStep ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Technical Terms</span>
                  <span>{signals.technicalTermCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Questions</span>
                  <span>{signals.questionCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Reasoning Indicators</span>
                  <span>{signals.reasoningIndicators}</span>
                </div>
              </div>
            </div>

            {/* Decision */}
            {decision && (
              <div className="bg-gray-900 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Routing Decision</h2>

                <div className="mb-4">
                  <span className="text-gray-400 text-sm">Complexity:</span>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`px-3 py-1 rounded capitalize ${getComplexityColor(decision.complexity)}`}>
                      {decision.complexity}
                    </span>
                    <span className="text-gray-400">
                      {(decision.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="text-gray-400 text-sm">Routed to:</span>
                  <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mt-1">
                    <div className="font-medium text-blue-300">{decision.model.name}</div>
                    <div className="text-sm text-gray-400 mt-1">
                      ${decision.model.costPer1kTokens}/1K tokens, ~{decision.model.latencyMs}ms
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-gray-400 text-sm">Reason:</span>
                  <p className="text-gray-300 mt-1">{decision.reason}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Code Reference */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Code Patterns</h2>
          <pre className="bg-gray-800 p-4 rounded text-sm overflow-x-auto">
{`// lib/routing.ts - Key patterns

// 1. Complexity Analysis
function analyzeComplexity(input: string): ComplexitySignals {
  // Detect code, math, multi-step, technical terms, etc.
}

// 2. Model Registry
const registry = new ModelRegistry([
  { id: 'small', capabilities: ['chat', 'fast'], ... },
  { id: 'large', capabilities: ['chat', 'code', 'reasoning', 'math'], ... },
]);

// 3. Router with Rules
const router = new ModelRouter({
  registry,
  rules: [
    { name: 'code-gen', condition: (input) => /write.*function/i.test(input), targetModel: 'medium' },
    { name: 'greeting', condition: (input) => input.length < 20, targetModel: 'small' },
  ],
});

// 4. Fallback Chain
const chain = new FallbackChain(registry, { models: ['small', 'medium', 'large'] });
const result = await chain.execute(async (model) => callModel(model));`}
          </pre>
        </div>
      </div>
    </div>
  );
}
