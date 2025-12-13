import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sendChatMessage, fetchChatHistory, clearChatHistory } from '../lib/api'
import ReactMarkdown from 'react-markdown'
import { Send, Loader2, Trash2, Stars, User } from 'lucide-react'
import clsx from 'clsx'

export default function Chat() {
  const [input, setInput] = useState('')
  const [context, setContext] = useState({})
  const messagesEndRef = useRef(null)
  const queryClient = useQueryClient()

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['chatHistory'],
    queryFn: () => fetchChatHistory(50)
  })

  const messages = history?.data?.data?.messages || []

  const sendMutation = useMutation({
    mutationFn: ({ message, context }) => sendChatMessage(message, context),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatHistory'] })
      setInput('')
    }
  })

  const clearMutation = useMutation({
    mutationFn: clearChatHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatHistory'] })
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!input.trim() || sendMutation.isPending) return

    sendMutation.mutate({ message: input, context })
  }

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sendMutation.isPending])

  const quickPrompts = [
    'Help me understand my Venus Star Point',
    'What business ideas align with my chart?',
    'Guide me through creating my business plan',
    'Explain my Ikigai analysis'
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-gray-900">AI Business Coach</h1>
          <p className="text-gray-500 text-sm">Get personalized guidance based on your cosmic blueprint</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
            className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1"
          >
            <Trash2 className="h-4 w-4" />
            Clear history
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
        {historyLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
              <Stars className="h-8 w-8 text-indigo-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">Start a Conversation</h3>
            <p className="text-gray-500 text-sm max-w-md mb-6">
              Ask me anything about your astrology chart, business planning, or the course materials.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="text-sm px-3 py-2 bg-gray-100 hover:bg-indigo-100 hover:text-indigo-700 rounded-lg transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={clsx(
                  'flex gap-3',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Stars className="h-4 w-4 text-indigo-600" />
                  </div>
                )}
                <div
                  className={clsx(
                    'max-w-[80%] rounded-2xl px-4 py-3',
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none prose-p:my-2 prose-headings:my-2">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            {sendMutation.isPending && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Stars className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="bg-gray-100 rounded-2xl px-4 py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your cosmic business blueprint..."
          className="flex-1 rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          disabled={sendMutation.isPending}
        />
        <button
          type="submit"
          disabled={!input.trim() || sendMutation.isPending}
          className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  )
}
