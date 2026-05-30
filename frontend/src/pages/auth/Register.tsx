import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { AuthLayout } from './AuthLayout'
import { Button, Field, Input, toast } from '@/components/ui'
import { Chip } from '@/components/ui/Chip'
import { authApi } from '@/api'
import { apiError } from '@/api/client'

export default function Register() {
  const navigate = useNavigate()
  const [role, setRole] = useState<'client' | 'trainer'>('client')
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    invite_code: '',
  })
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const mutation = useMutation({
    mutationFn: () =>
      authApi.register({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        role,
        ...(role === 'client' ? { invite_code: form.invite_code } : {}),
      }),
    onSuccess: () => {
      toast.success('Аккаунт создан! Войдите в систему.')
      navigate('/login', { replace: true })
    },
    onError: (e) => setError(apiError(e)),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    mutation.mutate()
  }

  return (
    <AuthLayout title="Создать аккаунт" subtitle="Заполните данные для начала тренировок">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-btn bg-danger-bg px-3 py-2 text-sm text-danger">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Имя" table="users" attr="first_name">
            <Input placeholder="Иван" value={form.first_name} onChange={set('first_name')} required />
          </Field>
          <Field label="Фамилия" table="users" attr="last_name">
            <Input placeholder="Иванов" value={form.last_name} onChange={set('last_name')} required />
          </Field>
        </div>

        <Field label="Email" table="users" attr="email">
          <Input
            type="email"
            placeholder="example@mail.com"
            value={form.email}
            onChange={set('email')}
            required
          />
        </Field>

        <Field
          label="Пароль"
          table="users"
          attr="password_hash"
          hint="Минимум 8 символов, буквы и цифры"
        >
          <Input
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={set('password')}
            minLength={8}
            required
          />
        </Field>

        <Field label="Я регистрируюсь как" table="users" attr="role">
          <div className="grid grid-cols-2 gap-3">
            <Chip active={role === 'client'} onClick={() => setRole('client')} className="py-2.5">
              Клиент
            </Chip>
            <Chip active={role === 'trainer'} onClick={() => setRole('trainer')} className="py-2.5">
              Тренер
            </Chip>
          </div>
        </Field>

        {role === 'client' && (
          <Field
            label="Код приглашения"
            table="trainers"
            attr="invite_code"
            hint="Привязывает вас к кабинету тренера"
          >
            <Input
              placeholder="Введите код от тренера"
              value={form.invite_code}
              onChange={set('invite_code')}
              required
            />
          </Field>
        )}

        <Button type="submit" size="lg" fullWidth loading={mutation.isPending}>
          Зарегистрироваться
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        Уже есть аккаунт?{' '}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Войти
        </Link>
      </p>
    </AuthLayout>
  )
}
