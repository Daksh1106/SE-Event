// Shared page frame: navbar, centred content column and footer (NFR-1)
import { Navbar } from '@/components/layout/navbar'

interface PageShellProps {
  children: React.ReactNode
  /** Tailwind max-width class for the content column */
  maxWidth?: string
}

export function PageShell({ children, maxWidth = 'max-w-5xl' }: PageShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className={`flex-1 w-full container mx-auto px-4 py-8 sm:px-6 sm:py-10 ${maxWidth} space-y-8`}>
        {children}
      </main>
      <footer className="mt-10 border-t border-border/80 bg-card/70 py-6 text-center text-xs text-muted-foreground px-4">
        <span className="font-semibold text-foreground">College Event &amp; Club Hub</span>
        <span className="mx-2 text-primary">&middot;</span>
        JSS Science and Technology University
      </footer>
    </div>
  )
}
