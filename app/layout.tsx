import './globals.css'

export const metadata = {
  title: 'Claude Code ターミナル',
  description: '並列実行可能なClaude Codeウェブターミナル',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className="dark">
      <body>{children}</body>
    </html>
  )
}