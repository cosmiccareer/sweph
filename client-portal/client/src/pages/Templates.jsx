import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchTemplates } from '../lib/api'
import { FileText, Briefcase, Palette, Megaphone, Calculator, Stars, ClipboardList, Loader2 } from 'lucide-react'

const categoryIcons = {
  'business-plan': Briefcase,
  'branding': Palette,
  'marketing': Megaphone,
  'finance': Calculator,
  'astro-guides': Stars,
  'worksheets': ClipboardList
}

export default function Templates() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates
  })

  const categories = data?.data?.data || {}

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Failed to load templates. Please try again.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-serif font-bold text-gray-900">Templates & Resources</h1>
        <p className="text-gray-500 mt-1">
          Business planning templates, worksheets, and guides for your cosmic journey
        </p>
      </div>

      {Object.entries(categories).map(([key, category]) => {
        const Icon = categoryIcons[key] || FileText
        const templates = category.templates || []

        if (templates.length === 0) return null

        return (
          <div key={key} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Icon className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{category.name}</h2>
                <p className="text-sm text-gray-500">{category.description}</p>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {templates.map((template) => (
                <Link
                  key={template.id}
                  to={`/templates/${template.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{template.name}</p>
                    {template.description && (
                      <p className="text-sm text-gray-500 truncate">{template.description}</p>
                    )}
                  </div>
                  <span className="text-sm text-indigo-600 font-medium">Open</span>
                </Link>
              ))}
            </div>
          </div>
        )
      })}

      {Object.values(categories).every(c => !c.templates?.length) && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 mb-2">No templates available</h3>
          <p className="text-gray-500 text-sm">
            Templates will appear here once Google Drive is connected.
          </p>
        </div>
      )}
    </div>
  )
}
