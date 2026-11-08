import { useMemo, useState } from 'react'
import './styles.css'
import { parseQuestionCsv } from './csv'
import { gradeAnswer } from './grading'
import {
  buildDiagnosticQueue,
  pickClassPracticeQuestion,
  pickQuestion,
  updateDiagnosticProgress,
  updateSkillProgress
} from './adaptive'
import { blocksAreCorrect, makeAnswerBlocks, type AnswerBlock } from './lazy'
import {
  getProgress,
  loadAttempts,
  loadProgress,
  loadQuestions,
  saveAttempts,
  saveProgress,
  saveQuestions,
  skillKey
} from './storage'
import type { Attempt, Question, SkillProgress, StudyMode } from './types'

const MODES: Array<StudyMode | 'recommended'> = [
  'recommended','flashcard','multiple_choice','written','repair','ordering','numeric'
]

type SessionKind = 'skill' | 'diagnosis' | 'class-practice' | 'lazy'
type FeedbackState = { score: number; message: string }

function Meter({value}:{value:number}) {
  return <div className="meter"><div className="fill" style={{width:`${value}%`}} /></div>
}

function Feedback({q,feedback}:{q:Question,feedback:FeedbackState}) {
  const correct = feedback.score >= 0.99
  const partial = feedback.score >= 0.5 && !correct
  return <div className={`feedback ${correct ? 'feedback-correct' : 'feedback-wrong'}`}>
    <strong>{correct ? '✓ Correct' : partial ? '△ Partially correct' : '✕ Incorrect'}</strong>
    {feedback.message && <span>{feedback.message}</span>}
    {!correct && q.explanation && <span><b>Why:</b> {q.explanation}</span>}
    {!correct && <span className="correct-answer"><b>Correct answer:</b> {q.answer.replaceAll('|',' → ')}</span>}
  </div>
}

function LazyQuestion({
  q,
  onDone
}:{
  q:Question
  onDone:(score:number,answer:string)=>void
}) {
  const blocks = useMemo(()=>makeAnswerBlocks(q.answer,q.id),[q.answer,q.id])
  const [selected,setSelected] = useState<AnswerBlock[]>([])
  const [feedback,setFeedback] = useState<FeedbackState|null>(null)

  const available = blocks.filter(block => !selected.some(item => item.id===block.id))

  const choose = (block:AnswerBlock) => {
    if(feedback) return
    setSelected(prev=>[...prev,block])
  }

  const remove = (block:AnswerBlock) => {
    if(feedback) return
    setSelected(prev=>prev.filter(item=>item.id!==block.id))
  }

  const check = () => {
    if(feedback || selected.length!==blocks.length) return
    const ok = blocksAreCorrect(selected,blocks.length)
    const value = selected.map(block=>block.text).join(' ')
    const nextFeedback = {
      score: ok ? 1 : 0,
      message: ok ? 'Every block is in the right place.' : 'The blocks are not in the correct order.'
    }
    setFeedback(nextFeedback)
    onDone(nextFeedback.score,value)
  }

  return <div className="card study-card lazy-question">
    <pre>{q.prompt}</pre>

    <p className="block-label">Build the answer</p>
    <div className="block-answer">
      {selected.length===0 && <span className="block-placeholder">Tap blocks below to place them here.</span>}
      {selected.map((block,index)=>
        <button
          key={block.id}
          className="answer-block placed-block"
          onClick={()=>remove(block)}
          disabled={!!feedback}
        >
          <span>{index+1}</span>{block.text}
        </button>
      )}
    </div>

    <p className="block-label">Blocks</p>
    <div className="block-bank">
      {available.map(block=>
        <button
          key={block.id}
          className="answer-block"
          onClick={()=>choose(block)}
          disabled={!!feedback}
        >
          {block.text}
        </button>
      )}
    </div>

    <div className="row lazy-actions">
      <button
        className="secondary"
        onClick={()=>setSelected([])}
        disabled={selected.length===0 || !!feedback}
      >
        Clear
      </button>
      <button
        onClick={check}
        disabled={selected.length!==blocks.length || !!feedback}
      >
        Check answer
      </button>
    </div>

    {feedback && <Feedback q={q} feedback={feedback}/>}
  </div>
}

