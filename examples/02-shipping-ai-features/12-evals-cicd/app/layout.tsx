import '@examples/shared/styles/globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Evals CI/CD Demo',
  description: 'Automated eval pipelines: offline evals, A/B testing, canary deployments, and CI gating',
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
