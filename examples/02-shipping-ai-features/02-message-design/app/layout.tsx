import type { Metadata } from 'next';
import '../../../shared/styles/globals.css';

export const metadata: Metadata = {
  title: 'Message Design - AI Web Dev Training',
  description:
    'Message design patterns: conversation persistence, memory management, and multi-conversation handling',
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
