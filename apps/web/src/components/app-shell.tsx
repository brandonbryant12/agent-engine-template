import { Button } from '@repo/ui/components/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/tooltip';
import { Link, Outlet } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { authClient } from '@/clients/auth-client';
import { EngineIcon, LogoMark } from '@/components/logo';

/* ─── Nav Icons ─── */

function DashboardIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function JobsIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/* ─── Nav Data ─── */

const navItems = [
  { to: '/' as const, label: 'Dashboard', Icon: DashboardIcon, exact: true },
  { to: '/chat' as const, label: 'Chat', Icon: ChatIcon, exact: false },
  { to: '/jobs' as const, label: 'Jobs', Icon: JobsIcon, exact: false },
];

/* ─── App Shell ─── */

interface AppShellProps {
  userEmail: string;
}

export function AppShell({ userEmail }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const onSignOut = useCallback(async () => {
    const result = await authClient.signOut();
    if (result.error) {
      toast.error(result.error.message ?? 'Sign out failed.');
      return;
    }
    toast.success('Signed out.');
  }, []);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-screen overflow-hidden">
        {/* Mobile top bar */}
        <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
          <LogoMark />
          <div className="w-8" />
        </div>

        {/* Mobile drawer overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
              onClick={() => setMobileOpen(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setMobileOpen(false);
              }}
              role="button"
              tabIndex={0}
              aria-label="Close menu"
            />
            <aside className="absolute bottom-0 left-0 top-0 flex w-64 flex-col border-r border-sidebar-border bg-sidebar animate-fade-in">
              <div className="flex items-center justify-between p-4">
                <LogoMark />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                  aria-label="Close menu"
                >
                  <CloseIcon />
                </button>
              </div>
              <MobileNavList onNavigate={() => setMobileOpen(false)} />
              <div className="border-t border-sidebar-border p-4">
                <p className="text-meta mb-2 truncate">{userEmail}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => void onSignOut()}
                >
                  Sign Out
                </Button>
              </div>
            </aside>
          </div>
        )}

        {/* Desktop icon rail */}
        <aside className="hidden w-[60px] shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-4 lg:flex">
          {/* Logo icon */}
          <div className="logo-icon mb-6">
            <EngineIcon />
          </div>

          {/* Nav icons */}
          <nav className="flex flex-1 flex-col items-center gap-1">
            {navItems.map(({ to, label, Icon, exact }) => (
              <Tooltip key={to}>
                <TooltipTrigger asChild>
                  <Link
                    to={to}
                    activeOptions={{ exact }}
                    className="flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200"
                    activeProps={{
                      className:
                        'bg-sidebar-accent text-sidebar-accent-foreground',
                    }}
                    inactiveProps={{
                      className:
                        'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
                    }}
                    aria-label={label}
                  >
                    <Icon />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {label}
                </TooltipContent>
              </Tooltip>
            ))}
          </nav>

          {/* Sign out */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-foreground/50 transition-all duration-200 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                aria-label="Sign out"
              >
                <SignOutIcon />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Sign out
            </TooltipContent>
          </Tooltip>
        </aside>

        {/* Main content area */}
        <main className="flex-1 min-h-0 overflow-hidden pt-14 lg:pt-0 bg-background">
          <div className="h-full overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

/* ─── Mobile Nav (full labels) ─── */

function MobileNavList({ onNavigate }: { onNavigate: () => void }) {
  return (
    <nav className="flex-1 px-3">
      <ul className="space-y-1">
        {navItems.map(({ to, label, Icon, exact }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact }}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200"
              activeProps={{
                className:
                  'bg-sidebar-accent text-sidebar-accent-foreground',
              }}
              inactiveProps={{
                className:
                  'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
              }}
            >
              <Icon />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