function QuestionCard({
  q,
  onDone,
  lazyMode=false
}:{
  q:Question
  onDone:(score:number,answer:string)=>void
  lazyMode?:boolean
}) {
  const [answer,setAnswer]=useState('')
  const [feedback,setFeedback]=useState<FeedbackState|null>(null)
  const [revealed,setRevealed]=useState(false)
  const [order,setOrder]=useState<string[]>([])

  if(lazyMode) return <LazyQuestion q={q} onDone={onDone}/>

  const submit=(value=answer)=>{
    if(feedback) return
    const r=gradeAnswer(q,value)
    setFeedback(r)
    onDone(r.score,value)
  }

  const markFlashcard=(score:number,value:string)=>{
    if(feedback) return
    const result = {
      score,
      message: score===1 ? 'You marked this as known.' : 'You marked this as missed.'
    }
    setFeedback(result)
    onDone(score,value)
  }

  if(q.mode==='flashcard'){
    return <div className="card study-card">
      <pre>{q.prompt}</pre>
      {!revealed ? <button onClick={()=>setRevealed(true)}>Reveal answer</button> :
      <>
        <div className="reveal">{q.answer}</div>
        <div className="row">
          <button className="secondary" disabled={!!feedback} onClick={()=>markFlashcard(0,'missed')}>Missed it</button>
          <button disabled={!!feedback} onClick={()=>markFlashcard(1,'knew it')}>Knew it</button>
        </div>
        {feedback && <Feedback q={q} feedback={feedback}/>}
      </>}
    </div>
  }

  if(q.mode==='multiple_choice'){
    return <div className="card study-card">
      <pre>{q.prompt}</pre>
      <div className="choices">
        {q.options.map(o=>
          <button
            key={o}
            className="secondary"
            disabled={!!feedback}
            onClick={()=>{setAnswer(o);submit(o)}}
          >
            {o}
          </button>
        )}
      </div>
      {feedback && <Feedback q={q} feedback={feedback}/>}
    </div>
  }

  if(q.mode==='ordering'){
    return <div className="card study-card">
      <pre>{q.prompt}</pre>
      <div className="order-box">
        {order.length
          ? order.map((x,i)=><span key={x}>{i+1}. {x}</span>)
          : 'Tap items in order'}
      </div>
      <div className="choices">
        {q.options.map(o=>
          <button
            key={o}
            className="secondary"
            disabled={order.includes(o)||!!feedback}
            onClick={()=>{
              const next=[...order,o]
              setOrder(next)
              setAnswer(next.join('|'))
            }}
          >
            {o}
          </button>
        )}
      </div>
      <div className="row">
        <button
          className="secondary"
          onClick={()=>{setOrder([]);setAnswer('');setFeedback(null)}}
          disabled={!!feedback}
        >
          Reset
        </button>
        <button
          disabled={order.length!==q.options.length||!!feedback}
          onClick={()=>submit()}
        >
          Check
        </button>
      </div>
      {feedback && <Feedback q={q} feedback={feedback}/>}
    </div>
  }

  return <div className="card study-card">
    <pre>{q.prompt}</pre>
    <textarea
      value={answer}
      onChange={e=>setAnswer(e.target.value)}
      placeholder="Type your answer..."
      disabled={!!feedback}
    />
    <button disabled={!answer.trim()||!!feedback} onClick={()=>submit()}>Check</button>
    {feedback && <Feedback q={q} feedback={feedback}/>}
  </div>
}

