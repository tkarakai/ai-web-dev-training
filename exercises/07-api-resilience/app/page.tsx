'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  ResilientClient,
  PromptCache,
  RateLimiter,
  CircuitBreaker,
} from '@/lib/resilience';

/**
 * API Resilience Demo
 *
 * See caching, rate limiting, and circuit breaker in action.
 *
 * REQUIRES: llama-server running on port 8033
 */

interface RequestLog {
  id: number;
  prompt: string;
  result: 'success' | 'cached' | 'rate_limited' | 'error';
  response?: string;
  latencyMs: number;
  timestamp: Date;
}

export default function APIResiliencePage() {
  const [prompt, setPrompt] = useState('What is 2+2?');
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [requestId, setRequestId] = useState(0);

  // Create client with all resilience features
  const client = useMemo(
    () =>
      new ResilientClient({
        baseUrl: 'http://127.0.0.1:8033',
        cache: new PromptCache(30000), // 30s cache
        rateLimiter: new RateLimiter({ maxTokens: 5, refillRate: 1, refillInterval: 2000 }),
        circuitBreaker: new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 10000 }),
        retryOptions: { maxAttempts: 2, baseDelayMs: 500 },
      }),
    []
  );

  const sendRequest = useCallback(async () => {
    setIsLoading(true);
    const start = Date.now();
    const id = requestId + 1;
    setRequestId(id);

    try {
      // Check if cached (peek)
      const stats = client.getStats();
      const wasCached = stats.cache.size > 0;

      const response = await client.chat(
        [{ role: 'user', content: prompt }],
        { temperature: 0 } // Deterministic for caching demo
      );

      const newStats = client.getStats();
      const isCached = newStats.cache.size > stats.cache.size ? false : wasCached;

      setLogs((prev) => [
        {
          id,
          prompt,
          result: isCached ? 'cached' : 'success',
          response: response.slice(0, 200),
          latencyMs: Date.now() - start,
          timestamp: new Date(),
        },
        ...prev.slice(0, 19),
      ]);
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      setLogs((prev) => [
        {
          id,
          prompt,
          result: error.includes('Circuit') ? 'rate_limited' : 'error',
          response: error,
          latencyMs: Date.now() - start,
          timestamp: new Date(),
        },
        ...prev.slice(0, 19),
      ]);
    }

    setIsLoading(false);
  }, [client, prompt, requestId]);

  const burstRequests = useCallback(async () => {
    // Send 8 requests quickly to test rate limiting
    for (let i = 0; i < 8; i++) {
      sendRequest();
      await new Promise((r) => setTimeout(r, 100));
    }
  }, [sendRequest]);

  const stats = client.getStats();

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Exercise 07: API Resilience</h1>
        <p className="text-gray-400 mt-2">
          Study <code className="text-blue-400">lib/resilience.ts</code> - caching, retry, rate limiting, circuit breaker.
        </p>
      </header>

      {/* Stats Dashboard */}
      <section className="grid grid-cols-3 gap-4">
        <StatCard
          title="Cache"
          stats={[
            { label: 'Entries', value: stats.cache.size },
          ]}
        />
        <StatCard
          title="Rate Limiter"
          stats={[
            { label: 'Tokens', value: `${stats.rateLimiter.tokens}/${stats.rateLimiter.maxTokens}` },
          ]}
        />
        <StatCard
          title="Circuit Breaker"
          stats={[
            { label: 'State', value: stats.circuitBreaker.state },
            { label: 'Failures', value: stats.circuitBreaker.failures },
          ]}
          status={stats.circuitBreaker.state === 'closed' ? 'ok' : stats.circuitBreaker.state === 'open' ? 'error' : 'warning'}
        />
      </section>

      {/* Input */}
      <section className="bg-gray-800 p-6 rounded-lg space-y-4">
        <h2 className="text-xl font-semibold">Send Request</h2>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2"
          placeholder="Enter prompt..."
        />
        <div className="flex gap-4">
          <button
            onClick={sendRequest}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg"
          >
            {isLoading ? 'Sending...' : 'Send Single Request'}
          </button>
          <button
            onClick={burstRequests}
            className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg"
          >
            Burst 8 Requests (test rate limiting)
          </button>
        </div>
        <p className="text-sm text-gray-400">
          Tip: Send the same prompt twice to see caching. Burst to see rate limiting.
        </p>
      </section>

      {/* Request Log */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Request Log</h2>
        <div className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-gray-500">No requests yet</p>
          ) : (
            logs.map((log) => <LogEntry key={log.id} log={log} />)
          )}
        </div>
      </section>

      {/* Code Reference */}
      <section className="bg-gray-800 rounded-lg p-4 text-sm">
        <h3 className="font-semibold mb-2">Study the Code</h3>
        <ul className="space-y-1 text-gray-400">
          <li>
            <code className="text-blue-400">lib/resilience.ts</code> - Cache, retry, rate limiter, circuit breaker
          </li>
          <li>
            <code className="text-blue-400">lib/resilience.test.ts</code> - Tests for each component
          </li>
        </ul>
      </section>
    </main>
  );
}

// =============================================================================
// Components
// =============================================================================

function StatCard({
  title,
  stats,
  status = 'ok',
}: {
  title: string;
  stats: Array<{ label: string; value: string | number }>;
  status?: 'ok' | 'warning' | 'error';
}) {
  const statusColors = {
    ok: 'border-green-700 bg-green-900/20',
    warning: 'border-yellow-700 bg-yellow-900/20',
    error: 'border-red-700 bg-red-900/20',
  };

  return (
    <div className={`p-4 rounded-lg border ${statusColors[status]}`}>
      <h3 className="font-medium mb-2">{title}</h3>
      {stats.map((stat) => (
        <div key={stat.label} className="flex justify-between text-sm">
          <span className="text-gray-400">{stat.label}</span>
          <span className="font-mono">{stat.value}</span>
        </div>
      ))}
    </div>
  );
}

function LogEntry({ log }: { log: RequestLog }) {
  const colors = {
    success: 'border-green-700 bg-green-900/10',
    cached: 'border-blue-700 bg-blue-900/10',
    rate_limited: 'border-yellow-700 bg-yellow-900/10',
    error: 'border-red-700 bg-red-900/10',
  };

  const labels = {
    success: 'OK',
    cached: 'CACHED',
    rate_limited: 'RATE LIMITED',
    error: 'ERROR',
  };

  return (
    <div className={`p-3 rounded border ${colors[log.result]}`}>
      <div className="flex justify-between items-start mb-1">
        <span className="text-xs font-medium">
          {labels[log.result]} - {log.latencyMs}ms
        </span>
        <span className="text-xs text-gray-500">
          {log.timestamp.toLocaleTimeString()}
        </span>
      </div>
      <p className="text-sm text-gray-400 truncate">Prompt: {log.prompt}</p>
      {log.response && (
        <p className="text-sm mt-1 truncate">{log.response}</p>
      )}
    </div>
  );
}
