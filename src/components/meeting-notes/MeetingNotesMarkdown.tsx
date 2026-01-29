'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { cn } from '@/lib/utils'

interface MeetingNotesMarkdownProps {
  content: string
  className?: string
}

export function MeetingNotesMarkdown({ content, className }: MeetingNotesMarkdownProps) {
  return (
    <div className={cn('prose prose-sm max-w-none dark:prose-invert', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          // 自訂標題樣式
          h1: ({ node, ...props }) => (
            <h1 className="text-2xl font-bold mt-6 mb-4 pb-2 border-b" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xl font-semibold mt-5 mb-3" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-lg font-semibold mt-4 mb-2" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="text-base font-semibold mt-3 mb-2" {...props} />
          ),

          // 自訂列表樣式
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside space-y-1 my-3" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside space-y-1 my-3" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),

          // 自訂段落樣式
          p: ({ node, ...props }) => (
            <p className="my-2 leading-relaxed" {...props} />
          ),

          // 自訂強調樣式
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-foreground" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic text-muted-foreground" {...props} />
          ),

          // 自訂程式碼區塊樣式
          code: ({ node, className, children, ...props }) => {
            const isInline = !className?.includes('language-')
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <code
                className="block p-3 rounded-lg bg-muted text-sm font-mono overflow-x-auto my-3"
                {...props}
              >
                {children}
              </code>
            )
          },

          // 自訂引用樣式
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-4 border-primary pl-4 py-2 my-3 italic text-muted-foreground"
              {...props}
            />
          ),

          // 自訂連結樣式
          a: ({ node, ...props }) => (
            <a
              className="text-primary underline hover:text-primary/80 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),

          // 自訂分隔線樣式
          hr: ({ node, ...props }) => (
            <hr className="my-6 border-border" {...props} />
          ),

          // 自訂表格樣式
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full divide-y divide-border" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-muted" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-border" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-muted/50 transition-colors" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-4 py-2 text-left text-sm font-semibold" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-4 py-2 text-sm" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
