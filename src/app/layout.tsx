import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aura-D Studio',
  description: 'Workflow Automation + AI Agent สำหรับทีมการตลาด/ครีเอเตอร์'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
