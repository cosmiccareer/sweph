import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchProgress, updateProgress } from '../lib/api'
import { CheckCircle2, Circle, Clock, Loader2 } from 'lucide-react'
import clsx from 'clsx'

const MODULES = [
  { id: '1', title: 'Introduction to Cosmic Business', description: 'Understanding your cosmic blueprint' },
  { id: '2', title: 'Your Venus Star Point', description: 'Discovering your natural gifts' },
  { id: '3', title: 'Your Mars Phase', description: 'Finding your action style' },
  { id: '4', title: 'Ikigai & Your Chart', description: 'Where passion meets purpose' },
  { id: '5', title: 'Business Planning Basics', description: 'Foundation for your cosmic business' },
  { id: '6', title: 'Branding with Astrology', description: 'Creating an authentic brand' },
  { id: '7', title: 'Pricing & Money', description: 'Your 2nd house & value' },
  { id: '8', title: 'Marketing Your Gifts', description: 'Sharing your cosmic offerings' },
  { id: '9', title: 'Service & Systems', description: 'Your 6th house in action' },
  { id: '10', title: 'Career & Visibility', description: 'Your 10th house mastery' },
  { id: '11', title: 'Putting It All Together', description: 'Your complete business plan' },
  { id: '12', title: 'Launch & Beyond', description: 'Taking action with the stars' }
]

export default function CourseProgress() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['progress'],
    queryFn: fetchProgress
  })

  const updateMutation = useMutation({
    mutationFn: ({ moduleId, status }) => updateProgress(moduleId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress'] })
    }
  })

  const progressMap = {}
  const modules = data?.data?.data?.modules || []
  for (const m of modules) {
    progressMap[m.module_id] = m
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  const getStatus = (moduleId) => progressMap[moduleId]?.status || 'not_started'

  const handleStatusChange = (moduleId, currentStatus) => {
    const nextStatus = currentStatus === 'not_started' ? 'in_progress'
      : currentStatus === 'in_progress' ? 'completed'
      : 'not_started'
    updateMutation.mutate({ moduleId, status: nextStatus })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-gray-900">Course Progress</h1>
        <p className="text-gray-500 mt-1">
          Track your journey through the Cosmic Clarity Blueprint
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {MODULES.map((module, index) => {
            const status = getStatus(module.id)
            return (
              <div
                key={module.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50"
              >
                <button
                  onClick={() => handleStatusChange(module.id, status)}
                  disabled={updateMutation.isPending}
                  className="flex-shrink-0"
                >
                  {status === 'completed' ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : status === 'in_progress' ? (
                    <Clock className="h-6 w-6 text-yellow-500" />
                  ) : (
                    <Circle className="h-6 w-6 text-gray-300" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={clsx(
                    'font-medium',
                    status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'
                  )}>
                    Module {index + 1}: {module.title}
                  </p>
                  <p className="text-sm text-gray-500">{module.description}</p>
                </div>
                <span className={clsx(
                  'text-xs font-medium px-2 py-1 rounded-full',
                  status === 'completed' ? 'bg-green-100 text-green-700' :
                  status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-500'
                )}>
                  {status === 'completed' ? 'Complete' :
                   status === 'in_progress' ? 'In Progress' : 'Not Started'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-sm text-gray-500 text-center">
        Click the circle to change module status
      </p>
    </div>
  )
}
