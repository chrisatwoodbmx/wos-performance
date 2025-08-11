import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { getCurrentUser, logout } from "@/app/auth/actions"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { LogOut, Package2 } from "lucide-react"
import { Toaster } from "sonner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Event Tracker Dashboard",
  description: "Track events and player scores",
    generator: 'v0.dev'
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getCurrentUser()

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex flex-col min-h-screen">
          <header className="sticky top-0 z-40 w-full border-b bg-background">
            <div className="container flex h-16 items-center px-4 md:px-6">
              <Link href="/" className="flex items-center gap-2 text-lg font-semibold md:text-base">
                <Package2 className="h-6 w-6" />
                <span className="sr-only">Event Tracker</span>
              </Link>
              <nav className="ml-auto flex items-center gap-4">
                {user ? (
                  <>
                    <span className="text-sm text-muted-foreground hidden md:inline">Logged in as {user.username}</span>
                    <form action={logout}>
                      <Button variant="ghost" size="sm" className="flex items-center gap-1">
                        <LogOut className="h-4 w-4" />
                        Logout
                      </Button>
                    </form>
                  </>
                ) : (
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/login">Login</Link>
                  </Button>
                )}
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  )
}
