import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { queryClient } from '@/lib/queryClient'
import { Toaster } from '@/components/ui'
import './index.css'

// createBrowserRouter enables useBlocker (requires DataRouterContext)
const router = createBrowserRouter([
  { path: '*', element: <><App /><Toaster /></> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
