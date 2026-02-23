import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-b from-primary to-primary/90 text-primary-foreground shadow-[inset_0_1px_0_0_hsl(var(--primary-foreground)/0.15),0_1px_3px_hsl(var(--primary)/0.3)] hover:from-primary/95 hover:to-primary/85 hover:shadow-[inset_0_1px_0_0_hsl(var(--primary-foreground)/0.2),0_4px_12px_hsl(var(--primary)/0.25)] active:scale-[0.98] active:shadow-[inset_0_1px_0_0_hsl(var(--primary-foreground)/0.1)]',
        destructive:
          'bg-gradient-to-b from-destructive to-destructive/90 text-destructive-foreground shadow-[inset_0_1px_0_0_hsl(var(--destructive-foreground)/0.15),0_1px_3px_hsl(var(--destructive)/0.3)] hover:from-destructive/95 hover:to-destructive/85 active:scale-[0.98]',
        outline:
          'border-2 border-border bg-card hover:bg-muted hover:border-primary/30 active:scale-[0.98] shadow-sm',
        secondary:
          'bg-gradient-to-b from-secondary to-secondary/90 text-secondary-foreground shadow-sm hover:from-secondary/95 hover:to-secondary/85 active:scale-[0.98]',
        ghost: 'hover:bg-muted hover:text-foreground rounded-xl',
        link: 'text-foreground underline-offset-4 hover:underline decoration-primary/50 hover:decoration-primary hover:text-primary',
      },
      size: {
        default: 'h-10 px-5 py-2 rounded-xl',
        sm: 'h-8 px-3.5 text-xs rounded-lg',
        lg: 'h-12 px-7 rounded-xl text-base',
        icon: 'h-10 w-10 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
