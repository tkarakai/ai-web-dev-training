'use client';

import * as React from 'react';
import type { AIMessage } from '@examples/shared/types';
import { generateId } from '@examples/shared/lib/utils';

export interface Conversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: Date;
  updatedAt: Date;
  systemPrompt?: string;
  summary?: string;
}

const STORAGE_KEY = 'ai-conversations';

function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];

    const parsed = JSON.parse(data);
    return parsed.map((conv: any) => ({
      ...conv,
      createdAt: new Date(conv.createdAt),
      updatedAt: new Date(conv.updatedAt),
      messages: conv.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })),
    }));
  } catch (error) {
    console.error('Failed to load conversations:', error);
    return [];
  }
}

function saveConversations(conversations: Conversation[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.error('Failed to save conversations:', error);
  }
}

function generateTitle(messages: AIMessage[]): string {
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (!firstUserMessage) return 'New Conversation';

  const content = firstUserMessage.content;
  if (content.length <= 40) return content;
  return content.substring(0, 40) + '...';
}

export interface UseConversationsResult {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  createConversation: (systemPrompt?: string) => Conversation;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  addMessage: (message: AIMessage) => void;
  updateTitle: (id: string, title: string) => void;
  clearAll: () => void;
  exportConversations: () => string;
  importConversations: (json: string) => boolean;
}

export function useConversations(): UseConversationsResult {
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [currentId, setCurrentId] = React.useState<string | null>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);

  // Load conversations on mount
  React.useEffect(() => {
    const loaded = loadConversations();
    setConversations(loaded);
    if (loaded.length > 0) {
      setCurrentId(loaded[0].id);
    }
    setIsLoaded(true);
  }, []);

  // Save conversations when they change
  React.useEffect(() => {
    if (isLoaded) {
      saveConversations(conversations);
    }
  }, [conversations, isLoaded]);

  const currentConversation = React.useMemo(() => {
    return conversations.find(c => c.id === currentId) || null;
  }, [conversations, currentId]);

  const createConversation = React.useCallback((systemPrompt?: string): Conversation => {
    const newConversation: Conversation = {
      id: generateId('conv'),
      title: 'New Conversation',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      systemPrompt,
    };

    setConversations(prev => [newConversation, ...prev]);
    setCurrentId(newConversation.id);
    return newConversation;
  }, []);

  const selectConversation = React.useCallback((id: string) => {
    setCurrentId(id);
  }, []);

  const deleteConversation = React.useCallback((id: string) => {
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (currentId === id && filtered.length > 0) {
        setCurrentId(filtered[0].id);
      } else if (filtered.length === 0) {
        setCurrentId(null);
      }
      return filtered;
    });
  }, [currentId]);

  const addMessage = React.useCallback((message: AIMessage) => {
    if (!currentId) return;

    setConversations(prev => prev.map(conv => {
      if (conv.id !== currentId) return conv;

      const updatedMessages = [...conv.messages, message];
      const title = conv.messages.length === 0
        ? generateTitle(updatedMessages)
        : conv.title;

      return {
        ...conv,
        messages: updatedMessages,
        title,
        updatedAt: new Date(),
      };
    }));
  }, [currentId]);

  const updateTitle = React.useCallback((id: string, title: string) => {
    setConversations(prev => prev.map(conv =>
      conv.id === id ? { ...conv, title, updatedAt: new Date() } : conv
    ));
  }, []);

  const clearAll = React.useCallback(() => {
    setConversations([]);
    setCurrentId(null);
  }, []);

  const exportConversations = React.useCallback((): string => {
    return JSON.stringify(conversations, null, 2);
  }, [conversations]);

  const importConversations = React.useCallback((json: string): boolean => {
    try {
      const imported = JSON.parse(json);
      if (!Array.isArray(imported)) return false;

      const validated = imported.map((conv: any) => ({
        ...conv,
        id: conv.id || generateId('conv'),
        createdAt: new Date(conv.createdAt || Date.now()),
        updatedAt: new Date(conv.updatedAt || Date.now()),
        messages: (conv.messages || []).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp || Date.now()),
        })),
      }));

      setConversations(prev => [...validated, ...prev]);
      if (validated.length > 0) {
        setCurrentId(validated[0].id);
      }
      return true;
    } catch (error) {
      console.error('Failed to import conversations:', error);
      return false;
    }
  }, []);

  return {
    conversations,
    currentConversation,
    createConversation,
    selectConversation,
    deleteConversation,
    addMessage,
    updateTitle,
    clearAll,
    exportConversations,
    importConversations,
  };
}
