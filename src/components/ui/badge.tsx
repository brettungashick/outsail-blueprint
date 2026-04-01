import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        // OutSail project status variants
        intake:
          'border-transparent bg-blue-100 text-blue-700',
        discovery_complete:
          'border-transparent bg-outsail-teal-light text-outsail-teal-dark',
        summary_approved:
          'border-transparent bg-outsail-teal-light text-outsail-teal-dark',
        deep_discovery:
          'border-transparent bg-amber-100 text-amber-700',
        blueprint_generation:
          'border-transparent bg-purple-100 text-purple-700',
        client_review:
          'border-transparent bg-amber-100 text-amber-700',
        approved:
          'border-transparent bg-green-100 text-green-700',
        outputs:
          'border-transparent bg-green-100 text-green-700',
        // Tier variants
        essentials:
          'border-transparent bg-outsail-blue/10 text-outsail-blue',
        growth:
          'border-transparent bg-outsail-purple/10 text-outsail-purple',
        enterprise:
          'border-transparent bg-outsail-navy/10 text-outsail-navy',
        // Criticality
        must_have:
          'border-transparent bg-red-100 text-outsail-red',
        should_have:
          'border-transparent bg-amber-100 text-amber-700',
        could_have:
          'border-transparent bg-outsail-teal-light text-outsail-teal-dark',
        wont_have:
          'border-transparent bg-outsail-gray-200 text-outsail-gray-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
