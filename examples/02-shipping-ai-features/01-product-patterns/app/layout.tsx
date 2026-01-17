import type { Metadata } from 'next';
import '../../../shared/styles/globals.css';

export const metadata: Metadata = {
  title: 'Product Patterns - AI Web Dev Training',
  description:
    'Product patterns and UX for AI features: chat interfaces, streaming, citations, and confidence indicators',
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
