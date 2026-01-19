import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Exercise 03: Tool Calling',
  description: 'Let the LLM call functions with Zod validation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
