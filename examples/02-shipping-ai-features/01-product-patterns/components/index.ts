/**
 * Product Patterns Components
 *
 * Production-ready chat components for AI applications.
 * Import these in other examples for consistent UX patterns.
 *
 * @example
 * ```tsx
 * import { ChatInterface } from '@examples/product-patterns/components';
 *
 * export default function MyApp() {
 *   return <ChatInterface showConfidence showSources />;
 * }
 * ```
 */

export { ChatInterface } from './chat-interface';
export type {
  ChatInterfaceProps,
  EnrichedMessage,
  Source,
  ConfidenceLevel,
} from './chat-interface';
