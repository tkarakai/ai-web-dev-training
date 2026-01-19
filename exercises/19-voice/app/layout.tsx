import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Exercise 19: Voice Interfaces',
  description: 'Build speech-to-text and text-to-speech interfaces',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100">{children}</body>
    </html>
  );
}
