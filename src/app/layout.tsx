import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { themeBootstrap } from '@/lib/theme-script';
export const metadata: Metadata = {
  title: 'AcadTrack — Your academic life, organized',
  description:
    'A calmer way to manage your academic life. Plan your week, track deadlines, and make room for focus.',
  icons: { icon: '/icon.svg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script id="acadtrack-theme" dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
