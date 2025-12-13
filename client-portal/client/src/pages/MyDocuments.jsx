import { useQuery } from '@tanstack/react-query'
import { fetchDocuments } from '../lib/api'
import { FileText, ExternalLink, Loader2, FolderOpen } from 'lucide-react'
import { format } from 'date-fns'

export default function MyDocuments() {
  const { data, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: fetchDocuments
  })

  const documents = data?.data?.data?.documents || []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-gray-900">My Documents</h1>
        <p className="text-gray-500 mt-1">
          Documents you've generated from templates
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 mb-2">No documents yet</h3>
          <p className="text-gray-500 text-sm">
            Generate your first document from a template to see it here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-4 px-6 py-4">
                <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{doc.document_name}</p>
                  <p className="text-sm text-gray-500">
                    Created {format(new Date(doc.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <a
                  href={`https://docs.google.com/document/d/${doc.document_id}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Open <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
