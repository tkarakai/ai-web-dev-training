import type { Metadata } from 'next';
import '../../../shared/styles/globals.css';

export const metadata: Metadata = {
  title: 'Output Control - AI Web Dev Training',
  description:
    'Output control patterns: structured outputs, JSON validation, schema enforcement with Zod',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
