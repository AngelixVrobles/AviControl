import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function Shell() {
  const { pathname } = useLocation()
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-paper sm:border-x sm:border-line">
      <main
        key={pathname}
        className="flex-1 px-5 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))]"
      >
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
