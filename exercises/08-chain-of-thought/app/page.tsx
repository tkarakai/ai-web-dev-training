'use client';

import { useState, useCallback } from 'react';

/**
 * Chain-of-Thought Reasoning Demo
 *
 * Compare zero-shot vs CoT prompting, see reasoning steps extracted.
 *
 * REQUIRES: llama-server running on port 8033
 */

interface ReasoningStep {
  stepNumber: number;
  content: string;
}

interface CoTResponse {
  fullResponse: string;
  steps: ReasoningStep[];
  finalAnswer: string;
  confidence: number;
}

interface ComparisonResult {
  question: string;
  zeroShot: { response: string; answer: string; latencyMs: number };
  chainOfThought: CoTResponse & { latencyMs: number };
}

const SAMPLE_QUESTIONS = [
  'If a train travels 60 miles in 1.5 hours, what is its average speed?',
  'A store offers 25% off. If an item costs $80, what is the sale price?',
  "A bat and ball cost $1.10 together. The bat costs $1 more than the ball. How much does the ball cost?",
  'In a race, you overtake the person in 2nd place. What position are you in now?',
  'A farmer has 17 sheep. All but 9 run away. How many sheep are left?',
];

export default function ChainOfThoughtPage() {
  const [question, setQuestion] = useState(SAMPLE_QUESTIONS[0]);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runComparison = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Dynamically import to avoid SSR issues
      const {
        buildZeroShotPrompt,
        buildStructuredCoTPrompt,
        extractSteps,
        extractFinalAnswer,
        estimateConfidence,
      } = await import('@/lib/chain-of-thought');

      const baseUrl = 'http://127.0.0.1:8033';

      // Zero-shot
      const zeroStart = Date.now();
      const zeroPrompt = buildZeroShotPrompt(question);
      const zeroRes = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: zeroPrompt }],
          temperature: 0,
          max_tokens: 200,
        }),
      });
      const zeroData = await zeroRes.json();
      const zeroResponse = zeroData.choices?.[0]?.message?.content || '';
      const zeroLatency = Date.now() - zeroStart;

      // Chain-of-Thought
      const cotStart = Date.now();
      const cotPrompt = buildStructuredCoTPrompt(question);
      const cotRes = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: cotPrompt }],
          temperature: 0,
          max_tokens: 500,
        }),
      });
      const cotData = await cotRes.json();
      const cotResponse = cotData.choices?.[0]?.message?.content || '';
      const cotLatency = Date.now() - cotStart;

      const steps = extractSteps(cotResponse);
      const finalAnswer = extractFinalAnswer(cotResponse);

      setResult({
        question,
        zeroShot: {
          response: zeroResponse,
          answer: extractFinalAnswer(zeroResponse),
          latencyMs: zeroLatency,
        },
        chainOfThought: {
          fullResponse: cotResponse,
          steps,
          finalAnswer,
          confidence: estimateConfidence(cotResponse, steps),
          latencyMs: cotLatency,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect to llama-server');
    }

    setIsLoading(false);
  }, [question]);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Exercise 08: Chain-of-Thought</h1>
        <p className="text-gray-400 mt-2">
          Study <code className="text-blue-400">lib/chain-of-thought.ts</code> - step-by-step
          reasoning improves accuracy.
        </p>
      </header>

      {/* Question Input */}
      <section className="bg-gray-800 p-6 rounded-lg space-y-4">
        <h2 className="text-xl font-semibold">Ask a Question</h2>

        <div className="flex flex-wrap gap-2">
          {SAMPLE_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => setQuestion(q)}
              className={`px-3 py-1 text-sm rounded ${
                question === q ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Sample {i + 1}
            </button>
          ))}
        </div>

        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 min-h-[80px]"
          placeholder="Enter a reasoning question..."
        />

        <button
          onClick={runComparison}
          disabled={isLoading || !question.trim()}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg"
        >
          {isLoading ? 'Comparing...' : 'Compare Zero-Shot vs Chain-of-Thought'}
        </button>

        {error && (
          <p className="text-red-400 text-sm">
            Error: {error}. Is llama-server running on port 8033?
          </p>
        )}
      </section>

      {/* Results Comparison */}
      {result && (
        <section className="grid md:grid-cols-2 gap-6">
          {/* Zero-Shot */}
          <div className="bg-gray-800 p-6 rounded-lg space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-yellow-400">Zero-Shot</h3>
              <span className="text-sm text-gray-400">{result.zeroShot.latencyMs}ms</span>
            </div>

            <div className="bg-gray-900 p-4 rounded text-sm whitespace-pre-wrap max-h-64 overflow-auto">
              {result.zeroShot.response || '(empty response)'}
            </div>

            <div className="border-t border-gray-700 pt-3">
              <p className="text-sm text-gray-400">Extracted Answer:</p>
              <p className="text-xl font-mono">{result.zeroShot.answer || '(none)'}</p>
            </div>
          </div>

          {/* Chain-of-Thought */}
          <div className="bg-gray-800 p-6 rounded-lg space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-green-400">Chain-of-Thought</h3>
              <span className="text-sm text-gray-400">{result.chainOfThought.latencyMs}ms</span>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              <p className="text-sm text-gray-400">
                Reasoning Steps ({result.chainOfThought.steps.length}):
              </p>
              {result.chainOfThought.steps.length > 0 ? (
                <ol className="space-y-2">
                  {result.chainOfThought.steps.map((step) => (
                    <li
                      key={step.stepNumber}
                      className="bg-gray-900 p-3 rounded text-sm flex gap-3"
                    >
                      <span className="text-blue-400 font-mono">#{step.stepNumber}</span>
                      <span>{step.content}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-gray-500 text-sm italic">No structured steps extracted</p>
              )}
            </div>

            <div className="border-t border-gray-700 pt-3 flex justify-between items-end">
              <div>
                <p className="text-sm text-gray-400">Final Answer:</p>
                <p className="text-xl font-mono">{result.chainOfThought.finalAnswer || '(none)'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Confidence:</p>
                <p className="text-lg font-mono">
                  {(result.chainOfThought.confidence * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Full response (collapsed) */}
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                Show full response
              </summary>
              <div className="bg-gray-900 p-3 rounded mt-2 whitespace-pre-wrap max-h-48 overflow-auto">
                {result.chainOfThought.fullResponse}
              </div>
            </details>
          </div>
        </section>
      )}

      {/* Key Concepts */}
      <section className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Key Concepts</h2>

        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="font-medium text-blue-400 mb-2">Why CoT Works</h3>
            <ul className="space-y-1 text-gray-400">
              <li>
                &bull; Forces model to show work, reducing errors
              </li>
              <li>
                &bull; Multi-step problems benefit most
              </li>
              <li>
                &bull; Simple &quot;think step by step&quot; significantly improves accuracy
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-green-400 mb-2">When to Use</h3>
            <ul className="space-y-1 text-gray-400">
              <li>&bull; Math word problems</li>
              <li>&bull; Logic puzzles</li>
              <li>&bull; Multi-step reasoning</li>
              <li>&bull; NOT for simple factual recall</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Code Reference */}
      <section className="bg-gray-800 rounded-lg p-4 text-sm">
        <h3 className="font-semibold mb-2">Study the Code</h3>
        <ul className="space-y-1 text-gray-400">
          <li>
            <code className="text-blue-400">lib/chain-of-thought.ts</code> - Prompts, step
            extraction, confidence estimation
          </li>
          <li>
            <code className="text-blue-400">lib/chain-of-thought.test.ts</code> - Tests for
            parsing logic
          </li>
        </ul>
      </section>
    </main>
  );
}
