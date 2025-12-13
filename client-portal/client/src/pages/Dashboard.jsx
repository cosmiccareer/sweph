import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { fetchProgress, fetchAstrology } from '../lib/api'
import {
  FileText,
  Stars,
  GraduationCap,
  MessageCircle,
  ArrowRight,
  CheckCircle2,
  Clock
} from 'lucide-react'

export default function Dashboard() {
  const user = useAuthStore((state) => state.user)

  const { data: progress } = useQuery({
    queryKey: ['progress'],
    queryFn: fetchProgress
  })

  const { data: astrology } = useQuery({
    queryKey: ['astrology'],
    queryFn: fetchAstrology
  })

  const progressData = progress?.data?.data
  const astroData = astrology?.data?.data

  const quickActions = [
    {
      title: 'Browse Templates',
      description: 'Find business plan templates and worksheets',
      href: '/templates',
      icon: FileText,
      color: 'bg-blue-500'
    },
    {
      title: 'View Your Chart',
      description: 'Explore your cosmic blueprint',
      href: '/astrology',
      icon: Stars,
      color: 'bg-purple-500'
    },
    {
      title: 'Continue Course',
      description: 'Pick up where you left off',
      href: '/progress',
      icon: GraduationCap,
      color: 'bg-green-500'
    },
    {
      title: 'Chat with Coach',
      description: 'Get personalized guidance',
      href: '/chat',
      icon: MessageCircle,
      color: 'bg-indigo-500'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-serif font-bold">
          Welcome back, {user?.name?.split(' ')[0] || 'Star'}!
        </h1>
        <p className="mt-2 text-indigo-100">
          {astroData?.hasBirthData ? (
            <>
              Your {astroData.planets?.sun?.sign} Sun is ready to shine in business.
            </>
          ) : (
            <>
              Enter your birth data to unlock personalized cosmic insights for your business.
            </>
          )}
        </p>
        {!astroData?.hasBirthData && (
          <Link
            to="/astrology"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
          >
            Enter Birth Data
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              to={action.href}
              className="group relative bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all"
            >
              <div className={`${action.color} w-10 h-10 rounded-lg flex items-center justify-center mb-3`}>
                <action.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                {action.title}
              </h3>
              <p className="text-sm text-gray-500 mt-1">{action.description}</p>
              <ArrowRight className="absolute top-5 right-5 h-5 w-5 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>
      </div>

      {/* Progress and insights */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Course progress */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Course Progress</h2>
          {progressData?.summary ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Completed</span>
                    <span className="font-medium">
                      {progressData.summary.completed} / {progressData.summary.completed + progressData.summary.inProgress + progressData.summary.notStarted || 0}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{
                        width: `${(progressData.summary.completed / (progressData.summary.completed + progressData.summary.inProgress + progressData.summary.notStarted) * 100) || 0}%`
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{progressData.summary.completed} completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span>{progressData.summary.inProgress} in progress</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Start your first module to track progress!</p>
          )}
          <Link
            to="/progress"
            className="inline-flex items-center gap-1 mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            View all modules <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Cosmic insights */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Cosmic Blueprint</h2>
          {astroData?.hasBirthData ? (
            <div className="space-y-3">
              {astroData.planets?.sun && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500 w-24">Sun Sign:</span>
                  <span className="font-medium">{astroData.planets.sun.sign}</span>
                </div>
              )}
              {astroData.vsp && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500 w-24">Venus Star:</span>
                  <span className="font-medium">{astroData.vsp.sign}</span>
                </div>
              )}
              {astroData.marsPhase && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500 w-24">Mars Phase:</span>
                  <span className="font-medium">{astroData.marsPhase.phase}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              Add your birth data to see your cosmic business insights.
            </p>
          )}
          <Link
            to="/astrology"
            className="inline-flex items-center gap-1 mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            View full profile <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
