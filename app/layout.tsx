import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'flowtodo',
  description: 'DAG-based todo with quest-style next-action recommendations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
