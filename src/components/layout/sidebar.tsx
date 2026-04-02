'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface SidebarProps {
  userEmail?: string
  userName?: string
  logoUrl?: string
}

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Projects',
    href: '/dashboard/projects',
    icon: FolderKanban,
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
]

const STORAGE_KEY = 'outsail_sidebar_collapsed'

export function Sidebar({ userEmail = '', userName, logoUrl }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Read persisted state after mount to avoid SSR mismatch
  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setCollapsed(stored === 'true')
    }
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  function getInitials(name?: string, email?: string): string {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (email) return email.slice(0, 2).toUpperCase()
    return 'U'
  }

  const initials = getInitials(userName, userEmail)
  const displayName = userName ?? userEmail ?? 'User'

  // Prevent flash of wrong state during hydration
  const isCollapsed = mounted ? collapsed : false

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className="flex flex-col h-screen bg-outsail-navy border-r border-white/10 transition-all duration-200 ease-in-out flex-shrink-0"
        style={{ width: isCollapsed ? '80px' : '240px' }}
      >
        {/* Logo / Brand */}
        <div className="flex items-center h-16 px-4 border-b border-white/10 flex-shrink-0">
          {isCollapsed ? (
            <div className="flex items-center justify-center w-full">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo" className="w-9 h-9 object-contain rounded-lg" />
              ) : (
                <span className="font-bold text-sm" style={{ color: '#4277c7' }}>OS</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo" className="h-9 max-w-[140px] object-contain rounded flex-shrink-0" />
              ) : (
                <div className="min-w-0">
                  <p className="font-bold text-base leading-tight truncate" style={{ color: '#4277c7' }}>
                    OutSail
                  </p>
                  <p className="text-white/50 text-xs leading-tight truncate">Blueprint</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div className="flex items-center border-b border-white/10 flex-shrink-0 py-3 px-3">
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center w-full">
                  <Avatar className="w-9 h-9 cursor-pointer">
                    <AvatarFallback className="text-xs bg-outsail-teal text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{displayName}</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0 w-full">
              <Avatar className="w-9 h-9 flex-shrink-0">
                <AvatarFallback className="text-xs bg-outsail-teal text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium leading-tight truncate">
                  {displayName}
                </p>
                {userName && (
                  <p className="text-white/50 text-xs leading-tight truncate">
                    {userEmail}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)

            if (isCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center justify-center w-full h-10 rounded-md transition-colors',
                        isActive
                          ? 'bg-outsail-teal text-white'
                          : 'text-white/60 hover:text-white hover:bg-white/10'
                      )}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 w-full h-10 px-3 rounded-md transition-colors text-sm font-medium',
                  isActive
                    ? 'bg-outsail-teal text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom section: logout + collapse toggle */}
        <div className="flex-shrink-0 border-t border-white/10 p-2 space-y-1">
          {/* Logout */}
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center w-full h-10 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full h-10 px-3 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span>Sign out</span>
            </button>
          )}

          {/* Collapse toggle */}
          <button
            onClick={toggleCollapsed}
            className={cn(
              'flex items-center w-full h-10 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors',
              isCollapsed ? 'justify-center' : 'gap-3 px-3'
            )}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
