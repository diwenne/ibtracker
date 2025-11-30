'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Check if user has valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('invalid or expired reset link. please request a new one.');
      }
    };
    checkSession();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError('passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setMessage('password updated successfully! redirecting...');
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>set new password</CardTitle>
          <CardDescription>
            enter ur new password below
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleResetPassword} className="flex flex-col gap-6">
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">new password</Label>
              <Input
                id="password"
                type="password"
                placeholder="enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {message && <p className="text-sm text-green-500">{message}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'updating...' : 'update password'}
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={() => router.push('/')}
              className="text-sm text-muted-foreground"
            >
              back to sign in
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
