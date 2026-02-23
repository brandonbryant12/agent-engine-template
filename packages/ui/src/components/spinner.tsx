import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/utils';

const spinnerVariants = cva(
  'inline-flex items-end justify-center gap-[1.5px]',
  {
    variants: {
      size: {
        sm: 'w-4 h-4',
        default: 'w-5 h-5',
        lg: 'w-6 h-6',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
);

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {}

function Spinner({ className, size, ...props }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(spinnerVariants({ size }), className)}
      {...props}
    >
      <span className="spinner-bar spinner-bar-1" />
      <span className="spinner-bar spinner-bar-2" />
      <span className="spinner-bar spinner-bar-3" />
      <span className="spinner-bar spinner-bar-4" />
    </div>
  );
}

export { Spinner, spinnerVariants };
