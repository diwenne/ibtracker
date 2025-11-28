'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AuthForm() {
  const [isLogin, setIsLogin] = useState(true)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        })
        if (error) throw error
        setMessage('Check your email for the password reset link!')
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        setMessage('Check your email for the confirmation link!')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="bg-card border border-border rounded-lg p-8 shadow-sm">
        <h2 className="text-2xl font-bold mb-6 text-center">
          {isForgotPassword ? 'Reset Password' : isLogin ? 'Login to IB Tracker' : 'Sign Up for IB Tracker'}
        </h2>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={loading}
            />
          </div>

          {!isForgotPassword && (
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                minLength={6}
              />
            </div>
          )}

          {error && (
            <div className="text-destructive text-sm bg-destructive/10 p-3 rounded">
              {error}
            </div>
          )}

          {message && (
            <div className="text-green-600 text-sm bg-green-50 dark:bg-green-950 p-3 rounded">
              {message}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Loading...' : isForgotPassword ? 'Send Reset Link' : isLogin ? 'Login' : 'Sign Up'}
          </Button>
        </form>

        <div className="mt-4 text-center space-y-2">
          {!isForgotPassword && (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin)
                  setError(null)
                  setMessage(null)
                }}
                className="text-sm text-muted-foreground hover:text-foreground underline block w-full"
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Login'}
              </button>
              {isLogin && (
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true)
                    setError(null)
                    setMessage(null)
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                >
                  Forgot password?
                </button>
              )}
            </>
          )}
          {isForgotPassword && (
            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false)
                setError(null)
                setMessage(null)
              }}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Back to login
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
