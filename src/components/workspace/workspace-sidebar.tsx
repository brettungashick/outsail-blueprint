'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ClipboardList, Layers, MessageCircle, FileText, Map, FileOutput, ChevronLeft, ChevronRight, LogOut, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface WorkspaceSidebarProps {
  userEmail?: string
  userName?: string
  companyName?: string
  techStackComplete?: boolean
  selfServiceEnabled?: boolean
  logoUrl?: string
}

const STORAGE_KEY = 'outsail_workspace_sidebar_collapsed'

export function WorkspaceSidebar({
  userEmail = '',
  userName,
  companyName,
  techStackComplete = false,
  selfServiceEnabled = false,
  logoUrl,
}: WorkspaceSidebarProps) {
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

  // Nav item definitions — Discovery and Summary are gated on techStackComplete
  const NAV_ITEMS = [
    { label: 'Overview',             href: '/workspace',                   icon: LayoutDashboard, exact: true,  disabled: false,             gated: false },
    { label: 'Intake',               href: '/workspace/intake',            icon: ClipboardList,   exact: true,  disabled: false,             gated: false },
    { label: 'Tech Stack',           href: '/workspace/intake/tech-stack', icon: Layers,          exact: false, disabled: false,             gated: false },
    { label: 'Discovery',            href: '/workspace/intake/discovery',  icon: MessageCircle,   exact: false, disabled: !techStackComplete, gated: !techStackComplete },
    { label: 'Summary',              href: '/workspace/intake/summary',    icon: FileText,        exact: false, disabled: !techStackComplete, gated: !techStackComplete },
    ...(selfServiceEnabled ? [{ label: 'Blueprint Assistant', href: '/workspace/chat', icon: Bot, exact: false, disabled: false, gated: false }] : []),
    { label: 'Blueprint',            href: null,                           icon: Map,             exact: false, disabled: true,              gated: false },
    { label: 'Outputs',              href: null,                           icon: FileOutput,      exact: false, disabled: true,              gated: false },
  ]

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
            const isActive = item.href
              ? (item.exact ? pathname === item.href : pathname.startsWith(item.href))
              : false

            // Gated: tech stack not complete yet — show with lock tooltip
            if (item.gated) {
              const tooltipMsg = 'Complete your tech stack first'
              if (isCollapsed) {
                return (
                  <Tooltip key={`gated-${item.label}`}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center w-full h-10 rounded-md text-white/25 cursor-not-allowed">
                        <Icon className="w-5 h-5 flex-shrink-0" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">{tooltipMsg}</TooltipContent>
                  </Tooltip>
                )
              }
              return (
                <Tooltip key={`gated-${item.label}`}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-3 w-full h-10 px-3 rounded-md text-white/25 cursor-not-allowed text-sm font-medium">
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                      <span className="ml-auto text-[10px] text-white/20 font-normal">locked</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">{tooltipMsg}</TooltipContent>
                </Tooltip>
              )
            }

            // Coming soon (Phase 2+)
            if (item.disabled) {
              if (isCollapsed) {
                return (
                  <Tooltip key={`disabled-${item.label}`}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center w-full h-10 rounded-md text-white/25 cursor-not-allowed">
                        <Icon className="w-5 h-5 flex-shrink-0" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label} — Coming soon</TooltipContent>
                  </Tooltip>
                )
              }
              return (
                <div key={`disabled-${item.label}`} className="flex items-center gap-3 w-full h-10 px-3 rounded-md text-white/25 cursor-not-allowed text-sm font-medium">
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto text-[10px] text-white/20 font-normal">soon</span>
                </div>
              )
            }

            if (isCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href!}
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
                href={item.href!}
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
