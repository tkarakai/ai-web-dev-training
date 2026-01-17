import '@examples/shared/styles/globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RAG Systems Demo',
  description: 'Retrieval-Augmented Generation: chunking, embeddings, search, and grounding',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
