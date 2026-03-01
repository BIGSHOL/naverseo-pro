import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { TooltipProvider } from '@/components/ui/tooltip'
import { FeatureGuard } from '@/components/layout/feature-guard'
import { UserProfileProvider } from '@/contexts/user-profile'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UserProfileProvider>
      <TooltipProvider delayDuration={300}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto p-4 lg:p-6">
              <FeatureGuard>
                {children}
              </FeatureGuard>
            </main>
          </div>
        </div>
      </TooltipProvider>
    </UserProfileProvider>
  )
}
