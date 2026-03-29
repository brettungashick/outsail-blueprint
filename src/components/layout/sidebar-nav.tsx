'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface SidebarNavItem {
  label: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
  badge?: number
}

interface SidebarNavProps {
  items: SidebarNavItem[]
  collapsed?: boolean
}

export function SidebarNav({ items, collapsed = false }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center h-10 rounded-md transition-colors text-sm font-medium',
              collapsed
                ? 'justify-center w-full'
                : 'gap-3 px-3 w-full',
              isActive
                ? 'bg-outsail-teal text-white'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            )}
          >
            {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
            {!collapsed && <span className="truncate flex-1">{item.label}</span>}
            {!collapsed && item.badge !== undefined && item.badge > 0 && (
              <span className="ml-auto flex-shrink-0 h-5 min-w-5 px-1.5 rounded-full bg-outsail-coral text-white text-xs font-bold flex items-center justify-center">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
