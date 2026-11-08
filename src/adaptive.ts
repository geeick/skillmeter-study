import type { Question, SkillProgress, StudyMode } from './types'

export const emptyProgress = (): SkillProgress => ({
  mastery: 0,
  difficulty: 1,
  momentum: 0,
  attempts: 0,
  correct: 0,
  partial: 0,
  incorrect: 0
})

export function updateSkillProgress(current: SkillProgress, score: number): SkillProgress {
  const next = { ...current, attempts: current.attempts + 1 }

  if (score >= 0.99) {
    next.correct += 1
    next.momentum += 1
  } else if (score >= 0.5) {
    next.partial += 1
    next.momentum += 0.25
  } else {
    next.incorrect += 1
    next.momentum -= 1
  }

  if (next.momentum >= 3 && next.difficulty < 5) {
    next.difficulty = (next.difficulty + 1) as SkillProgress['difficulty']
    next.momentum = 0
  } else if (next.momentum <= -2 && next.difficulty > 1) {
    next.difficulty = (next.difficulty - 1) as SkillProgress['difficulty']
    next.momentum = 0
  }

  const weighted = next.correct + next.partial * 0.55
  const accuracy = next.attempts ? weighted / next.attempts : 0
  const confidence = 1 - Math.exp(-next.attempts / 5)
  const difficultyBonus = (next.difficulty - 1) / 4
  next.mastery = Math.round(
    Math.min(100, Math.max(0, accuracy * confidence * 80 + difficultyBonus * 20))
  )

  return next
}

export function pickQuestion(
  questions: Question[],
  progress: SkillProgress,
  modeOverride: StudyMode | 'recommended' = 'recommended',
  recentIds: string[] = []
): Question | undefined {
  if (!questions.length) return undefined

  const modeFiltered = modeOverride === 'recommended'
    ? questions
    : questions.filter((q) => q.mode === modeOverride)

  const pool = modeOverride === 'recommended' ? questions : modeFiltered
  if (!pool.length) return undefined
  const unseen = pool.filter((q) => !recentIds.includes(q.id))
  const candidates = unseen.length ? unseen : pool

  const weighted = [...candidates].sort((a, b) => {
    const da = Math.abs(a.difficulty - progress.difficulty)
    const db = Math.abs(b.difficulty - progress.difficulty)
    return da - db
  })

  const close = weighted.filter((q) => Math.abs(q.difficulty - progress.difficulty) <= 1)
  const finalPool = close.length ? close : weighted
  return finalPool[Math.floor(Math.random() * finalPool.length)]
}
