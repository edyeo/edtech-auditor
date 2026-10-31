import { AdminPage } from '@/features/admin'
import { StudyListPage } from '@/features/exam'
import { MiniTestPage } from '@/features/mini-test'
import { OxQuizPage } from '@/features/ox-quiz'
import type { MiniTestScope } from '@/features/mini-test/utils/build-mini-test'
import { QuestionListPage } from '@/features/question-list'
import { WrongNotesPage } from '@/features/wrong-notes'
import { Button } from '@/components/ui/button'
import { dismissLearnerNotice } from '@/lib/learner-actions'
import { learnerStore } from '@/lib/learner-state.store'
import { useLearnerBootstrap } from '@/lib/use-learner-bootstrap'
import { cn } from '@/lib/utils'
import { useHashRoute } from '@/lib/use-hash-route'
import { useSyncExternalStore } from 'react'
import { MarkedPracticePage } from '@/pages/marked-practice-page'
import { QuestionPracticePage } from '@/pages/question-practice-page'

const NAV_ITEMS = [
  { href: '#/', path: '/', label: '학습' },
  { href: '#/questions', path: '/questions', label: '문제 목록' },
  { href: '#/marked', path: '/marked', label: '마킹한 문항' },
  { href: '#/mini-test', path: '/mini-test', label: '미니 테스트' },
  { href: '#/ox', path: '/ox', label: 'O/X 퀴즈' },
  { href: '#/wrong-notes', path: '/wrong-notes', label: '오답노트' },
  { href: '#/admin', path: '/admin', label: '관리' },
]

const PRACTICE_PREFIX = '/practice/'

const MINI_TEST_SCOPES: MiniTestScope[] = ['all', 'wrong', 'marked']

function renderPage(path: string, query: URLSearchParams) {
  if (path.startsWith(PRACTICE_PREFIX)) {
    return <QuestionPracticePage questionId={path.slice(PRACTICE_PREFIX.length)} />
  }
  switch (path) {
    case '/questions':
      return <QuestionListPage />
    case '/marked':
      return <QuestionListPage markedOnly />
    case '/marked/practice':
      return <MarkedPracticePage />
    case '/mini-test': {
      const scope = query.get('scope') as MiniTestScope | null
      return <MiniTestPage key={scope ?? 'all'} initialScope={scope && MINI_TEST_SCOPES.includes(scope) ? scope : 'all'} />
    }
    case '/ox':
      return <OxQuizPage />
    case '/wrong-notes':
      return <WrongNotesPage />
    case '/admin':
      return <AdminPage />
    default:
      return <StudyListPage />
  }
}

function LearnerGate({ children }: { children: React.ReactNode }) {
  const { status, error, retry } = useLearnerBootstrap()

  if (status === 'loading') {
    return <p className="text-sm text-muted-foreground">학습 기록을 불러오는 중...</p>
  }
  if (status === 'error') {
    return (
      <div role="alert" className="flex flex-col items-center gap-2 text-sm">
        <p className="text-red-500">{error}</p>
        <Button size="sm" onClick={() => void retry()}>
          다시 시도
        </Button>
      </div>
    )
  }
  return <>{children}</>
}

function NoticeBanner() {
  const notice = useSyncExternalStore(learnerStore.subscribe, () => learnerStore.getSnapshot().notice)
  if (!notice) return null
  return (
    <div role="alert" className="flex w-full max-w-xl items-center justify-between gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
      <span>{notice}</span>
      <Button size="sm" variant="ghost" onClick={dismissLearnerNotice}>
        닫기
      </Button>
    </div>
  )
}

function App() {
  const [path, search = ''] = useHashRoute().split('?')
  const activePath = path.startsWith('/marked') ? '/marked' : path.startsWith(PRACTICE_PREFIX) ? '/questions' : path

  return (
    <main className="flex min-h-svh flex-col items-center gap-4 bg-background p-4 text-foreground md:p-6">
      <h1 className="text-xl font-semibold">정보시스템 감리사 기출문제 학습</h1>
      <nav aria-label="주 메뉴" className="flex flex-wrap justify-center gap-1">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.path}
            href={item.href}
            aria-current={activePath === item.path ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:py-1.5',
              activePath === item.path ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <NoticeBanner />
      {/* The admin page talks to /api/admin only, so it stays usable even if the learner data fails to load. */}
      {path === '/admin' ? (
        renderPage(path, new URLSearchParams(search))
      ) : (
        <LearnerGate>{renderPage(path, new URLSearchParams(search))}</LearnerGate>
      )}
    </main>
  )
}

export default App
