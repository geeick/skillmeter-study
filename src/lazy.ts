export interface AnswerBlock {
  id: string
  text: string
  correctIndex: number
}

function seededShuffle<T>(items: T[], seedText: string): T[] {
  let seed = 0
  for (let i = 0; i < seedText.length; i++) {
    seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0
  }

  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const j = seed % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function chunkWords(answer: string): string[] {
  const clean = answer.trim()
  if (!clean) return []

  if (clean.includes('|')) {
    return clean.split('|').map((part) => part.trim()).filter(Boolean)
  }

  const words = clean.split(/\s+/)
  if (words.length <= 5) return words

  const chunkSize = words.length >= 12 ? 3 : 2
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '))
  }
  return chunks
}

export function makeAnswerBlocks(answer: string, seed: string): AnswerBlock[] {
  const chunks = chunkWords(answer)
  const blocks = chunks.map((text, index) => ({
    id: `${seed}-${index}`,
    text,
    correctIndex: index
  }))
  const shuffled = seededShuffle(blocks, seed)
  if (
    shuffled.length > 1 &&
    shuffled.every((block, index) => block.correctIndex === index)
  ) {
    return [...shuffled.slice(1), shuffled[0]]
  }
  return shuffled
}

export function blocksAreCorrect(selected: AnswerBlock[], total: number): boolean {
  return selected.length === total && selected.every((block, index) => block.correctIndex === index)
}
