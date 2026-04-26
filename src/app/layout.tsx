import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'AI Readiness Monitor',
  description: 'Monthly AI insight readiness for commercial data — structured on Rumelt\'s good strategy framework',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans bg-cream text-stone-900 antialiased`}>
        {children}
      </body>
    </html>
  )
}