export default function App(){
  const [questions,setQuestions]=useState<Question[]>(()=>loadQuestions([]))
  const [progress,setProgress]=useState<Record<string,SkillProgress>>(()=>loadProgress())
  const [attempts,setAttempts]=useState<Attempt[]>(()=>loadAttempts())
  const [selectedClass,setSelectedClass]=useState(()=>questions[0]?.className ?? '')
  const [selectedSkill,setSelectedSkill]=useState('')
  const [mode,setMode]=useState<StudyMode|'recommended'>('recommended')
  const [current,setCurrent]=useState<Question|null>(null)
  const [sessionKind,setSessionKind]=useState<SessionKind>('skill')
  const [sessionSeenIds,setSessionSeenIds]=useState<string[]>([])
  const [answeredCurrent,setAnsweredCurrent]=useState(false)
  const [diagnosticQueue,setDiagnosticQueue]=useState<Question[]>([])
  const [diagnosticIndex,setDiagnosticIndex]=useState(0)
  const [message,setMessage]=useState('')

  const classes=useMemo(()=>[...new Set(questions.map(q=>q.className))].sort(),[questions])
  const classQuestions=useMemo(()=>questions.filter(q=>q.className===selectedClass),[questions,selectedClass])
  const skills=useMemo(()=>[...new Set(classQuestions.map(q=>q.skill))].sort(),[classQuestions])

  const classMastery=skills.length
    ? Math.round(skills.reduce((s,skill)=>s+getProgress(progress,selectedClass,skill).mastery,0)/skills.length)
    : 0

  const setSessionQuestion=(q:Question)=>{
    setSelectedSkill(q.skill)
    setCurrent(q)
    setAnsweredCurrent(false)
    setSessionSeenIds(prev=>prev.includes(q.id)?prev:[...prev,q.id])
  }

  const finishSession=(text:string)=>{
    setCurrent(null)
    setSelectedSkill('')
    setSessionSeenIds([])
    setAnsweredCurrent(false)
    setMessage(text)
  }

  const startSkill=(skill:string)=>{
    setSessionKind('skill')
    setSelectedSkill(skill)
    setSessionSeenIds([])
    const p=getProgress(progress,selectedClass,skill)
    const q=pickQuestion(classQuestions.filter(q=>q.skill===skill),p,mode,[])
    if(!q){
      setMessage('No questions are available for that study mode.')
      return
    }
    setCurrent(q)
    setAnsweredCurrent(false)
    setSessionSeenIds([q.id])
  }

  const startDiagnosis=()=>{
    const queue=buildDiagnosticQueue(classQuestions,mode)
    if(!queue.length){
      setMessage('No questions are available for that study mode.')
      return
    }
    setSessionKind('diagnosis')
    setDiagnosticQueue(queue)
    setDiagnosticIndex(0)
    setSessionSeenIds([queue[0].id])
    setSelectedSkill(queue[0].skill)
    setCurrent(queue[0])
    setAnsweredCurrent(false)
  }

  const startClassPractice=()=>{
    setSessionKind('class-practice')
    setSessionSeenIds([])
    const q=pickClassPracticeQuestion(
      classQuestions,
      selectedClass,
      progress,
      skillKey,
      mode,
      []
    )
    if(!q){
      setMessage('No questions are available for that study mode.')
      return
    }
    setSelectedSkill(q.skill)
    setCurrent(q)
    setAnsweredCurrent(false)
    setSessionSeenIds([q.id])
  }

  const startLazy=()=>{
    setSessionKind('lazy')
    setSessionSeenIds([])
    const q=pickClassPracticeQuestion(
      classQuestions,
      selectedClass,
      progress,
      skillKey,
      'recommended',
      []
    )
    if(!q){
      setMessage('There are no questions available for Lazy Mode.')
      return
    }
    setSelectedSkill(q.skill)
    setCurrent(q)
    setAnsweredCurrent(false)
    setSessionSeenIds([q.id])
  }

  const next=()=>{
    if(!answeredCurrent) return

    if(sessionKind==='diagnosis'){
      const nextIndex=diagnosticIndex+1
      if(nextIndex>=diagnosticQueue.length){
        setDiagnosticQueue([])
        setDiagnosticIndex(0)
        finishSession('Diagnosis complete. Your skill meters and starting difficulties have been calibrated.')
        return
      }
      const q=diagnosticQueue[nextIndex]
      setDiagnosticIndex(nextIndex)
      setSessionQuestion(q)
      return
    }

    if(sessionKind==='class-practice' || sessionKind==='lazy'){
      const q=pickClassPracticeQuestion(
        classQuestions,
        selectedClass,
        progress,
        skillKey,
        sessionKind==='lazy' ? 'recommended' : mode,
        sessionSeenIds
      )
      if(!q){
        finishSession(
          sessionKind==='lazy'
            ? 'Lazy Mode complete. You finished every available question without repeats.'
            : 'Class Practice complete. You finished every available question in this session without repeats.'
        )
        return
      }
      setSessionQuestion(q)
      return
    }

    if(!selectedSkill)return
    const p=getProgress(progress,selectedClass,selectedSkill)
    const q=pickQuestion(
      classQuestions.filter(q=>q.skill===selectedSkill),
      p,
      mode,
      sessionSeenIds
    )
    if(!q){
      finishSession('Skill practice complete. You finished every available question in this session without repeats.')
      return
    }
    setSessionQuestion(q)
  }

  const record=(score:number,answer:string)=>{
    if(!current || answeredCurrent)return
    const activeSkill=current.skill
    const key=skillKey(selectedClass,activeSkill)
    const currentProgress=getProgress(progress,selectedClass,activeSkill)
    const updated=sessionKind==='diagnosis'
      ? updateDiagnosticProgress(currentProgress,score,current.difficulty)
      : updateSkillProgress(currentProgress,score)

    const nextProgress={...progress,[key]:updated}
    const nextAttempts=[
      ...attempts,
      {
        questionId:current.id,
        className:selectedClass,
        skill:activeSkill,
        submittedAnswer:answer,
        score,
        timestamp:Date.now()
      }
    ]

    setProgress(nextProgress)
    setAttempts(nextAttempts)
    setAnsweredCurrent(true)
    saveProgress(nextProgress)
    saveAttempts(nextAttempts)
  }

  const importCsv=async(file?:File)=>{
    if(!file)return
    try{
      const imported=await parseQuestionCsv(file)
      setQuestions(imported)
      saveQuestions(imported)
      setSelectedClass(imported[0]?.className ?? '')
      setCurrent(null)
      setSelectedSkill('')
      setSessionSeenIds([])
      setAnsweredCurrent(false)
      setMessage(`Imported ${imported.length} questions. The class list now matches this CSV.`)
    }catch(e){
      setMessage(e instanceof Error?e.message:'Import failed')
    }
  }

  if(current){
    const activeSkill=current.skill
    const p=getProgress(progress,selectedClass,activeSkill)
    const sessionLabel=sessionKind==='diagnosis'
      ? `Diagnosis ${diagnosticIndex+1}/${diagnosticQueue.length}`
      : sessionKind==='class-practice'
        ? 'Class Practice'
        : sessionKind==='lazy'
          ? 'Lazy Mode'
          : activeSkill

    return <main className="shell">
      <header>
        <button className="brand" onClick={()=>finishSession('')}>← SkillMeter</button>
        <span>{selectedClass}</span>
      </header>

      <section className="page narrow">
        <div className="study-head">
          <div>
            <p className="eyebrow">{sessionLabel}</p>
            <h1>{activeSkill}</h1>
            <p className="session-subtitle">
              Difficulty {current.difficulty}/5
              {sessionKind==='lazy' ? ' · place the blocks in the right order' : ''}
            </p>
          </div>
          <div className="mastery-number">{p.mastery}%<small>mastery</small></div>
        </div>

        <Meter value={p.mastery}/>

        {sessionKind==='diagnosis' && <div className="diagnosis-progress">
          <span>Checking your level across the class</span>
          <strong>{diagnosticIndex+1} of {diagnosticQueue.length}</strong>
        </div>}

        <QuestionCard
          key={current.id}
          q={current}
          onDone={record}
          lazyMode={sessionKind==='lazy'}
        />

        <button className="next" disabled={!answeredCurrent} onClick={next}>
          {!answeredCurrent
            ? 'Answer this question first'
            : sessionKind==='diagnosis' && diagnosticIndex===diagnosticQueue.length-1
              ? 'Finish diagnosis'
              : 'Next question'}
        </button>
      </section>
    </main>
  }

  return <main className="shell">
    <header>
      <div className="brand">SkillMeter</div>
      <label className="upload">
        Import CSV
        <input type="file" accept=".csv" onChange={e=>importCsv(e.target.files?.[0])}/>
      </label>
    </header>

    <section className="page">
      {message && <div className="notice" onClick={()=>setMessage('')}>{message}</div>}

      <div className="hero">
        <p className="eyebrow">Adaptive study by skill</p>
        <h1>Master the class, one skill at a time.</h1>
        <p>Diagnose your level, practice the whole class, use block-based Lazy Mode, or focus on one skill.</p>
      </div>

      {classes.length===0 ? (
        <div className="card empty-state">
          <div className="empty-icon">＋</div>
          <h2>No classes yet</h2>
          <p>Import a study-pack CSV to add a class. Only classes contained in that CSV will appear here.</p>
          <label className="upload empty-upload">
            Import CSV
            <input type="file" accept=".csv" onChange={e=>importCsv(e.target.files?.[0])}/>
          </label>
        </div>
      ) : <>
        <div className="class-tabs">
          {classes.map(c=>
            <button
              key={c}
              className={c===selectedClass?'active-tab':'secondary'}
              onClick={()=>setSelectedClass(c)}
            >
              {c}
            </button>
          )}
        </div>

        <div className="class-summary card">
          <div>
            <p className="eyebrow">{selectedClass}</p>
            <h2>{classMastery}% overall mastery</h2>
          </div>
          <div className="mode-wrap">
            <label>Question format</label>
            <select value={mode} onChange={e=>setMode(e.target.value as StudyMode|'recommended')}>
              {MODES.map(m=><option key={m} value={m}>{m.replaceAll('_',' ')}</option>)}
            </select>
          </div>
        </div>

        <div className="session-grid">
          <button className="session-card diagnosis-card" onClick={startDiagnosis}>
            <span className="session-icon">◎</span>
            <span>
              <strong>Diagnosis</strong>
              <small>Sample every skill and estimate your starting mastery and difficulty.</small>
            </span>
            <span className="session-arrow">→</span>
          </button>

          <button className="session-card practice-card" onClick={startClassPractice}>
            <span className="session-icon">↻</span>
            <span>
              <strong>Class Practice</strong>
              <small>Mix all skills, prioritize weaker areas, and do not repeat questions in the session.</small>
            </span>
            <span className="session-arrow">→</span>
          </button>

          <button className="session-card lazy-card" onClick={startLazy}>
            <span className="session-icon">▦</span>
            <span>
              <strong>Lazy Mode</strong>
              <small>No typing and no repeats. Build each answer by placing the correct blocks in order.</small>
            </span>
            <span className="session-arrow">→</span>
          </button>
        </div>

        <div className="section-heading">
          <div>
            <p className="eyebrow">Skills</p>
            <h2>Practice one skill</h2>
          </div>
        </div>

        <div className="skills">
          {skills.map(skill=>{
            const p=getProgress(progress,selectedClass,skill)
            const count=classQuestions.filter(q=>q.skill===skill).length
            return <div className="card skill" key={skill}>
              <div className="skill-main">
                <div className="row spread"><h3>{skill}</h3><strong>{p.mastery}%</strong></div>
                <Meter value={p.mastery}/>
                <div className="meta">
                  <span>Difficulty {p.difficulty}/5</span>
                  <span>{p.attempts} attempts</span>
                  <span>{count} questions</span>
                </div>
              </div>
              <button onClick={()=>startSkill(skill)}>Study</button>
            </div>
          })}
        </div>
      </>}
    </section>
  </main>
}
