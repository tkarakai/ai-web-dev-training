import '@examples/shared/styles/globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Multi-Agent Orchestration',
  description: 'Explore multi-agent orchestration patterns: sequential, parallel, hierarchical, and maker-checker',
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
