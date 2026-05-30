import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { AuthLayout } from './AuthLayout'
import { Button, Field, Input } from '@/components/ui'
import { authApi } from '@/api'
import { apiError } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { HOME_BY_ROLE } from '@/lib/nav'
import { decodeJwt } from '@/lib/jwt'

export default function Login() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => authApi.login({ email, password }),
    onSuccess: ({ token }) => {
      setSession(token)
      const payload = decodeJwt(token)
      navigate(payload ? HOME_BY_ROLE[payload.role] : '/', { replace: true })
    },
    onError: (e) => setError(apiError(e)),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    mutation.mutate()
  }

  return (
    <AuthLayout title="С возвращением" subtitle="Войдите в свой аккаунт FitTrack">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-btn bg-danger-bg px-3 py-2 text-sm text-danger">{error}</div>
        )}
        <Field label="Email" table="users" attr="email">
          <Input
            type="email"
            autoComplete="email"
            placeholder="example@mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Пароль" table="users" attr="password_hash">
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" size="lg" fullWidth loading={mutation.isPending}>
          Войти
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        Нет аккаунта?{' '}
        <Link to="/register" className="font-semibold text-primary hover:underline">
          Зарегистрироваться
        </Link>
      </p>
    </AuthLayout>
  )
}
