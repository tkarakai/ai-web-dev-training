import type { Metadata } from 'next';
import '../../../shared/styles/globals.css';

export const metadata: Metadata = {
  title: 'API Integration - AI Web Dev Training',
  description:
    'API integration patterns: caching, retry logic, rate limiting, and idempotency',
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
