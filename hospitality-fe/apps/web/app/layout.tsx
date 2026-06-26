import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hospitality Decision Intelligence SaaS',
  description: 'AI-driven cost analysis, recipe margins, and schedule optimization.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased text-[#151515] bg-[#fafaf8] min-h-screen">
        {children}
      </body>
    </html>
  );
}
