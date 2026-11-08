import type { Attempt, Question, SkillProgress } from './types'
import { emptyProgress } from './adaptive'

const QUESTIONS_KEY = 'skillmeter.questions.v1'
const PROGRESS_KEY = 'skillmeter.progress.v1'
const ATTEMPTS_KEY = 'skillmeter.attempts.v1'

export function loadQuestions(fallback: Question[]): Question[] {
  try {
    const raw = localStorage.getItem(QUESTIONS_KEY)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function saveQuestions(questions: Question[]) {
  localStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions))
}

export function loadProgress(): Record<string, SkillProgress> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveProgress(progress: Record<string, SkillProgress>) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
}

export function loadAttempts(): Attempt[] {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveAttempts(attempts: Attempt[]) {
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts.slice(-500)))
}

export const skillKey = (className: string, skill: string) => `${className}::${skill}`

export function getProgress(progress: Record<string, SkillProgress>, className: string, skill: string) {
  return progress[skillKey(className, skill)] ?? emptyProgress()
}
