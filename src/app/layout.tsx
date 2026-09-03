import type { Metadata, Viewport } from 'next';
import { Poppins, Press_Start_2P } from 'next/font/google';
import './globals.css';

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
});

const pixelFont = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-pixel',
});

export const metadata: Metadata = {
  title: 'Abhij-AI | Markdown Knowledge Base Chatbot',
  description: 'Grounded AI Chatbot powered by OpenRouter Gemma and local Markdown knowledge base documents.',
  keywords: ['chatbot', 'markdown', 'knowledge base', 'RAG', 'openrouter', 'gemma', 'ai assistant'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} ${pixelFont.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
