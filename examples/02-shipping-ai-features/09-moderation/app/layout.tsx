import '@examples/shared/styles/globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Moderation Demo',
  description: 'Content moderation pipeline with layered defense, rate limiting, and policy enforcement',
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
