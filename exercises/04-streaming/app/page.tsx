'use client';

import { useState, useRef, useCallback } from 'react';
import {
  runStream,
  createInitialState,
  type StreamState,
  type StreamMetrics,
} from '@/lib/streaming';

/**
 * Streaming Responses Demo
 *
 * Watch tokens appear in real-time. Compare streaming vs non-streaming.
 *
 * REQUIRES: llama-server running on port 8033
 */

export default function StreamingPage() {
  const [prompt, setPrompt] = useState('Write a short poem about coding.');
  const [streamState, setStreamState] = useState<StreamState>(createInitialState());
  const [nonStreamResponse, setNonStreamResponse] = useState('');
  const [nonStreamTime, setNonStreamTime] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async () => {
    // Cancel any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setStreamState({
      content: '',
      isStreaming: true,
      error: null,
      metrics: null,
    });

    await runStream({
      messages: [{ role: 'user', content: prompt }],
      signal: abortControllerRef.current.signal,
      onChunk: (content) => {
        setStreamState((prev) => ({
          ...prev,
          content,
        }));
      },
      onComplete: (content, metrics) => {
        setStreamState({
          content,
          isStreaming: false,
          error: null,
          metrics,
        });
      },
      onError: (error) => {
        setStreamState((prev) => ({
          ...prev,
          isStreaming: false,
          error: error.message,
        }));
      },
    });
  }, [prompt]);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const runNonStreaming = useCallback(async () => {
    setNonStreamResponse('');
    setNonStreamTime(null);

    const start = Date.now();

    try {
      const res = await fetch('http://127.0.0.1:8033/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1024,
          stream: false,
        }),
      });

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? '';

      setNonStreamResponse(content);
      setNonStreamTime(Date.now() - start);
    } catch (e) {
      setNonStreamResponse(`Error: ${e instanceof Error ? e.message : 'Unknown'}`);
    }
  }, [prompt]);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Exercise 04: Streaming Responses</h1>
        <p className="text-gray-400 mt-2">
          Study <code className="text-blue-400">lib/streaming.ts</code> - SSE parsing, AsyncGenerators, state management.
        </p>
      </header>

      {/* Input */}
      <section className="space-y-4 bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold">Prompt</h2>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full h-24 bg-gray-900 border border-gray-700 rounded-lg p-3 font-mono text-sm"
          placeholder="Enter a prompt..."
        />
        <div className="flex gap-4">
          <button
            onClick={startStream}
            disabled={streamState.isStreaming}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg font-medium"
          >
            {streamState.isStreaming ? 'Streaming...' : 'Stream Response'}
          </button>
          {streamState.isStreaming && (
            <button
              onClick={stopStream}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-medium"
            >
              Stop
            </button>
          )}
          <button
            onClick={runNonStreaming}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium"
          >
            Non-Streaming (for comparison)
          </button>
        </div>
      </section>

      {/* Streaming Output */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Streaming Output</h2>
          {streamState.isStreaming && (
            <span className="text-sm text-green-400 animate-pulse">
              Receiving...
            </span>
          )}
        </div>

        <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg min-h-[200px]">
          {streamState.error ? (
            <p className="text-red-400">{streamState.error}</p>
          ) : (
            <p className="whitespace-pre-wrap">
              {streamState.content || (
                <span className="text-gray-500">Response will appear here...</span>
              )}
              {streamState.isStreaming && (
                <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-1" />
              )}
            </p>
          )}
        </div>

        {streamState.metrics && <MetricsDisplay metrics={streamState.metrics} />}
      </section>

      {/* Non-Streaming Output */}
      {(nonStreamResponse || nonStreamTime !== null) && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Non-Streaming Output</h2>
          <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
            <p className="whitespace-pre-wrap">{nonStreamResponse}</p>
          </div>
          {nonStreamTime !== null && (
            <p className="text-sm text-gray-400">
              Total time: {nonStreamTime}ms (user waited entire time before seeing anything)
            </p>
          )}
        </section>
      )}

      {/* Comparison */}
      {streamState.metrics && nonStreamTime !== null && (
        <section className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
          <h3 className="font-semibold mb-2">Comparison</h3>
          <p className="text-sm text-gray-300">
            <strong>Time to first token (streaming):</strong> {streamState.metrics.firstTokenMs}ms
          </p>
          <p className="text-sm text-gray-300">
            <strong>Time to see response (non-streaming):</strong> {nonStreamTime}ms
          </p>
          <p className="text-sm text-gray-400 mt-2">
            With streaming, users see content{' '}
            <strong className="text-green-400">
              {Math.round(nonStreamTime / streamState.metrics.firstTokenMs)}x faster
            </strong>
            .
          </p>
        </section>
      )}

      {/* Code Reference */}
      <section className="bg-gray-800 rounded-lg p-4 text-sm">
        <h3 className="font-semibold mb-2">Study the Code</h3>
        <ul className="space-y-1 text-gray-400">
          <li>
            <code className="text-blue-400">lib/streaming.ts</code> - SSE parser, stream client, accumulator
          </li>
          <li>
            <code className="text-blue-400">lib/streaming.test.ts</code> - Tests for accumulator
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

function MetricsDisplay({ metrics }: { metrics: StreamMetrics }) {
  return (
    <div className="flex gap-6 text-sm">
      <div>
        <span className="text-gray-500">First token:</span>{' '}
        <span className="font-mono">{metrics.firstTokenMs}ms</span>
      </div>
      <div>
        <span className="text-gray-500">Total time:</span>{' '}
        <span className="font-mono">{metrics.totalMs}ms</span>
      </div>
      <div>
        <span className="text-gray-500">Tokens:</span>{' '}
        <span className="font-mono">{metrics.tokenCount}</span>
      </div>
      <div>
        <span className="text-gray-500">Speed:</span>{' '}
        <span className="font-mono">{metrics.tokensPerSecond.toFixed(1)} tok/s</span>
      </div>
    </div>
  );
}
