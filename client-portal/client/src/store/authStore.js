import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../lib/api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Login action
      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.post('/api/v1/auth/login', { email, password })
          const { user, accessToken, refreshToken } = response.data.data

          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false
          })

          return { success: true }
        } catch (error) {
          set({
            error: error.response?.data?.error || 'Login failed',
            isLoading: false
          })
          return { success: false, error: error.response?.data?.error }
        }
      },

      // Register action
      register: async (name, email, password, birthData) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.post('/api/v1/auth/register', {
            name,
            email,
            password,
            birthData
          })
          const { user, accessToken, refreshToken } = response.data.data

          set({
            user,
            accessToken,
            refreshToken,
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
        set({ isLoading: true, error: null })
        try {
          const response = await api.post('/api/v1/auth/wordpress', { wpToken })
          const { user, accessToken, refreshToken } = response.data.data

          set({
            user,
            accessToken,
            refreshToken,
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
        } catch {
          get().logout()
          return false
        }
      },

      // Logout action
      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null
        })
      },

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
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)
