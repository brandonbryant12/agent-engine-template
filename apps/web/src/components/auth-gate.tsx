import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { authClient } from '@/clients/auth-client';
import { LogoMark } from '@/components/logo';

type AuthMode = 'signin' | 'signup';

export function AuthGate() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = useCallback(async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      toast.error('Email and password are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const result = await authClient.signIn.email({
          email: trimmedEmail,
          password: trimmedPassword,
        });

        if (result.error) {
          toast.error(result.error.message ?? 'Sign in failed.');
          return;
        }

        toast.success('Signed in.');
        return;
      }

      const fallbackName = trimmedEmail.split('@')[0] || 'Template User';
      const result = await authClient.signUp.email({
        name: fallbackName,
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (result.error) {
        toast.error(result.error.message ?? 'Sign up failed.');
        return;
      }

      toast.success('Account created and signed in.');
    } finally {
      setIsSubmitting(false);
    }
  }, [email, mode, password]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="auth-card animate-fade-in-up">
        <div className="auth-header">
          <div className="mb-6 flex justify-center">
            <LogoMark />
          </div>
          <h1 className="page-title">
            {mode === 'signin' ? 'Welcome back' : 'Get started'}
          </h1>
          <p className="text-body mt-2">
            {mode === 'signin'
              ? 'Sign in to continue to your workspace.'
              : 'Create an account to start building.'}
          </p>
        </div>

        <div className="card-padded">
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="auth-email"
              >
                Email
              </label>
              <Input
                id="auth-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void onSubmit();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="auth-password"
              >
                Password
              </label>
              <Input
                id="auth-password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void onSubmit();
                  }
                }}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => void onSubmit()}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? mode === 'signin'
                  ? 'Signing in...'
                  : 'Creating account...'
                : mode === 'signin'
                  ? 'Sign In'
                  : 'Create Account'}
            </Button>
          </div>
        </div>

        <div className="auth-footer">
          <button
            type="button"
            className="text-link"
            onClick={() =>
              setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'))
            }
          >
            {mode === 'signin'
              ? 'Need an account? Create one'
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
