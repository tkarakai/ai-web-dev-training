import '@examples/shared/styles/globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Deployment & Versioning Demo',
  description: 'AI deployment: versioning, release playbooks, rollbacks, and change management',
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
