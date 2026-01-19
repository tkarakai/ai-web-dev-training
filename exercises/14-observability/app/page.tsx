'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * Observability & Tracing Demo
 *
 * Monitor LLM operations with spans, traces, and metrics.
 *
 * REQUIRES: llama-server running on port 8033
 */

interface Span {
  id: string;
  name: string;
  duration?: number;
  status: 'running' | 'success' | 'error';
  attributes: Record<string, unknown>;
}

interface Trace {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  spans: Span[];
}

interface Metrics {
  requestCount: number;
  totalTokens: number;
  totalCost: number;
  avgLatencyMs: number;
  errorCount: number;
  cacheHits: number;
  cacheMisses: number;
}

export default function ObservabilityPage() {
  const [prompt, setPrompt] = useState('Explain TypeScript in one sentence.');
  const [traces, setTraces] = useState<Trace[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<any>(null);

  const initClient = useCallback(async () => {
    if (!clientRef.current) {
      const { InstrumentedClient } = await import('@/lib/observability');
      clientRef.current = new InstrumentedClient();
    }
    return clientRef.current;
  }, []);

  const sendRequest = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const client = await initClient();

      // Start trace
      client.startTrace('user-query', { prompt: prompt.slice(0, 50) });

      // Make request
      await client.chat([{ role: 'user', content: prompt }]);

      // End trace
      const trace = client.endCurrentTrace();

      // Update state
      setTraces(client.getRecentTraces(10));
      setMetrics(client.getMetrics());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    }

    setIsLoading(false);
  }, [prompt, initClient]);

  const sendBurst = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const client = await initClient();

      // Send 5 requests
      for (let i = 0; i < 5; i++) {
        client.startTrace(`burst-${i + 1}`);
        await client.chat([{ role: 'user', content: `Question ${i + 1}: ${prompt}` }]);
        client.endCurrentTrace();
      }

      setTraces(client.getRecentTraces(10));
      setMetrics(client.getMetrics());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Burst failed');
    }

    setIsLoading(false);
  }, [prompt, initClient]);

  const resetMetrics = useCallback(async () => {
    const client = await initClient();
    client.reset();
    setTraces([]);
    setMetrics(null);
  }, [initClient]);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Exercise 14: Observability & Tracing</h1>
        <p className="text-gray-400 mt-2">
          Study <code className="text-blue-400">lib/observability.ts</code> - monitor LLM
          operations.
        </p>
      </header>

      {/* Controls */}
      <section className="bg-gray-800 p-6 rounded-lg space-y-4">
        <h2 className="text-xl font-semibold">Send Requests</h2>

        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-2"
          placeholder="Enter prompt..."
        />

        <div className="flex gap-4">
          <button
            onClick={sendRequest}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg"
          >
            {isLoading ? 'Sending...' : 'Send Single'}
          </button>
          <button
            onClick={sendBurst}
            disabled={isLoading}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 rounded-lg"
          >
            Send Burst (5x)
          </button>
          <button
            onClick={resetMetrics}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
          >
            Reset
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-sm">
            Error: {error}. Is llama-server running on port 8033?
          </p>
        )}
      </section>

      {/* Metrics Dashboard */}
      {metrics && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Requests" value={metrics.requestCount} />
            <MetricCard label="Tokens" value={metrics.totalTokens.toLocaleString()} />
            <MetricCard label="Cost" value={`$${metrics.totalCost.toFixed(4)}`} />
            <MetricCard label="Avg Latency" value={`${metrics.avgLatencyMs.toFixed(0)}ms`} />
            <MetricCard
              label="Errors"
              value={metrics.errorCount}
              color={metrics.errorCount > 0 ? 'red' : 'green'}
            />
            <MetricCard label="Cache Hits" value={metrics.cacheHits} />
            <MetricCard label="Cache Misses" value={metrics.cacheMisses} />
            <MetricCard
              label="Hit Rate"
              value={`${(
                (metrics.cacheHits / Math.max(metrics.cacheHits + metrics.cacheMisses, 1)) *
                100
              ).toFixed(0)}%`}
            />
          </div>
        </section>
      )}

      {/* Traces */}
      {traces.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Recent Traces ({traces.length})</h2>
          <div className="space-y-3">
            {traces.map((trace) => (
              <TraceCard key={trace.id} trace={trace} />
            ))}
          </div>
        </section>
      )}

      {/* Concepts */}
      <section className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Key Concepts</h2>
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <ConceptCard
            title="Spans"
            description="Individual operations with timing, status, and attributes. Nested spans show call hierarchy."
          />
          <ConceptCard
            title="Traces"
            description="Group of related spans forming a complete request flow. Track end-to-end latency."
          />
          <ConceptCard
            title="Metrics"
            description="Aggregated data: request counts, token usage, costs, latencies, error rates."
          />
          <ConceptCard
            title="Logging"
            description="Structured logs with trace context for debugging and analysis."
          />
        </div>
      </section>

      {/* Code Reference */}
      <section className="bg-gray-800 rounded-lg p-4 text-sm">
        <h3 className="font-semibold mb-2">Study the Code</h3>
        <ul className="space-y-1 text-gray-400">
          <li>
            <code className="text-blue-400">lib/observability.ts</code> - Spans, traces, metrics,
            instrumented client
          </li>
          <li>
            <code className="text-blue-400">lib/observability.test.ts</code> - Unit tests
          </li>
        </ul>
      </section>
    </main>
  );
}

// =============================================================================
// Components
// =============================================================================

function MetricCard({
  label,
  value,
  color = 'blue',
}: {
  label: string;
  value: string | number;
  color?: 'blue' | 'green' | 'red' | 'gray';
}) {
  const colors = {
    blue: 'border-blue-700 bg-blue-900/20',
    green: 'border-green-700 bg-green-900/20',
    red: 'border-red-700 bg-red-900/20',
    gray: 'border-gray-700 bg-gray-800/50',
  };

  return (
    <div className={`p-4 rounded-lg border ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

function TraceCard({ trace }: { trace: Trace }) {
  const [expanded, setExpanded] = useState(false);
  const duration = trace.endTime ? trace.endTime - trace.startTime : 0;
  const hasError = trace.spans.some((s) => s.status === 'error');

  return (
    <div
      className={`rounded-lg border ${
        hasError ? 'border-red-700 bg-red-900/10' : 'border-gray-700 bg-gray-800/50'
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex justify-between items-center text-left"
      >
        <div className="flex items-center gap-3">
          <span className={hasError ? 'text-red-400' : 'text-green-400'}>
            {hasError ? '✗' : '✓'}
          </span>
          <div>
            <p className="font-medium">{trace.name}</p>
            <p className="text-xs text-gray-500 font-mono">{trace.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>{trace.spans.length} spans</span>
          <span>{duration}ms</span>
          <span>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && trace.spans.length > 0 && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-700/50 pt-3">
          {trace.spans.map((span) => (
            <div
              key={span.id}
              className={`p-2 rounded text-sm ${
                span.status === 'error' ? 'bg-red-900/30' : 'bg-gray-900/50'
              }`}
            >
              <div className="flex justify-between">
                <span className="font-mono">{span.name}</span>
                <span className="text-gray-400">{span.duration || 0}ms</span>
              </div>
              {Object.keys(span.attributes).length > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {Object.entries(span.attributes)
                    .slice(0, 3)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConceptCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-gray-900/50 p-4 rounded">
      <h3 className="font-medium text-blue-400">{title}</h3>
      <p className="text-gray-400 text-sm mt-1">{description}</p>
    </div>
  );
}
