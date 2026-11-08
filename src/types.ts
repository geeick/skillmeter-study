export type StudyMode =
  | 'flashcard'
  | 'multiple_choice'
  | 'multi_select'
  | 'written'
  | 'fill_blanks'
  | 'steps'
  | 'repair'
  | 'ordering'
  | 'matching'
  | 'numeric'

export type GraderType =
  | 'exact'
  | 'choice'
  | 'numeric'
  | 'unordered'
  | 'ordered'
  | 'keywords'
  | 'rubric'
  | 'haskell_type'

export interface Question {
  id: string
  className: string
  subject: string
  unit: string
  skill: string
  difficulty: 1 | 2 | 3 | 4 | 5
  mode: StudyMode
  prompt: string
  answer: string
  grader: GraderType
  options: string[]
  rubric: string[]
  hint: string
  explanation: string
  tags: string[]
}

export interface SkillProgress {
  mastery: number
  difficulty: 1 | 2 | 3 | 4 | 5
  momentum: number
  attempts: number
  correct: number
  partial: number
  incorrect: number
}

export interface Attempt {
  questionId: string
  className: string
  skill: string
  submittedAnswer: string
  score: number
  timestamp: number
}

export interface StudyClass {
  name: string
  subject: string
  questions: Question[]
}
