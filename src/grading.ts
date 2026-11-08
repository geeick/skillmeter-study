import type { Question } from './types'

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')

function normalizeHaskellType(input: string): string {
  let s = input
    .trim()
    .replace(/^\w+\s*::\s*/, '')
    .replace(/\s+/g, '')
    .replace(/Bool/gi, 'Bool')
    .replace(/String/g, '[Char]')

  const vars = new Map<string, string>()
  let next = 0
  s = s.replace(/\b[a-z][a-zA-Z0-9_']*\b/g, (token) => {
    if (['int', 'integer', 'double', 'float', 'char', 'bool'].includes(token.toLowerCase())) {
      return token.toLowerCase()
    }
    if (!vars.has(token)) vars.set(token, `t${next++}`)
    return vars.get(token)!
  })

  let changed = true
  while (changed && s.startsWith('(') && s.endsWith(')')) {
    let depth = 0
    changed = false
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') depth++
      if (s[i] === ')') depth--
      if (depth === 0 && i < s.length - 1) return s
    }
    s = s.slice(1, -1)
    changed = true
  }
  return s
}

export function gradeAnswer(question: Question, rawAnswer: string): { score: number; message: string } {
  const expected = question.answer
  const submitted = rawAnswer.trim()

  switch (question.grader) {
    case 'numeric': {
      const a = Number(submitted)
      const b = Number(expected)
      const ok = Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-9
      return { score: ok ? 1 : 0, message: ok ? 'Correct.' : `Expected ${expected}.` }
    }
    case 'ordered': {
      const clean = (s: string) => s.split('|').map(normalizeText)
      const a = clean(submitted)
      const b = clean(expected)
      const ok = a.length === b.length && a.every((v, i) => v === b[i])
      return { score: ok ? 1 : 0, message: ok ? 'Correct order.' : `Correct order: ${expected.replaceAll('|', ' → ')}` }
    }
    case 'unordered': {
      const clean = (s: string) => s.split('|').map(normalizeText).sort()
      const a = clean(submitted)
      const b = clean(expected)
      const ok = a.length === b.length && a.every((v, i) => v === b[i])
      return { score: ok ? 1 : 0, message: ok ? 'Correct set.' : `Expected: ${expected.replaceAll('|', ', ')}` }
    }
    case 'keywords':
    case 'rubric': {
      const terms = question.rubric.length ? question.rubric : expected.split('|')
      const normalized = normalizeText(submitted)
      const hits = terms.filter((term) => normalized.includes(normalizeText(term)))
      const score = terms.length ? hits.length / terms.length : 0
      return { score, message: `${hits.length}/${terms.length} required ideas found.` }
    }
    case 'haskell_type': {
      const ok = normalizeHaskellType(submitted) === normalizeHaskellType(expected)
      return { score: ok ? 1 : 0, message: ok ? 'Type matches.' : `Expected ${expected}.` }
    }
    case 'choice':
    case 'exact':
    default: {
      const ok = normalizeText(submitted) === normalizeText(expected)
      return { score: ok ? 1 : 0, message: ok ? 'Correct.' : `Expected ${expected}.` }
    }
  }
}
