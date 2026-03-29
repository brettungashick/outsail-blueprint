'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ClipboardList, Layers, Map, FileOutput, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface WorkspaceSidebarProps {
  userEmail?: string
  userName?: string
  companyName?: string
}

const NAV_ITEMS = [
  { label: 'Overview', href: '/workspace', icon: LayoutDashboard, exact: true },
  { label: 'Intake', href: '/workspace/intake', icon: ClipboardList, exact: false },
  { label: 'Tech Stack', href: '/workspace/tech-stack', icon: Layers, exact: false },
  { label: 'Blueprint', href: '/workspace/blueprint', icon: Map, exact: false },
  { label: 'Outputs', href: '/workspace/outputs', icon: FileOutput, exact: false },
]

const STORAGE_KEY = 'outsail_workspace_sidebar_collapsed'

export function WorkspaceSidebar({ userEmail = '', userName, companyName }: WorkspaceSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) setCollapsed(stored === 'true')
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
    if (name) return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    if (email) return email.slice(0, 2).toUpperCase()
    return 'U'
  }

  const initials = getInitials(userName, userEmail)
  const displayName = userName ?? userEmail ?? 'User'
  const isCollapsed = mounted ? collapsed : false

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className="flex flex-col h-screen bg-outsail-navy border-r border-white/10 transition-all duration-200 ease-in-out flex-shrink-0"
        style={{ width: isCollapsed ? '80px' : '240px' }}
      >
        {/* Brand */}
        <div className="flex items-center h-16 px-4 border-b border-white/10 flex-shrink-0">
          {isCollapsed ? (
            <div className="flex items-center justify-center w-full">
              <div className="w-9 h-9 rounded-lg bg-outsail-teal flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">OS</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-outsail-teal flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">OS</span>
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm leading-tight truncate">OutSail</p>
                <p className="text-white/50 text-xs leading-tight truncate">Blueprint</p>
              </div>
            </div>
          )}
        </div>

        {/* User + company */}
        <div className="flex items-center border-b border-white/10 flex-shrink-0 py-3 px-3">
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center w-full">
                  <Avatar className="w-9 h-9 cursor-pointer">
                    <AvatarFallback className="text-xs bg-outsail-teal text-white">{initials}</AvatarFallback>
                  </Avatar>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{displayName}</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0 w-full">
              <Avatar className="w-9 h-9 flex-shrink-0">
                <AvatarFallback className="text-xs bg-outsail-teal text-white">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium leading-tight truncate">{displayName}</p>
                {companyName && (
                  <p className="text-white/50 text-xs leading-tight truncate">{companyName}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)

            if (isCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center justify-center w-full h-10 rounded-md transition-colors',
                        isActive ? 'bg-outsail-teal text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
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
                  isActive ? 'bg-outsail-teal text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom: logout + collapse */}
        <div className="flex-shrink-0 border-t border-white/10 p-2 space-y-1">
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
