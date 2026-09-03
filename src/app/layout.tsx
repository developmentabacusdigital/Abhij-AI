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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Abhij-AI | Humanized Knowledge Assistant',
  description: 'AI Knowledge Assistant strictly grounded in Markdown and Word documentation with real-time interactive video avatar.',
  keywords: ['chatbot', 'markdown', 'knowledge base', 'RAG', 'openrouter', 'ai assistant', 'abhij-ai'],
  openGraph: {
    title: 'Abhij-AI | Humanized Knowledge Assistant',
    description: 'AI Knowledge Assistant strictly grounded in Markdown and Word documentation with real-time interactive video avatar.',
    url: '/',
    siteName: 'Abhij-AI',
    images: [
      {
        url: '/SOCIAL.png',
        width: 1080,
        height: 1080,
        alt: 'Abhij-AI Social Preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Abhij-AI | Humanized Knowledge Assistant',
    description: 'AI Knowledge Assistant strictly grounded in Markdown and Word documentation with real-time interactive video avatar.',
    images: ['/SOCIAL.png'],
  },
  icons: {
    icon: '/Abhij-AI.png',
    apple: '/SOCIAL.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#000000',
  viewportFit: 'cover',
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
