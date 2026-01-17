'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { ChatInput } from '@examples/shared/components/chat/chat-input';
import { useLlama } from '@examples/shared/lib/hooks';
import { MessageSquare, RotateCcw, CheckCircle2, HelpCircle, AlertTriangle, BookOpen, ExternalLink } from 'lucide-react';
import type { AIMessage } from '@examples/shared/types';

export interface Source {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  relevanceScore?: number;
  verified?: boolean;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface EnrichedMessage extends AIMessage {
  metadata?: {
    confidence?: ConfidenceLevel;
    sources?: Source[];
    latencyMs?: number;
    tokenCount?: {
      input?: number;
      output?: number;
      total?: number;
    };
    model?: string;
    [key: string]: any;
  };
}

export interface ChatInterfaceProps {
  /** Optional title for the chat interface */
  title?: string;
  /** Optional description */
  description?: string;
  /** Optional icon component */
  icon?: React.ReactNode;
  /** Initial system prompt */
  systemPrompt?: string;
  /** Height of the chat container (default: 600px) */
  height?: string;
  /** Show metadata (model, tokens, latency) */
  showMetadata?: boolean;
  /** Show confidence indicators */
  showConfidence?: boolean;
  /** Show source citations */
  showSources?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Placeholder text for input */
  placeholder?: string;
  /** Callback when a message is sent */
  onMessageSent?: (message: string) => void;
  /** Custom message enrichment function */
  enrichMessage?: (message: AIMessage, index: number, allMessages: AIMessage[]) => EnrichedMessage;
}

function getConfidenceIcon(confidence?: ConfidenceLevel) {
  switch (confidence) {
    case 'high':
      return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    case 'medium':
      return <HelpCircle className="w-3 h-3 text-yellow-500" />;
    case 'low':
      return <AlertTriangle className="w-3 h-3 text-orange-500" />;
    default:
      return null;
  }
}

function getConfidenceColor(confidence?: ConfidenceLevel) {
  switch (confidence) {
    case 'high':
      return 'border-green-300 bg-green-50';
    case 'medium':
      return 'border-yellow-300 bg-yellow-50';
    case 'low':
      return 'border-orange-300 bg-orange-50';
    default:
      return 'border-border bg-background';
  }
}

/**
 * Production-ready chat interface component with streaming, confidence indicators, and citations.
 *
 * @example
 * ```tsx
 * import { ChatInterface } from '@examples/product-patterns/components/chat-interface';
 *
 * export default function MyPage() {
 *   return (
 *     <ChatInterface
 *       title="AI Assistant"
 *       showConfidence={true}
 *       showSources={true}
 *       showMetadata={true}
 *     />
 *   );
 * }
 * ```
 */
export function ChatInterface({
  title = 'AI Assistant',
  description,
  icon = <MessageSquare className="w-5 h-5 text-primary" />,
  systemPrompt,
  height = '600px',
  showMetadata = false,
  showConfidence = true,
  showSources = true,
  className = '',
  placeholder = 'Ask me anything...',
  onMessageSent,
  enrichMessage,
}: ChatInterfaceProps) {
  const { messages, isLoading, sendMessage, clearMessages } = useLlama();

  const handleSend = async (message: string) => {
    await sendMessage(message, systemPrompt);
    onMessageSent?.(message);
  };

  // Enrich messages with default or custom enrichment
  const enrichedMessages: EnrichedMessage[] = React.useMemo(() => {
    if (enrichMessage) {
      return messages.map((msg, idx) => enrichMessage(msg, idx, messages));
    }
    // Default enrichment (simple demo)
    return messages.map((msg) => msg as EnrichedMessage);
  }, [messages, enrichMessage]);

  const messageCount = messages.length;
  const hasMessages = messageCount > 0;

  return (
    <Card className={`flex flex-col ${className}`} style={{ height }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
            <CardDescription>
              {description || (hasMessages
                ? `${messageCount} message${messageCount !== 1 ? 's' : ''}`
                : 'Start a conversation')}
            </CardDescription>
          </div>
          {hasMessages && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearMessages}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto mb-4 space-y-4">
          {!hasMessages && (
            <div className="h-full flex items-center justify-center text-center">
              <div className="space-y-2">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  {icon}
                </div>
                <h3 className="text-lg font-semibold">Start a Conversation</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Send a message to begin chatting with the AI assistant.
                </p>
              </div>
            </div>
          )}

          {enrichedMessages.map((message) => (
            <div key={message.id} className="space-y-3">
              {/* Message Bubble */}
              <div
                className={`flex gap-3 p-4 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-50 dark:bg-blue-950/30 ml-auto max-w-[90%]'
                    : 'bg-slate-50 dark:bg-slate-900/30 max-w-[90%]'
                }`}
              >
                <div className="flex-1 space-y-2">
                  {/* Message Header */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground uppercase">
                      {message.role}
                    </span>

                    {/* Confidence Indicator */}
                    {showConfidence && message.role === 'assistant' && message.metadata?.confidence && (
                      <Badge
                        variant="outline"
                        className={`text-xs border ${getConfidenceColor(message.metadata.confidence)}`}
                      >
                        <span className="flex items-center gap-1">
                          {getConfidenceIcon(message.metadata.confidence)}
                          {message.metadata.confidence}
                        </span>
                      </Badge>
                    )}

                    {/* Metadata */}
                    {showMetadata && message.role === 'assistant' && (
                      <>
                        {message.metadata?.model && (
                          <Badge variant="secondary" className="text-xs">
                            {message.metadata.model}
                          </Badge>
                        )}
                        {message.metadata?.latencyMs && (
                          <Badge variant="secondary" className="text-xs">
                            {message.metadata.latencyMs}ms
                          </Badge>
                        )}
                        {message.metadata?.tokenCount?.total && (
                          <Badge variant="secondary" className="text-xs">
                            {message.metadata.tokenCount.total} tokens
                          </Badge>
                        )}
                      </>
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="prose prose-sm max-w-none">
                    {message.content}
                  </div>
                </div>
              </div>

              {/* Source Citations */}
              {showSources && message.role === 'assistant' && message.metadata?.sources && (
                <div className="ml-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
                    <BookOpen className="w-3 h-3" />
                    Sources ({(message.metadata.sources as Source[]).length})
                  </p>
                  {(message.metadata.sources as Source[]).map((source) => (
                    <div
                      key={source.id}
                      className={`p-3 rounded-lg border ${
                        source.verified
                          ? 'border-green-300 bg-green-50/50'
                          : 'border-border bg-background'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                            >
                              {source.title}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {source.excerpt}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          {source.verified && (
                            <Badge variant="success" className="text-xs flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Verified
                            </Badge>
                          )}
                          {source.relevanceScore && (
                            <Badge variant="secondary" className="text-xs">
                              {Math.round(source.relevanceScore * 100)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary truncate block"
                      >
                        {source.url}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/30 max-w-[90%]">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase">assistant</span>
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                </div>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <ChatInput
          onSend={handleSend}
          disabled={isLoading}
          placeholder={placeholder}
        />
      </CardContent>
    </Card>
  );
}
