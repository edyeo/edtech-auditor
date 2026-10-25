import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { AdminAnswerRow } from '@/features/admin/components/admin-answer-row'
import { useAdminQuestions } from '@/features/admin/utils/use-admin-questions'

export function AdminPage() {
  const { token, questions, isLoading, error, load, saveAnswer, revertAnswer, signOut } = useAdminQuestions()
  const [tokenInput, setTokenInput] = useState(token)
  const [year, setYear] = useState<number | null>(null)
  const [subject, setSubject] = useState('all')
  const [onlyEdited, setOnlyEdited] = useState(false)

  const years = useMemo(
    () => [...new Set((questions ?? []).map((q) => q.year))].sort((a, b) => b - a),
    [questions],
  )
  const subjects = useMemo(() => [...new Set((questions ?? []).map((q) => q.subject))], [questions])
  const selectedYear = year ?? years[0] ?? null

  const rows = useMemo(
    () =>
      (questions ?? []).filter(
        (q) =>
          q.year === selectedYear &&
          (subject === 'all' || q.subject === subject) &&
          (!onlyEdited || q.answer_overridden),
      ),
    [questions, selectedYear, subject, onlyEdited],
  )
  const editedCount = (questions ?? []).filter((q) => q.answer_overridden).length

  if (!questions) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>관리자 로그인</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void load(tokenInput.trim())
            }}
          >
            <label htmlFor="admin-token" className="text-sm font-medium">
              관리자 토큰
            </label>
            <Input
              id="admin-token"
              type="password"
              autoComplete="off"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder=".env의 ADMIN_TOKEN"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" disabled={isLoading || tokenInput.trim() === ''}>
              {isLoading ? '확인 중...' : '불러오기'}
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>정답 관리 ({rows.length}문항)</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={isLoading} onClick={() => void load(token)}>
            새로고침
          </Button>
          <Button size="sm" variant="ghost" onClick={signOut}>
            로그아웃
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect aria-label="연도" value={selectedYear ?? ''} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((value) => (
              <option key={value} value={value}>
                {value}년
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="과목" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="all">전체 과목</option>
            {subjects.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </NativeSelect>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={onlyEdited} onChange={(e) => setOnlyEdited(e.target.checked)} />
            수정한 것만 (전체 {editedCount})
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          정답 칸을 체크하고 저장하세요. 여러 개를 체크하면 복수정답으로 처리됩니다. 수정 내용은 원본 데이터와 별도로 저장되며
          원복할 수 있습니다.
        </p>
        <ul>
          {rows.map((question) => (
            <AdminAnswerRow
              key={`${question.id}:${question.answer_index}:${question.also_correct.join(',')}`}
              question={question}
              onSave={(indexes) => saveAnswer(question.id, indexes)}
              onRevert={() => revertAnswer(question.id)}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
