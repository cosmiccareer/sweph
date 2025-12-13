import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { fetchTemplate, generateDocument } from '../lib/api'
import { useState } from 'react'
import { ArrowLeft, FileText, Download, Loader2, ExternalLink } from 'lucide-react'

export default function TemplateDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [businessName, setBusinessName] = useState('')
  const [generating, setGenerating] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['template', id],
    queryFn: () => fetchTemplate(id)
  })

  const generateMutation = useMutation({
    mutationFn: (data) => generateDocument(id, data),
    onSuccess: (response) => {
      const doc = response.data.data.document
      if (doc.webViewLink) {
        window.open(doc.webViewLink, '_blank')
      }
    }
  })

  const template = data?.data?.data

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await generateMutation.mutateAsync({ businessName })
    } finally {
      setGenerating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (error || !template) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">Failed to load template.</p>
        <button onClick={() => navigate('/templates')} className="text-indigo-600 hover:text-indigo-700">
          Back to templates
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/templates')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to templates
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center">
            <FileText className="h-6 w-6 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-serif font-bold text-gray-900">{template.name}</h1>
            {template.description && (
              <p className="text-gray-500 mt-1">{template.description}</p>
            )}
            <span className="inline-block mt-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
              {template.category}
            </span>
          </div>
        </div>

        {template.webViewLink && (
          <a
            href={template.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-6"
          >
            <ExternalLink className="h-4 w-4" />
            View original in Google Drive
          </a>
        )}

        <div className="border-t pt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Personalized Copy</h2>
          <p className="text-gray-500 text-sm mb-4">
            Create a personalized version of this template with your astrology data and business information automatically filled in.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Name (optional)
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Enter your business name"
                className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || generateMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(generating || generateMutation.isPending) ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Generate My Copy
                </>
              )}
            </button>

            {generateMutation.isSuccess && (
              <p className="text-green-600 text-sm">
                Document generated! It should open in a new tab.
              </p>
            )}

            {generateMutation.isError && (
              <p className="text-red-500 text-sm">
                Failed to generate document. Please try again.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
