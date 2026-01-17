import type { Metadata } from 'next';
import '../../../shared/styles/globals.css';

export const metadata: Metadata = {
  title: 'Prompting - AI Web Dev Training',
  description:
    'Prompt engineering playground: few-shot, chain-of-thought, and agent loops',
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
