import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../lib/api'

// Generate a simple device fingerprint
const generateDeviceFingerprint = () => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.textBaseline = 'top'
  ctx.font = '14px Arial'
  ctx.fillText('fingerprint', 2, 2)
  const canvasData = canvas.toDataURL()

  const screenData = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const language = navigator.language
  const platform = navigator.platform

  const fingerprintData = `${canvasData}|${screenData}|${timezone}|${language}|${platform}`
  return btoa(fingerprintData).substring(0, 32)
}

// Get device name from user agent
const getDeviceName = () => {
  const ua = navigator.userAgent
  let browser = 'Unknown'
  let os = 'Unknown'

  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome'
  else if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
  else if (ua.includes('Edg')) browser = 'Edge'

  if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac OS')) os = 'macOS'
  else if (ua.includes('Linux') && !ua.includes('Android')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'

  return `${browser} on ${os}`
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      sessionId: null,
      deviceId: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      logoutReason: null, // 'manual', 'session_invalidated', 'device_limit'

      // Login action
      login: async (email, password) => {
        set({ isLoading: true, error: null, logoutReason: null })
        try {
          const deviceFingerprint = generateDeviceFingerprint()
          const deviceName = getDeviceName()

          const response = await api.post('/api/v1/auth/login', {
            email,
            password,
            deviceFingerprint,
            deviceName
          })

          const { user, accessToken, refreshToken, sessionId, device } = response.data.data

          set({
            user,
            accessToken,
            refreshToken,
            sessionId,
            deviceId: device?.id,
            isAuthenticated: true,
            isLoading: false
          })

          return { success: true }
        } catch (error) {
          const errorData = error.response?.data
          set({
            error: errorData?.message || errorData?.error || 'Login failed',
            isLoading: false
          })

          // Return device info if device limit reached
          if (errorData?.error === 'device_limit_reached') {
            return {
              success: false,
              error: 'device_limit_reached',
              devices: errorData.devices,
              message: errorData.message
            }
          }

          return { success: false, error: errorData?.error }
        }
      },

      // Register action
      register: async (name, email, password, birthData) => {
        set({ isLoading: true, error: null, logoutReason: null })
        try {
          const deviceFingerprint = generateDeviceFingerprint()
          const deviceName = getDeviceName()

          const response = await api.post('/api/v1/auth/register', {
            name,
            email,
            password,
            birthData,
            deviceFingerprint,
            deviceName
          })

          const { user, accessToken, refreshToken, sessionId, device } = response.data.data

          set({
            user,
            accessToken,
            refreshToken,
            sessionId,
            deviceId: device?.id,
            isAuthenticated: true,
            isLoading: false
          })

          return { success: true }
        } catch (error) {
          set({
            error: error.response?.data?.error || 'Registration failed',
            isLoading: false
          })
          return { success: false, error: error.response?.data?.error }
        }
      },

      // WordPress SSO login
      loginWithWordPress: async (wpToken) => {
        set({ isLoading: true, error: null, logoutReason: null })
        try {
          const deviceFingerprint = generateDeviceFingerprint()
          const deviceName = getDeviceName()

          const response = await api.post('/api/v1/auth/wordpress', {
            wpToken,
            deviceFingerprint,
            deviceName
          })

          const { user, accessToken, refreshToken, sessionId, device } = response.data.data

          set({
            user,
            accessToken,
            refreshToken,
            sessionId,
            deviceId: device?.id,
            isAuthenticated: true,
            isLoading: false
          })

          return { success: true }
        } catch (error) {
          set({
            error: error.response?.data?.error || 'WordPress login failed',
            isLoading: false
          })
          return { success: false, error: error.response?.data?.error }
        }
      },

      // Refresh token
      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) return false

        try {
          const response = await api.post('/api/v1/auth/refresh', { refreshToken })
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data

          set({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
          })

          return true
        } catch (error) {
          // Check if session was invalidated (logged in from another device)
          if (error.response?.data?.error === 'session_invalidated') {
            get().logout('session_invalidated')
          } else {
            get().logout()
          }
          return false
        }
      },

      // Check session status (call periodically to detect forced logout)
      checkSessionStatus: async () => {
        const { sessionId, accessToken } = get()
        if (!sessionId || !accessToken) return { active: true }

        try {
          const response = await api.get(`/api/v1/auth/session-status?sessionId=${sessionId}`)
          const { active, reason } = response.data.data

          if (!active) {
            get().logout('session_invalidated')
            return { active: false, reason }
          }

          return { active: true }
        } catch {
          return { active: true } // Assume active on error
        }
      },

      // Logout action
      logout: (reason = 'manual') => {
        const { refreshToken } = get()

        // Try to invalidate session on server
        if (refreshToken && reason === 'manual') {
          api.post('/api/v1/auth/logout', { refreshToken }).catch(() => {})
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          sessionId: null,
          deviceId: null,
          isAuthenticated: false,
          error: null,
          logoutReason: reason
        })
      },

      // Clear logout reason (after showing notification)
      clearLogoutReason: () => set({ logoutReason: null }),

      // Update user
      updateUser: (userData) => {
        set((state) => ({
          user: { ...state.user, ...userData }
        }))
      },

      // Clear error
      clearError: () => set({ error: null })
    }),
    {
      name: 'ccbbb-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        sessionId: state.sessionId,
        deviceId: state.deviceId,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)
