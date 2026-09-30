import type { Metadata } from 'next';
import './globals.css';
import 'ai-avatar-bot-typescript/style.css';

export const metadata: Metadata = {
  title: 'AI Avatar Bot - Next.js Direct Example',
  description: 'Next.js App Router Direct Integration Example with SSR Guard and Asset Sync'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
