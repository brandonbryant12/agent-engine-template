import * as React from 'react';

import { cn } from '../lib/utils';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

function EmptyState({
  className,
  icon,
  title,
  description,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-20 px-6',
        className,
      )}
      {...props}
    >
      {icon && (
        <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mb-5 shadow-inner">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground mb-2 font-serif">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

export { EmptyState };
