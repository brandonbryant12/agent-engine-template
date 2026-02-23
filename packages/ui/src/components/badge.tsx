import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-secondary/80 text-secondary-foreground border-border/50',
        info: 'bg-sky-100/80 text-sky-800 border-sky-200/60 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/50',
        warning:
          'bg-amber-100/80 text-amber-800 border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50',
        success:
          'bg-emerald-100/80 text-emerald-800 border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/50',
        error:
          'bg-red-100/80 text-red-800 border-red-200/60 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/50',
        purple:
          'bg-primary/15 text-primary border-primary/25 dark:bg-primary/25 dark:text-primary dark:border-primary/35',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

export { Badge, badgeVariants };
