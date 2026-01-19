'use client';

import { useState, useMemo } from 'react';
import {
  estimateTokensByChars,
  estimateTokensByWords,
  estimateTokensHybrid,
  calculateCost,
  checkContextFit,
  compareModelCosts,
  formatCost,
  formatTokens,
  getAvailableModels,
  MODEL_PRICING,
  type ModelId,
} from '@/lib/tokens';

/**
 * Token Economics Visualizer
 *
 * This UI demonstrates the code in lib/tokens.ts.
 * Study the code, then use this UI to experiment with different inputs.
 *
 * TRY:
 * 1. Compare estimation methods with different text types
 * 2. See how costs vary across models
 * 3. Understand context window limits
 */

export default function TokenEconomicsPage() {
  const [text, setText] = useState(
    'The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet.'
  );
  const [outputTokens, setOutputTokens] = useState(100);
  const [selectedModel, setSelectedModel] = useState<ModelId>('gpt-4o-mini');

  // Calculate all estimates
  const estimates = useMemo(() => ({
    byChars: estimateTokensByChars(text),
    byWords: estimateTokensByWords(text),
    hybrid: estimateTokensHybrid(text),
  }), [text]);

  const cost = useMemo(
    () => calculateCost(estimates.hybrid, outputTokens, selectedModel),
    [estimates.hybrid, outputTokens, selectedModel]
  );

  const contextUsage = useMemo(
    () => checkContextFit(estimates.hybrid, outputTokens, selectedModel),
    [estimates.hybrid, outputTokens, selectedModel]
  );

  const modelComparison = useMemo(
    () => compareModelCosts(estimates.hybrid, outputTokens),
    [estimates.hybrid, outputTokens]
  );

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Exercise 01: Token Economics</h1>
        <p className="text-gray-400 mt-2">
          Study <code className="text-blue-400">lib/tokens.ts</code> to learn the code patterns.
          Use this UI to experiment.
        </p>
      </header>

      {/* Input Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Input Text</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full h-40 bg-gray-800 border border-gray-700 rounded-lg p-4 font-mono text-sm"
          placeholder="Enter text to analyze..."
        />
        <div className="flex gap-4 text-sm text-gray-400">
          <span>{text.length} characters</span>
          <span>{text.trim().split(/\s+/).filter(Boolean).length} words</span>
        </div>
      </section>

      {/* Token Estimation Comparison */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Token Estimation Methods</h2>
        <p className="text-gray-400 text-sm">
          Compare three methods. Hybrid is most accurate for mixed content.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <EstimateCard
            method="Character-based"
            tokens={estimates.byChars}
            description="text.length / 4"
            accuracy="Low"
          />
          <EstimateCard
            method="Word-based"
            tokens={estimates.byWords}
            description="words * 1.3"
            accuracy="Medium"
          />
          <EstimateCard
            method="Hybrid"
            tokens={estimates.hybrid}
            description="words + punctuation + numbers"
            accuracy="High"
            highlighted
          />
        </div>
      </section>

      {/* Cost Calculator */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Cost Calculator</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as ModelId)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
            >
              {getAvailableModels().map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Expected Output Tokens
            </label>
            <input
              type="number"
              value={outputTokens}
              onChange={(e) => setOutputTokens(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 w-32"
              min={0}
              max={100000}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <CostCard label="Input Cost" value={formatCost(cost.inputCost)} />
          <CostCard label="Output Cost" value={formatCost(cost.outputCost)} />
          <CostCard label="Total Cost" value={formatCost(cost.totalCost)} highlighted />
          <CostCard
            label="Context Used"
            value={`${contextUsage.percentUsed.toFixed(1)}%`}
            warning={!contextUsage.canFit}
          />
        </div>
      </section>

      {/* Context Window */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Context Window</h2>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex justify-between text-sm mb-2">
            <span>
              Used: {formatTokens(contextUsage.usedTokens)} input +{' '}
              {formatTokens(outputTokens)} output
            </span>
            <span>
              Available: {formatTokens(MODEL_PRICING[selectedModel].contextWindow)}
            </span>
          </div>
          <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                contextUsage.canFit ? 'bg-blue-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(contextUsage.percentUsed, 100)}%` }}
            />
          </div>
          {!contextUsage.canFit && (
            <p className="text-red-400 text-sm mt-2">
              Content exceeds context window! Reduce input or output tokens.
            </p>
          )}
        </div>
      </section>

      {/* Model Comparison */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Model Cost Comparison</h2>
        <p className="text-gray-400 text-sm">
          Same input, different models. Sorted cheapest to most expensive.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="pb-2">Model</th>
                <th className="pb-2">Input $/1M</th>
                <th className="pb-2">Output $/1M</th>
                <th className="pb-2">Context</th>
                <th className="pb-2">This Request</th>
              </tr>
            </thead>
            <tbody>
              {modelComparison.map(({ model, cost }) => (
                <tr
                  key={model}
                  className={`border-b border-gray-800 ${
                    model === selectedModel ? 'bg-gray-800' : ''
                  }`}
                >
                  <td className="py-2 font-mono">{model}</td>
                  <td className="py-2">${MODEL_PRICING[model].input}</td>
                  <td className="py-2">${MODEL_PRICING[model].output}</td>
                  <td className="py-2">{formatTokens(MODEL_PRICING[model].contextWindow)}</td>
                  <td className="py-2 font-mono">{formatCost(cost.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Code Reference */}
      <section className="bg-gray-800 rounded-lg p-4 text-sm">
        <h3 className="font-semibold mb-2">Study the Code</h3>
        <ul className="space-y-1 text-gray-400">
          <li>
            <code className="text-blue-400">lib/tokens.ts</code> - All estimation
            and calculation functions
          </li>
          <li>
            <code className="text-blue-400">lib/tokens.test.ts</code> - Tests
            showing expected behavior
          </li>
        </ul>
        <p className="mt-2 text-gray-400">
          Run <code className="text-green-400">bun test</code> to verify your understanding.
        </p>
      </section>
    </main>
  );
}

// =============================================================================
// Components
// =============================================================================

function EstimateCard({
  method,
  tokens,
  description,
  accuracy,
  highlighted = false,
}: {
  method: string;
  tokens: number;
  description: string;
  accuracy: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        highlighted
          ? 'bg-blue-900/20 border-blue-700'
          : 'bg-gray-800 border-gray-700'
      }`}
    >
      <h3 className="font-medium">{method}</h3>
      <p className="text-3xl font-bold mt-2">{tokens}</p>
      <p className="text-xs text-gray-400 mt-1 font-mono">{description}</p>
      <p className="text-xs text-gray-500 mt-1">Accuracy: {accuracy}</p>
    </div>
  );
}

function CostCard({
  label,
  value,
  highlighted = false,
  warning = false,
}: {
  label: string;
  value: string;
  highlighted?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        warning
          ? 'bg-red-900/20 border-red-700'
          : highlighted
          ? 'bg-green-900/20 border-green-700'
          : 'bg-gray-800 border-gray-700'
      }`}
    >
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-xl font-bold font-mono">{value}</p>
    </div>
  );
}
