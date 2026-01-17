'use client';

import * as React from 'react';
import { Message, TypingIndicator } from './message';
import { cn } from '../../lib/utils';
import type { AIMessage } from '../../types';

export interface ChatThreadProps {
  messages: AIMessage[];
  isLoading?: boolean;
  showMetadata?: boolean;
  showRawData?: boolean;
  className?: string;
  autoScroll?: boolean;
}

/**
 * Chat thread component for displaying a list of messages
 */
export function ChatThread({
  messages,
  isLoading = false,
  showMetadata = false,
  showRawData = false,
  className,
  autoScroll = true,
}: ChatThreadProps) {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, autoScroll]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center text-muted-foreground">
          <p className="text-sm">No messages yet</p>
          <p className="text-xs mt-1">Start a conversation by sending a message below</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col gap-4 overflow-y-auto custom-scrollbar',
        className
      )}
    >
      {messages.map((message) => (
        <Message
          key={message.id}
          message={message}
          showMetadata={showMetadata}
          showRawData={showRawData}
        />
      ))}

      {/* Only show typing indicator if there's no assistant message being streamed */}
      {isLoading && messages[messages.length - 1]?.role !== 'assistant' && <TypingIndicator />}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
}
