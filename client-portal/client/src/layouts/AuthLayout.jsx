import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Stars } from 'lucide-react'

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  // Redirect to dashboard if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Background stars decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 text-white/10">
          <Stars className="h-24 w-24" />
        </div>
        <div className="absolute bottom-20 right-20 text-white/10">
          <Stars className="h-32 w-32" />
        </div>
        <div className="absolute top-1/3 right-1/4 text-white/5">
          <Stars className="h-16 w-16" />
        </div>
      </div>

      {/* Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-white/10 backdrop-blur rounded-full flex items-center justify-center">
            <Stars className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-serif font-bold tracking-tight text-white">
          Cosmic Clarity
        </h2>
        <p className="mt-2 text-center text-sm text-indigo-200">
          Breakthrough Business Blueprint
        </p>
      </div>

      {/* Content */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative">
        <div className="bg-white py-8 px-6 shadow-xl rounded-lg sm:px-10">
          <Outlet />
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-center text-xs text-indigo-300">
        Build your business aligned with your cosmic blueprint
      </p>
    </div>
  )
}
