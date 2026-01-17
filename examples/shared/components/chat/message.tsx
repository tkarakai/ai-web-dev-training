'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import { cn, formatRelativeTime } from '../../lib/utils';
import { Badge } from '../ui/badge';
import type { AIMessage } from '../../types';
import { User, Bot, Settings } from 'lucide-react';

export interface MessageProps {
  message: AIMessage;
  showMetadata?: boolean;
  showRawData?: boolean;
  className?: string;
}

/**
 * Message component for displaying chat messages
 * Implements patterns from product-patterns-ux.md
 */
export function Message({ message, showMetadata = false, showRawData = false, className }: MessageProps) {
  const [showRequest, setShowRequest] = React.useState(false);
  const [showResponse, setShowResponse] = React.useState(false);
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isSystem = message.role === 'system';

  return (
    <div
      className={cn(
        'flex w-full gap-3 p-4 rounded-lg transition-all',
        isUser && 'bg-blue-50 dark:bg-blue-950/30 flex-row-reverse',
        isAssistant && 'bg-slate-50 dark:bg-slate-900/30',
        isSystem && 'bg-amber-50 dark:bg-amber-950/30',
        className
      )}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center',
            isUser && 'bg-primary text-primary-foreground',
            isAssistant && 'bg-secondary text-secondary-foreground',
            isSystem && 'bg-accent text-accent-foreground'
          )}
        >
          {isUser && <User className="w-4 h-4" />}
          {isAssistant && <Bot className="w-4 h-4" />}
          {isSystem && <Settings className="w-4 h-4" />}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2 overflow-hidden">
        {/* Message header */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">
            {isUser && 'You'}
            {isAssistant && 'Assistant'}
            {isSystem && 'System'}
          </span>
          <span>•</span>
          <span>{formatRelativeTime(message.timestamp)}</span>
        </div>

        {/* Message content */}
        <div className={cn('prose prose-sm dark:prose-invert max-w-none', 'markdown-content')}>
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>

        {/* Confidence indicator (for assistant messages) */}
        {isAssistant && message.metadata?.confidence && (
          <div className="flex items-center gap-2 mt-2">
            <Badge
              variant={
                message.metadata.confidence === 'high'
                  ? 'success'
                  : message.metadata.confidence === 'medium'
                    ? 'warning'
                    : 'destructive'
              }
            >
              {message.metadata.confidence} confidence
            </Badge>
          </div>
        )}

        {/* Sources (if available) */}
        {message.metadata?.sources && message.metadata.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-xs font-medium text-muted-foreground mb-2">Sources:</div>
            <div className="space-y-1">
              {message.metadata.sources.map((source, idx) => (
                <a
                  key={source.id}
                  href={source.url || '#'}
                  className="block text-xs text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  [{idx + 1}] {source.title}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Metadata (token count, latency, etc.) */}
        {showMetadata && message.metadata && (
          <div className="mt-2 text-xs text-muted-foreground space-y-1">
            {message.metadata.model && (
              <div>Model: {message.metadata.model}</div>
            )}
            {message.metadata.latencyMs && (
              <div>Latency: {message.metadata.latencyMs}ms</div>
            )}
            {message.metadata.tokenCount && (
              <div>
                Tokens:{' '}
                {message.metadata.tokenCount.input || (message.content.length > 0 ? '?' : 0)} in,{' '}
                {message.metadata.tokenCount.output || (isAssistant && message.content.length > 0 ? '?' : 0)} out
              </div>
            )}
          </div>
        )}

        {/* Error indicator */}
        {message.metadata?.error && (
          <div className="mt-2 p-2 bg-destructive/10 border border-destructive rounded text-sm text-destructive">
            Error: {message.metadata.error}
          </div>
        )}

        {/* Raw HTTP Request/Response (for educational purposes) */}
        {showRawData && isAssistant && message.metadata?.rawRequest && (
          <div className="mt-3 space-y-2">
            <div className="border border-border rounded">
              <button
                onClick={() => setShowRequest(!showRequest)}
                className="w-full text-left px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-between"
              >
                <span>HTTP Request</span>
                <span className="text-muted-foreground">{showRequest ? '▼' : '▶'}</span>
              </button>
              {showRequest && (
                <div className="p-3 text-xs font-mono overflow-x-auto">
                  <div className="text-blue-600 dark:text-blue-400 font-bold">
                    {message.metadata.rawRequest.method} {message.metadata.rawRequest.url}
                  </div>
                  <div className="mt-2 text-muted-foreground">Headers:</div>
                  <pre className="mt-1">{JSON.stringify(message.metadata.rawRequest.headers, null, 2)}</pre>
                  <div className="mt-2 text-muted-foreground">Body:</div>
                  <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(message.metadata.rawRequest.body, null, 2)}</pre>
                </div>
              )}
            </div>

            {message.metadata.rawResponse && (
              <div className="border border-border rounded">
                <button
                  onClick={() => setShowResponse(!showResponse)}
                  className="w-full text-left px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-between"
                >
                  <span>HTTP Response</span>
                  <span className="text-muted-foreground">{showResponse ? '▼' : '▶'}</span>
                </button>
                {showResponse && (
                  <div className="p-3 text-xs font-mono overflow-x-auto">
                    <div className="text-green-600 dark:text-green-400 font-bold">
                      Status: {message.metadata.rawResponse.status || 200} OK
                    </div>
                    {message.metadata.rawResponse.headers && (
                      <>
                        <div className="mt-2 text-muted-foreground">Headers:</div>
                        <pre className="mt-1">{JSON.stringify(message.metadata.rawResponse.headers, null, 2)}</pre>
                      </>
                    )}
                    <div className="mt-2 text-muted-foreground">Body:</div>
                    <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(message.metadata.rawResponse.body, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Typing indicator component
 */
export function TypingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 p-4', className)}>
      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
        <Bot className="w-4 h-4" />
      </div>
      <div className="typing-indicator">
        <span className="opacity-40"></span>
        <span className="opacity-40"></span>
        <span className="opacity-40"></span>
      </div>
    </div>
  );
}
