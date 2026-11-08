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

export function updateDiagnosticProgress(
  current: SkillProgress,
  score: number,
  questionDifficulty: Question['difficulty']
): SkillProgress {
  const next = { ...current, attempts: current.attempts + 1 }

  if (score >= 0.99) next.correct += 1
  else if (score >= 0.5) next.partial += 1
  else next.incorrect += 1

  const evidence =
    score >= 0.99
      ? 30 + questionDifficulty * 14
      : score >= 0.5
        ? 18 + questionDifficulty * 10
        : Math.max(5, (questionDifficulty - 1) * 13)

  const diagnosticAttempts = Math.min(next.attempts, 4)
  const priorWeight = diagnosticAttempts <= 1 ? 0 : 0.45
  next.mastery = Math.round(
    Math.min(100, Math.max(0, current.mastery * priorWeight + evidence * (1 - priorWeight)))
  )

  const estimatedDifficulty = Math.max(
    1,
    Math.min(
      5,
      score >= 0.99
        ? questionDifficulty + 1
        : score >= 0.5
          ? questionDifficulty
          : questionDifficulty - 1
    )
  ) as SkillProgress['difficulty']

  next.difficulty = estimatedDifficulty
  next.momentum = 0
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
  const candidates = pool.filter((q) => !recentIds.includes(q.id))
  if (!candidates.length) return undefined

  const weighted = [...candidates].sort((a, b) => {
    const da = Math.abs(a.difficulty - progress.difficulty)
    const db = Math.abs(b.difficulty - progress.difficulty)
    return da - db
  })

  const close = weighted.filter((q) => Math.abs(q.difficulty - progress.difficulty) <= 1)
  const finalPool = close.length ? close : weighted
  return finalPool[Math.floor(Math.random() * finalPool.length)]
}

export function buildDiagnosticQueue(
  questions: Question[],
  modeOverride: StudyMode | 'recommended' = 'recommended'
): Question[] {
  const skills = [...new Set(questions.map((q) => q.skill))]
  const queue: Question[] = []

  for (const skill of skills) {
    const skillQuestions = questions.filter(
      (q) => q.skill === skill && (modeOverride === 'recommended' || q.mode === modeOverride)
    )
    if (!skillQuestions.length) continue

    const first = [...skillQuestions].sort(
      (a, b) => Math.abs(a.difficulty - 2) - Math.abs(b.difficulty - 2)
    )[0]
    queue.push(first)

    const remaining = skillQuestions.filter((q) => q.id !== first.id)
    if (remaining.length) {
      const second = [...remaining].sort(
        (a, b) => Math.abs(a.difficulty - 4) - Math.abs(b.difficulty - 4)
      )[0]
      queue.push(second)
    }
  }

  return queue
}

export function pickClassPracticeQuestion(
  questions: Question[],
  className: string,
  progressByKey: Record<string, SkillProgress>,
  skillKey: (className: string, skill: string) => string,
  modeOverride: StudyMode | 'recommended' = 'recommended',
  recentIds: string[] = []
): Question | undefined {
  if (!questions.length) return undefined

  const eligibleQuestions = questions.filter(
    (q) =>
      !recentIds.includes(q.id) &&
      (modeOverride === 'recommended' || q.mode === modeOverride)
  )
  const skills = [...new Set(eligibleQuestions.map((q) => q.skill))]
  if (!skills.length) return undefined

  const rankedSkills = skills
    .map((skill) => ({
      skill,
      progress: progressByKey[skillKey(className, skill)] ?? emptyProgress()
    }))
    .sort((a, b) => {
      if (a.progress.mastery !== b.progress.mastery) {
        return a.progress.mastery - b.progress.mastery
      }
      return a.progress.attempts - b.progress.attempts
    })

  const recentSkills = recentIds
    .map((id) => questions.find((q) => q.id === id)?.skill)
    .filter(Boolean) as string[]

  const notJustSeen = rankedSkills.filter((entry) => !recentSkills.slice(-2).includes(entry.skill))
  const skillPool = (notJustSeen.length ? notJustSeen : rankedSkills).slice(0, Math.min(3, rankedSkills.length))
  const chosen = skillPool[Math.floor(Math.random() * skillPool.length)]

  return pickQuestion(
    questions.filter((q) => q.skill === chosen.skill),
    chosen.progress,
    modeOverride,
    recentIds
  )
}
