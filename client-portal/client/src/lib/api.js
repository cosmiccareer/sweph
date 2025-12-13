import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const refreshed = await useAuthStore.getState().refreshAccessToken()

      if (refreshed) {
        // Retry with new token
        const token = useAuthStore.getState().accessToken
        originalRequest.headers.Authorization = `Bearer ${token}`
        return api(originalRequest)
      }
    }

    return Promise.reject(error)
  }
)

export default api

// Convenience methods
export const fetchTemplates = () => api.get('/api/v1/templates')
export const fetchTemplate = (id) => api.get(`/api/v1/templates/${id}`)
export const generateDocument = (id, data) => api.post(`/api/v1/templates/${id}/generate`, data)

export const fetchProgress = () => api.get('/api/v1/progress')
export const updateProgress = (moduleId, data) => api.post(`/api/v1/progress/${moduleId}`, data)

export const fetchAstrology = () => api.get('/api/v1/astrology/profile')
export const fetchIkigai = () => api.get('/api/v1/astrology/ikigai')
export const calculateChart = (birthData, save = true) =>
  api.post('/api/v1/astrology/calculate', { birthData, save })

export const sendChatMessage = (message, context) =>
  api.post('/api/v1/chat/message', { message, context })
export const fetchChatHistory = (limit = 50) =>
  api.get(`/api/v1/chat/history?limit=${limit}`)
export const clearChatHistory = () => api.delete('/api/v1/chat/history')

export const fetchDocuments = () => api.get('/api/v1/progress/documents')
