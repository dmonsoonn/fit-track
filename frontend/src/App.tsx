import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { HOME_BY_ROLE } from '@/lib/nav'
import { AppShell } from '@/components/layout/AppShell'
import { PrivateRoute, RoleRoute } from '@/components/layout/PrivateRoute'

import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'

import ClientProfile from '@/pages/client/Profile'
import Schedule from '@/pages/client/Schedule'
import WorkoutExecution from '@/pages/client/WorkoutExecution'
import Progress from '@/pages/client/Progress'
import FoodDiary from '@/pages/client/FoodDiary'

import TrainerProfile from '@/pages/trainer/Profile'
import ClientList from '@/pages/trainer/ClientList'
import ClientDetail from '@/pages/trainer/ClientDetail'
import ProgramEdit from '@/pages/trainer/ProgramEdit'
import WorkoutForm from '@/pages/trainer/WorkoutForm'

import AdminUsers from '@/pages/admin/Users'
import AdminStats from '@/pages/admin/Stats'

import Notifications from '@/pages/shared/Notifications'
import Exercises from '@/pages/shared/Exercises'
import Templates from '@/pages/shared/Templates'

function RootRedirect() {
  const role = useAuthStore((s) => s.role)
  const isAuthed = useAuthStore((s) => s.isAuthenticated())
  if (!isAuthed || !role) return <Navigate to="/login" replace />
  return <Navigate to={HOME_BY_ROLE[role]} replace />
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Authenticated */}
      <Route element={<PrivateRoute />}>
        <Route element={<AppShell />}>
          {/* Client */}
          <Route element={<RoleRoute allow={['client']} />}>
            <Route path="/profile" element={<ClientProfile />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/workout/:id" element={<WorkoutExecution />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/food-diary" element={<FoodDiary />} />
            <Route path="/notifications" element={<Notifications />} />
          </Route>

          {/* Trainer */}
          <Route element={<RoleRoute allow={['trainer']} />}>
            <Route path="/trainer/profile" element={<TrainerProfile />} />
            <Route path="/trainer/clients" element={<ClientList />} />
            <Route path="/trainer/clients/:id" element={<ClientDetail />} />
            <Route path="/trainer/clients/:id/plans/:planId" element={<ProgramEdit />} />
            <Route path="/trainer/plans/:planId/workouts/new" element={<WorkoutForm />} />
            <Route path="/trainer/workouts/:id/edit" element={<WorkoutForm />} />
            <Route path="/trainer/exercises" element={<Exercises />} />
            <Route path="/trainer/templates" element={<Templates />} />
            <Route path="/trainer/notifications" element={<Notifications />} />
          </Route>

          {/* Admin */}
          <Route element={<RoleRoute allow={['admin']} />}>
            <Route path="/admin/stats" element={<AdminStats />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/exercises" element={<Exercises system />} />
            <Route path="/admin/templates" element={<Templates system />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}
