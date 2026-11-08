import Papa from 'papaparse'
import { z } from 'zod'
import type { GraderType, Question, StudyMode } from './types'

const modes = ['flashcard','multiple_choice','multi_select','written','fill_blanks','steps','repair','ordering','matching','numeric'] as const
const graders = ['exact','choice','numeric','unordered','ordered','keywords','rubric','haskell_type'] as const

const RowSchema = z.object({
  id: z.string().min(1),
  class_name: z.string().min(1),
  subject: z.string().default('General'),
  unit: z.string().default(''),
  skill: z.string().min(1),
  difficulty: z.coerce.number().int().min(1).max(5),
  mode: z.enum(modes),
  prompt: z.string().min(1),
  answer: z.string(),
  grader: z.enum(graders).default('exact'),
  options: z.string().default(''),
  rubric: z.string().default(''),
  hint: z.string().default(''),
  explanation: z.string().default(''),
  tags: z.string().default('')
})

const splitPipe = (value: string) => value ? value.split('|').map(x => x.trim()).filter(Boolean) : []

export async function parseQuestionCsv(file: File): Promise<Question[]> {
  const text = await file.text()
  const parsed = Papa.parse<Record<string,string>>(text, { header: true, skipEmptyLines: true })
  if (parsed.errors.length) throw new Error(parsed.errors[0].message)

  return parsed.data.map((raw, index) => {
    const result = RowSchema.safeParse(raw)
    if (!result.success) {
      const issue = result.error.issues[0]
      throw new Error(`Row ${index + 2}: ${issue.path.join('.')} ${issue.message}`)
    }
    const row = result.data
    return {
      id: row.id,
      className: row.class_name,
      subject: row.subject,
      unit: row.unit,
      skill: row.skill,
      difficulty: row.difficulty as Question['difficulty'],
      mode: row.mode as StudyMode,
      prompt: row.prompt.replaceAll('\\n','\n'),
      answer: row.answer,
      grader: row.grader as GraderType,
      options: splitPipe(row.options),
      rubric: splitPipe(row.rubric),
      hint: row.hint,
      explanation: row.explanation,
      tags: splitPipe(row.tags)
    }
  })
}
