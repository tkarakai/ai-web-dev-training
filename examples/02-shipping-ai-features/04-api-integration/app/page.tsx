'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { Input } from '@examples/shared/components/ui/input';
import { Message } from '@examples/shared/components/chat/message';
import { generateId } from '@examples/shared/lib/utils';
import {
  Zap,
  RefreshCw,
  Clock,
  Database,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Timer,
  Info,
  Trash2,
} from 'lucide-react';
import {
  responseCache,
  rateLimiter,
  withRetry,
  generateIdempotencyKey,
  requestDeduplicator,
} from '../lib/api-utils';
import type { AIMessage } from '@examples/shared/types';

interface RequestLog {
  id: string;
  timestamp: Date;
  prompt: string;
  cacheHit: boolean;
  attempts: number;
  latencyMs: number;
  success: boolean;
  error?: string;
  idempotencyKey?: string;
}

export default function ApiIntegrationPage() {
  const [prompt, setPrompt] = React.useState('Explain API caching in one sentence.');
  const [messages, setMessages] = React.useState<AIMessage[]>([]);
  const [requestLogs, setRequestLogs] = React.useState<RequestLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // Settings
  const [enableCache, setEnableCache] = React.useState(true);
  const [enableRetry, setEnableRetry] = React.useState(true);
  const [enableRateLimit, setEnableRateLimit] = React.useState(true);
  const [enableIdempotency, setEnableIdempotency] = React.useState(true);
  const [maxRetries, setMaxRetries] = React.useState(3);
  const [simulateError, setSimulateError] = React.useState(false);

  const [cacheStats, setCacheStats] = React.useState({ size: 0 });
  const [rateLimitStatus, setRateLimitStatus] = React.useState(rateLimiter.getStatus());

  // Update rate limiter status periodically
  React.useEffect(() => {
    const interval = setInterval(() => {
      setRateLimitStatus(rateLimiter.getStatus());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const makeRequest = async () => {
    const startTime = Date.now();
    const idempotencyKey = enableIdempotency ? generateIdempotencyKey(prompt) : undefined;

    const log: RequestLog = {
      id: generateId('log'),
      timestamp: new Date(),
      prompt,
      cacheHit: false,
      attempts: 0,
      latencyMs: 0,
      success: false,
      idempotencyKey,
    };

    setIsLoading(true);

    try {
      // Check rate limit
      if (enableRateLimit && !rateLimiter.canProceed()) {
        const waitTime = rateLimiter.getWaitTime();
        log.error = `Rate limited. Wait ${waitTime}ms`;
        log.latencyMs = Date.now() - startTime;
        setRequestLogs(prev => [{ ...log, id: generateId('log') }, ...prev].slice(0, 10));

        const message: AIMessage = {
          id: generateId('msg'),
          role: 'assistant',
          content: `Error: Rate limited. Please wait ${waitTime}ms`,
          timestamp: new Date(),
          metadata: { error: log.error },
        };
        setMessages(prev => [...prev, message]);
        setIsLoading(false);
        return;
      }

      if (enableRateLimit) {
        rateLimiter.consume();
        setRateLimitStatus(rateLimiter.getStatus());
      }

      // Check cache
      if (enableCache) {
        const cached = responseCache.get(prompt, { model: 'gpt-oss-20b' });
        if (cached) {
          log.cacheHit = true;
          log.success = true;
          log.latencyMs = Date.now() - startTime;
          log.attempts = 0;
          setRequestLogs(prev => [log, ...prev].slice(0, 10));

          const message: AIMessage = {
            id: generateId('msg'),
            role: 'assistant',
            content: cached.content,
            timestamp: new Date(),
            metadata: {
              model: 'gpt-oss-20b',
              latencyMs: log.latencyMs,
              cacheHit: true,
            },
          };
          setMessages(prev => [...prev, message]);
          return;
        }
      }

      // Make API call (with retry if enabled)
      const apiCall = async () => {
        // Simulate error if enabled
        if (simulateError && Math.random() < 0.7) {
          throw new Error('Simulated API error');
        }

        const response = await fetch('http://127.0.0.1:8033/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
          },
          body: JSON.stringify({
            model: 'gpt-oss-20b',
            messages: [
              { role: 'system', content: 'You are a helpful AI assistant. Be concise.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
      };

      let data;
      if (enableRetry) {
        const result = await withRetry(apiCall, {
          maxRetries,
          baseDelay: 1000,
          retryOn: (error) => {
            // Retry on network errors or 5xx errors
            return error.message.includes('HTTP 5') || error.message.includes('fetch');
          },
        });
        data = result.result;
        log.attempts = result.attempts;
      } else {
        data = await apiCall();
        log.attempts = 1;
      }

      const content = data.choices?.[0]?.message?.content || 'No response';

      // Cache the response
      if (enableCache) {
        responseCache.set(prompt, { model: 'gpt-oss-20b' }, { content });
        setCacheStats({ size: responseCache.size });
      }

      log.success = true;
      log.latencyMs = Date.now() - startTime;
      setRequestLogs(prev => [log, ...prev].slice(0, 10));

      const message: AIMessage = {
        id: generateId('msg'),
        role: 'assistant',
        content,
        timestamp: new Date(),
        metadata: {
          model: 'gpt-oss-20b',
          latencyMs: log.latencyMs,
          tokenCount: data.usage ? {
            input: data.usage.prompt_tokens,
            output: data.usage.completion_tokens,
            total: data.usage.total_tokens,
          } : undefined,
          attempts: log.attempts,
          cacheHit: false,
          idempotencyKey,
        },
      };
      setMessages(prev => [...prev, message]);
    } catch (error) {
      log.error = error instanceof Error ? error.message : 'Unknown error';
      log.latencyMs = Date.now() - startTime;
      setRequestLogs(prev => [log, ...prev].slice(0, 10));

      const message: AIMessage = {
        id: generateId('msg'),
        role: 'assistant',
        content: `Error: ${log.error}`,
        timestamp: new Date(),
        metadata: { error: log.error },
      };
      setMessages(prev => [...prev, message]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!prompt.trim() || isLoading) return;

    const userMessage: AIMessage = {
      id: generateId('msg'),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    await makeRequest();
  };

  const clearCache = () => {
    responseCache.clear();
    setCacheStats({ size: 0 });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">API Integration</h1>
        <p className="text-muted-foreground">
          Resilient LLM API calls: caching, retry logic, rate limiting, and idempotency
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          📖 <Link href="https://github.com/yourusername/ai-web-dev-training/blob/main/docs/04-shipping-ai-features/api-integration.md" className="text-primary hover:underline">Read the documentation</Link>
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Settings */}
        <div className="space-y-4">
          {/* Feature Toggles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableCache}
                  onChange={(e) => setEnableCache(e.target.checked)}
                  className="w-4 h-4"
                />
                <Database className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Response Caching</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableRetry}
                  onChange={(e) => setEnableRetry(e.target.checked)}
                  className="w-4 h-4"
                />
                <RefreshCw className="w-4 h-4 text-green-500" />
                <span className="text-sm">Retry with Backoff</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableRateLimit}
                  onChange={(e) => setEnableRateLimit(e.target.checked)}
                  className="w-4 h-4"
                />
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-sm">Rate Limiting</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableIdempotency}
                  onChange={(e) => setEnableIdempotency(e.target.checked)}
                  className="w-4 h-4"
                />
                <Shield className="w-4 h-4 text-purple-500" />
                <span className="text-sm">Idempotency Keys</span>
              </label>
              <div className="pt-2 border-t">
                <label className="flex items-center gap-2 cursor-pointer text-orange-600">
                  <input
                    type="checkbox"
                    checked={simulateError}
                    onChange={(e) => setSimulateError(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">Simulate 70% Error Rate</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Retry Settings */}
          {enableRetry && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Retry Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <label className="text-sm text-muted-foreground">Max Retries</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-4">{maxRetries}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status Cards */}
          {enableCache && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-500" />
                    Cache Status
                  </span>
                  <Button size="sm" variant="outline" onClick={clearCache}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cacheStats.size}</div>
                <div className="text-xs text-muted-foreground">cached responses</div>
              </CardContent>
            </Card>
          )}

          {enableRateLimit && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  Rate Limit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 transition-all"
                      style={{ width: `${(rateLimitStatus.tokens / rateLimitStatus.maxTokens) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {rateLimitStatus.tokens}/{rateLimitStatus.maxTokens}
                  </span>
                </div>
                {rateLimitStatus.waitTime > 0 && (
                  <p className="text-xs text-orange-500 mt-1">
                    Wait {rateLimitStatus.waitTime}ms for next request
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Info className="w-4 h-4 text-primary" />
                Key Concepts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <div>
                <strong className="text-foreground">Caching:</strong> Store responses to avoid redundant API calls.
              </div>
              <div>
                <strong className="text-foreground">Retry:</strong> Exponential backoff for transient failures.
              </div>
              <div>
                <strong className="text-foreground">Rate Limiting:</strong> Token bucket to prevent abuse.
              </div>
              <div>
                <strong className="text-foreground">Idempotency:</strong> Unique keys to prevent duplicate processing.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Middle Column - Chat */}
        <div className="space-y-4">
          <Card className="h-[500px] flex flex-col">
            <CardHeader>
              <CardTitle>Test API Integration</CardTitle>
              <CardDescription>
                Send requests to see integration features in action
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto mb-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-muted-foreground">
                    <div>
                      <Zap className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Send a request to test</p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <Message
                      key={message.id}
                      message={message}
                      showMetadata={true}
                      showRawData={false}
                    />
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter prompt..."
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <Button onClick={handleSend} disabled={isLoading}>
                  {isLoading ? <Timer className="w-4 h-4 animate-spin" /> : 'Send'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setMessages([]);
              setRequestLogs([]);
            }}
          >
            Clear All
          </Button>
        </div>

        {/* Right Column - Request Logs */}
        <div className="space-y-4">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Timer className="w-4 h-4" />
                Request Log
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-3">
              {requestLogs.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  No requests yet
                </div>
              ) : (
                requestLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg border text-sm ${
                      log.success
                        ? 'border-green-200 bg-green-50/50'
                        : 'border-red-200 bg-red-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {log.success ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className="font-medium">
                          {log.success ? 'Success' : 'Failed'}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex gap-2 flex-wrap">
                        {log.cacheHit && (
                          <Badge variant="secondary" className="text-xs">
                            <Database className="w-3 h-3 mr-1" />
                            Cache Hit
                          </Badge>
                        )}
                        {log.attempts > 1 && (
                          <Badge variant="secondary" className="text-xs">
                            <RefreshCw className="w-3 h-3 mr-1" />
                            {log.attempts} attempts
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {log.latencyMs}ms
                        </Badge>
                      </div>
                      {log.idempotencyKey && (
                        <div className="text-muted-foreground truncate">
                          Key: {log.idempotencyKey}
                        </div>
                      )}
                      {log.error && (
                        <div className="text-red-600">{log.error}</div>
                      )}
                      <div className="text-muted-foreground truncate">
                        "{log.prompt.slice(0, 40)}..."
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
