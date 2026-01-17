'use client';

import * as React from 'react';
import { Send, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { cn } from '../../lib/utils';

export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  onCancel?: () => void;
  showCancel?: boolean;
}

/**
 * Chat input component with send button
 */
export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Type your message...',
  className,
  maxLength,
  onCancel,
  showCancel = false,
}: ChatInputProps) {
  const [message, setMessage] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = message.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setMessage('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleCancel = () => {
    onCancel?.();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('flex gap-2 items-end', className)}
    >
      <Textarea
        ref={textareaRef}
        value={message}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        className="min-h-[60px] max-h-[200px] resize-none"
        rows={1}
      />

      <div className="flex gap-2">
        {showCancel && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleCancel}
            disabled={disabled}
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <Button
          type="submit"
          size="icon"
          disabled={disabled || !message.trim()}
          title="Send message (Enter)"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
