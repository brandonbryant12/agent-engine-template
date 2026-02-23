import { Toaster } from '@repo/ui/components/sonner';
import { Spinner } from '@repo/ui/components/spinner';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter as createTanstackRouter,
} from '@tanstack/react-router';
import { ThemeProvider } from 'next-themes';
import { authClient } from '@/clients/auth-client';
import { AppShell } from '@/components/app-shell';
import { AuthGate } from '@/components/auth-gate';
import { LogoMark } from '@/components/logo';
import { env } from '@/env';
import { ChatPage } from '@/pages/chat';
import { DashboardPage } from '@/pages/dashboard';
import { JobsPage } from '@/pages/jobs';
import { queryClient } from '@/query-client';

/* ─── Routes ─── */

const rootRoute = createRootRoute({ component: RootLayout });

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  component: AuthenticatedLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: DashboardPage,
});

const chatRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/chat',
  component: ChatPage,
});

const jobsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/jobs',
  component: JobsPage,
});

const routeTree = rootRoute.addChildren([
  appRoute.addChildren([dashboardRoute, chatRoute, jobsRoute]),
]);

/* ─── Layouts ─── */

function RootLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
      <Toaster position="bottom-right" />
    </div>
  );
}

function AuthenticatedLayout() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <LogoMark />
          <Spinner />
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return <AuthGate />;
  }

  return <AppShell key={session.user.id} userEmail={session.user.email} />;
}

/* ─── Router Factory ─── */

export function createAppRouter() {
  return createTanstackRouter({
    routeTree,
    basepath: env.PUBLIC_BASE_PATH,
    defaultPreload: 'intent',
    scrollRestoration: true,
    Wrap: function WrapComponent({ children }) {
      return (
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </ThemeProvider>
      );
    },
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
