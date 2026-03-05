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
        <div className="flex h-screen w-full bg-[#e9eef5] overflow-hidden text-slate-900 font-sans">
          {/* Sidebar */}
          <div className="z-50 m-4 mr-2 hidden lg:flex">
            <Sidebar />
          </div>

          {/* Main Island */}
          <div className="flex flex-1 flex-col overflow-hidden bg-white my-4 mr-4 rounded-[1.5rem] shadow-sm border border-slate-200/60 relative">
            <Header />
            <main className="flex-1 overflow-y-auto p-4 lg:p-8">
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
