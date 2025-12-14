import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Loader2, AlertTriangle, Monitor, Smartphone, Tablet, Trash2 } from 'lucide-react'
import api from '../lib/api'

const DeviceIcon = ({ type }) => {
  if (type === 'mobile') return <Smartphone className="h-5 w-5" />
  if (type === 'tablet') return <Tablet className="h-5 w-5" />
  return <Monitor className="h-5 w-5" />
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [deviceLimitDevices, setDeviceLimitDevices] = useState(null)
  const [removingDevice, setRemovingDevice] = useState(null)
  const { login, isLoading, error, clearError, logoutReason, clearLogoutReason } = useAuthStore()

  // Clear logout reason after showing
  useEffect(() => {
    if (logoutReason) {
      const timer = setTimeout(() => clearLogoutReason(), 10000)
      return () => clearTimeout(timer)
    }
  }, [logoutReason, clearLogoutReason])

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearError()
    setDeviceLimitDevices(null)

    const result = await login(email, password)

    if (result.error === 'device_limit_reached') {
      setDeviceLimitDevices(result.devices)
    }
  }

  const handleRemoveDevice = async (deviceId) => {
    setRemovingDevice(deviceId)
    try {
      // We need to authenticate first to remove device, so we'll show instructions instead
      // In a real app, you'd have a special endpoint or email-based removal
      setDeviceLimitDevices(prev => prev.filter(d => d.id !== deviceId))

      // Retry login after removing device from local state
      // Note: Actual removal requires authentication, so user needs to log out from other device
      alert('To remove a device, please log out from that device first, or contact support.')
    } finally {
      setRemovingDevice(null)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 text-center">
          Welcome back
        </h3>
        <p className="mt-1 text-sm text-gray-500 text-center">
          Sign in to continue your cosmic journey
        </p>
      </div>

      {/* Session invalidated notification */}
      {logoutReason === 'session_invalidated' && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                You've been logged out
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Your account was accessed from another device. For security, only one active session is allowed at a time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Device limit reached */}
      {deviceLimitDevices && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                Device limit reached (3 devices maximum)
              </p>
              <p className="text-sm text-red-700 mt-1 mb-3">
                To sign in from this device, please log out from one of your other devices:
              </p>
              <div className="space-y-2">
                {deviceLimitDevices.map((device) => (
                  <div key={device.id} className="flex items-center justify-between bg-white rounded-lg p-2 border border-red-100">
                    <div className="flex items-center gap-2">
                      <DeviceIcon type={device.type} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{device.name}</p>
                        <p className="text-xs text-gray-500">
                          Last used: {new Date(device.lastUsed).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-red-600 mt-3">
                Sign out from another device and try again, or contact support for help.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && !deviceLimitDevices && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        Sign in
      </button>

      <p className="text-center text-sm text-gray-600">
        Don't have an account?{' '}
        <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
          Register here
        </Link>
      </p>
    </form>
  )
}
