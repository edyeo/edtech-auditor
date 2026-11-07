import { ImagePlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { IMAGE_SCHEME, MarkdownNote } from '@/features/vocabulary/components/markdown-note'
import { VocabularyImage } from '@/features/vocabulary/components/vocabulary-image'
import { compressImage } from '@/lib/compress-image'
import { addVocabularyImage, removeVocabularyImage, removeVocabularyTerm, updateVocabularyTerm } from '@/lib/learner-actions'
import { QUESTION_SECTIONS } from '@/lib/question-section'
import { cn } from '@/lib/utils'
import type { VocabularyTerm } from '@/types/learner.types'

const MAX_MEMO_LENGTH = 20000
const MAX_IMAGES = 3

type VocabularyTermRowProps = {
  entry: VocabularyTerm
  /** "2021년 22회 1번", when the source question is known. */
  sourceLabel: string | null
  /** The section the note is filed under: the one set by hand, else the source question's. */
  section: string | null
}

export function VocabularyTermRow({ entry, sourceLabel, section }: VocabularyTermRowProps) {
  // The draft is saved when the field loses focus, so typing never waits on the server.
  const [draft, setDraft] = useState(entry.memo)
  // Closed by default so the list stays short; the content opens per word.
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const contentId = `vocabulary-content-${entry.term}`

  function saveMemo(next = draft) {
    if (next !== entry.memo) void updateVocabularyTerm(entry.term, { memo: next })
  }

  /** Compress and upload a picture, then link it into the note at the cursor. */
  async function attach(file: File) {
    if (entry.images.length >= MAX_IMAGES) {
      setUploadError(`이미지는 노트당 ${MAX_IMAGES}장까지 올릴 수 있습니다.`)
      return
    }
    setIsUploading(true)
    setUploadError(null)
    try {
      const image = await addVocabularyImage(entry.term, await compressImage(file))
      if (!image) return
      const link = `![이미지](${IMAGE_SCHEME}${image.id})`
      const field = textareaRef.current
      const at = field?.selectionStart ?? draft.length
      const next = `${draft.slice(0, at)}${at > 0 && !draft.slice(0, at).endsWith('\n') ? '\n' : ''}${link}\n${draft.slice(at)}`
      setDraft(next)
      saveMemo(next)
    } catch {
      setUploadError('이 이미지를 처리하지 못했습니다. 다른 파일로 시도해 주세요.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <li className={cn('flex flex-col gap-2 border-b py-3 last:border-b-0', !entry.active && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-base font-semibold">{entry.term}</span>
        {section && <Badge variant="outline">{section}</Badge>}
        {!entry.active && <Badge variant="outline">비활성</Badge>}
        {entry.studied && <Badge variant="secondary">공부 완료</Badge>}
        {!isOpen && (entry.memo || entry.images.length > 0) && <Badge variant="outline">메모 있음</Badge>}
        {entry.sourceQuestionId && sourceLabel && (
          <a href={`#/practice/${entry.sourceQuestionId}`} className="text-xs text-muted-foreground hover:underline">
            출처 {sourceLabel}
          </a>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            aria-expanded={isOpen}
            aria-controls={contentId}
            className="h-10 md:h-8"
            onClick={() => {
              // A note with content opens as the rendered note; an empty one opens straight into the editor.
              setIsEditing(!entry.memo)
              setIsOpen((open) => !open)
            }}
          >
            {isOpen ? '내용닫기' : '내용보기'}
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-pressed={entry.studied}
            className="h-10 md:h-8"
            onClick={() => void updateVocabularyTerm(entry.term, { studied: !entry.studied })}
          >
            {entry.studied ? '다시 공부하기' : '공부 완료'}
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-pressed={!entry.active}
            className="h-10 md:h-8"
            onClick={() => void updateVocabularyTerm(entry.term, { active: !entry.active })}
          >
            {entry.active ? '비활성화' : '활성화'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-10 md:h-8"
            onClick={() => {
              if (window.confirm(`"${entry.term}" 단어를 단어장에서 지울까요?`)) void removeVocabularyTerm(entry.term)
            }}
          >
            삭제
          </Button>
        </div>
      </div>

      {isOpen && (
        <div id={contentId} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              aria-label={`${entry.term} 과목`}
              value={section ?? ''}
              onChange={(event) => void updateVocabularyTerm(entry.term, { section: event.target.value || null })}
            >
              <option value="">과목 없음</option>
              {QUESTION_SECTIONS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </NativeSelect>
            <Button
              type="button"
              variant="outline"
              aria-pressed={isEditing}
              className="h-10 md:h-8"
              onClick={() => {
                if (isEditing) saveMemo()
                setIsEditing((editing) => !editing)
              }}
            >
              {isEditing ? '미리보기' : '편집'}
            </Button>
            {isEditing && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void attach(file)
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isUploading || entry.images.length >= MAX_IMAGES}
                  className="h-10 md:h-8"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus /> {isUploading ? '올리는 중...' : '이미지 추가'}
                </Button>
              </>
            )}
          </div>

          {isEditing ? (
            <Textarea
              ref={textareaRef}
              aria-label={`${entry.term} 메모`}
              placeholder={'마크다운으로 적을 수 있습니다. (# 제목, - 목록, | 표 |, ``` 코드)\n이미지는 붙여넣기(Ctrl+V)로도 넣을 수 있습니다.'}
              maxLength={MAX_MEMO_LENGTH}
              value={draft}
              className="min-h-40 font-mono"
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => saveMemo()}
              onPaste={(event) => {
                const file = [...event.clipboardData.files].find((candidate) => candidate.type.startsWith('image/'))
                if (!file) return
                event.preventDefault()
                void attach(file)
              }}
            />
          ) : entry.memo ? (
            <MarkdownNote source={entry.memo} />
          ) : (
            <p className="text-sm text-muted-foreground">아직 내용이 없습니다. &quot;편집&quot;으로 적어 보세요.</p>
          )}

          {uploadError && (
            <p role="alert" className="text-sm text-red-500">
              {uploadError}
            </p>
          )}
          {entry.images.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="첨부 이미지">
              {entry.images.map((image) => (
                <li key={image.id} className="flex flex-col items-start gap-1">
                  <VocabularyImage imageId={image.id} className="h-20 rounded-md border bg-white object-contain" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => void removeVocabularyImage(entry.term, image.id)}
                  >
                    이미지 삭제
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}
