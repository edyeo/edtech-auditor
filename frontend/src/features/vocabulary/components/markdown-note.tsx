import Markdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { VocabularyImage } from '@/features/vocabulary/components/vocabulary-image'

/** How a note refers to one of its stored pictures: `![설명](vocab-image:<id>)`. */
export const IMAGE_SCHEME = 'vocab-image:'

type MarkdownNoteProps = {
  source: string
}

/** A note rendered from Markdown. Raw HTML is not rendered, and only the note's own pictures are loaded. */
export function MarkdownNote({ source }: MarkdownNoteProps) {
  return (
    <div className="flex flex-col gap-2 text-base leading-relaxed break-words md:text-sm">
      <Markdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (url.startsWith(IMAGE_SCHEME) ? url : defaultUrlTransform(url))}
        components={{
          h1: ({ children }) => <h3 className="text-lg font-semibold">{children}</h3>,
          h2: ({ children }) => <h4 className="text-base font-semibold">{children}</h4>,
          h3: ({ children }) => <h5 className="font-semibold">{children}</h5>,
          ul: ({ children }) => <ul className="list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5">{children}</ol>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 pl-3 text-muted-foreground">{children}</blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
              {children}
            </a>
          ),
          code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{children}</code>,
          pre: ({ children }) => <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{children}</pre>,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border px-2 py-1">{children}</td>,
          img: ({ src, alt }) =>
            typeof src === 'string' && src.startsWith(IMAGE_SCHEME) ? (
              <VocabularyImage
                imageId={src.slice(IMAGE_SCHEME.length)}
                alt={alt}
                className="max-w-full rounded-md border bg-white"
              />
            ) : (
              // Pictures from other sites are not loaded: they would reveal when the learner reads the note.
              <span className="text-muted-foreground">[{alt || '외부 이미지'}]</span>
            ),
        }}
      >
        {source}
      </Markdown>
    </div>
  )
}
