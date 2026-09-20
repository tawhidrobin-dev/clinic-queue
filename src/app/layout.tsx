import './globals.css';

export const metadata = {
  title: 'Smart Clinic Queue System',
  description: 'Real-time clinic queue and patient wait-time forecasting',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
