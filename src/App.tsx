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

type SessionKind = 'skill' | 'diagnosis' | 'class-practice'

function Meter({value}:{value:number}) {
  return <div className="meter"><div className="fill" style={{width:`${value}%`}} /></div>
}

function QuestionCard({q,onDone}:{q:Question,onDone:(score:number,answer:string)=>void}) {
  const [answer,setAnswer]=useState('')
  const [feedback,setFeedback]=useState('')
  const [revealed,setRevealed]=useState(false)
  const [order,setOrder]=useState<string[]>([])

  const submit=(value=answer)=>{
    const r=gradeAnswer(q,value)
    setFeedback(r.message)
    onDone(r.score,value)
  }

  if(q.mode==='flashcard'){
    return <div className="card study-card">
      <pre>{q.prompt}</pre>
      {!revealed ? <button onClick={()=>setRevealed(true)}>Reveal answer</button> :
      <>
        <div className="reveal">{q.answer}</div>
        <div className="row">
          <button className="secondary" onClick={()=>onDone(0,'missed')}>Missed it</button>
          <button onClick={()=>onDone(1,'knew it')}>Knew it</button>
        </div>
      </>}
    </div>
  }

  if(q.mode==='multiple_choice'){
    return <div className="card study-card">
      <pre>{q.prompt}</pre>
      <div className="choices">
        {q.options.map(o=><button key={o} className="secondary" disabled={!!feedback} onClick={()=>{setAnswer(o);submit(o)}}>{o}</button>)}
      </div>
      {feedback && <Feedback q={q} text={feedback}/>}
    </div>
  }

  if(q.mode==='ordering'){
    return <div className="card study-card">
      <pre>{q.prompt}</pre>
      <div className="order-box">{order.length ? order.map((x,i)=><span key={x}>{i+1}. {x}</span>) : 'Tap items in order'}</div>
      <div className="choices">
        {q.options.map(o=><button key={o} className="secondary" disabled={order.includes(o)||!!feedback} onClick={()=>{
          const next=[...order,o]; setOrder(next); setAnswer(next.join('|'))
        }}>{o}</button>)}
      </div>
      <div className="row">
        <button className="secondary" onClick={()=>{setOrder([]);setAnswer('');setFeedback('')}}>Reset</button>
        <button disabled={order.length!==q.options.length||!!feedback} onClick={()=>submit()}>Check</button>
      </div>
      {feedback && <Feedback q={q} text={feedback}/>}
    </div>
  }

  return <div className="card study-card">
    <pre>{q.prompt}</pre>
    <textarea value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Type your answer..." disabled={!!feedback}/>
    <button disabled={!answer.trim()||!!feedback} onClick={()=>submit()}>Check</button>
    {feedback && <Feedback q={q} text={feedback}/>}
  </div>
}

function Feedback({q,text}:{q:Question,text:string}){
  return <div className="feedback"><strong>{text}</strong>{q.explanation && <span>{q.explanation}</span>}</div>
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
  const [diagnosticQueue,setDiagnosticQueue]=useState<Question[]>([])
  const [diagnosticIndex,setDiagnosticIndex]=useState(0)
  const [message,setMessage]=useState('')

  const classes=useMemo(()=>[...new Set(questions.map(q=>q.className))].sort(),[questions])
  const classQuestions=useMemo(()=>questions.filter(q=>q.className===selectedClass),[questions,selectedClass])
  const skills=useMemo(()=>[...new Set(classQuestions.map(q=>q.skill))].sort(),[classQuestions])

  const classMastery=skills.length
    ? Math.round(skills.reduce((s,skill)=>s+getProgress(progress,selectedClass,skill).mastery,0)/skills.length)
    : 0

  const recentClassIds=()=>attempts
    .filter(a=>a.className===selectedClass)
    .slice(-6)
    .map(a=>a.questionId)

  const startSkill=(skill:string)=>{
    setSessionKind('skill')
    setSelectedSkill(skill)
    const p=getProgress(progress,selectedClass,skill)
    const recent=attempts.filter(a=>a.className===selectedClass&&a.skill===skill).slice(-4).map(a=>a.questionId)
    setCurrent(pickQuestion(classQuestions.filter(q=>q.skill===skill),p,mode,recent)??null)
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
    setSelectedSkill(queue[0].skill)
    setCurrent(queue[0])
  }

  const startClassPractice=()=>{
    const q=pickClassPracticeQuestion(
      classQuestions,
      selectedClass,
      progress,
      skillKey,
      mode,
      recentClassIds()
    )
    if(!q){
      setMessage('No questions are available for that study mode.')
      return
    }
    setSessionKind('class-practice')
    setSelectedSkill(q.skill)
    setCurrent(q)
  }

  const next=()=>{
    if(sessionKind==='diagnosis'){
      const nextIndex=diagnosticIndex+1
      if(nextIndex>=diagnosticQueue.length){
        setCurrent(null)
        setDiagnosticQueue([])
        setDiagnosticIndex(0)
        setMessage('Diagnosis complete. Your skill meters and starting difficulties have been calibrated.')
        return
      }
      const q=diagnosticQueue[nextIndex]
      setDiagnosticIndex(nextIndex)
      setSelectedSkill(q.skill)
      setCurrent(q)
      return
    }

    if(sessionKind==='class-practice'){
      const q=pickClassPracticeQuestion(
        classQuestions,
        selectedClass,
        progress,
        skillKey,
        mode,
        recentClassIds()
      )
      if(q){
        setSelectedSkill(q.skill)
        setCurrent(q)
      }
      return
    }

    if(!selectedSkill)return
    const p=getProgress(progress,selectedClass,selectedSkill)
    const recent=attempts.filter(a=>a.className===selectedClass&&a.skill===selectedSkill).slice(-4).map(a=>a.questionId)
    setCurrent(pickQuestion(classQuestions.filter(q=>q.skill===selectedSkill),p,mode,recent)??null)
  }

  const record=(score:number,answer:string)=>{
    if(!current)return
    const activeSkill=current.skill
    const key=skillKey(selectedClass,activeSkill)
    const currentProgress=getProgress(progress,selectedClass,activeSkill)
    const updated=sessionKind==='diagnosis'
      ? updateDiagnosticProgress(currentProgress,score,current.difficulty)
      : updateSkillProgress(currentProgress,score)
    const nextProgress={...progress,[key]:updated}
    const nextAttempts=[
      ...attempts,
      {questionId:current.id,className:selectedClass,skill:activeSkill,submittedAnswer:answer,score,timestamp:Date.now()}
    ]
    setProgress(nextProgress)
    setAttempts(nextAttempts)
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
        : activeSkill

    return <main className="shell">
      <header>
        <button className="brand" onClick={()=>setCurrent(null)}>← SkillMeter</button>
        <span>{selectedClass}</span>
      </header>
      <section className="page narrow">
        <div className="study-head">
          <div>
            <p className="eyebrow">{sessionLabel}</p>
            <h1>{activeSkill}</h1>
            <p className="session-subtitle">Difficulty {current.difficulty}/5</p>
          </div>
          <div className="mastery-number">{p.mastery}%<small>mastery</small></div>
        </div>
        <Meter value={p.mastery}/>
        {sessionKind==='diagnosis' && <div className="diagnosis-progress">
          <span>Checking your level across the class</span>
          <strong>{diagnosticIndex+1} of {diagnosticQueue.length}</strong>
        </div>}
        <QuestionCard key={current.id+attempts.length} q={current} onDone={record}/>
        <button className="next" onClick={next}>
          {sessionKind==='diagnosis' && diagnosticIndex===diagnosticQueue.length-1 ? 'Finish diagnosis' : 'Next question'}
        </button>
      </section>
    </main>
  }

  return <main className="shell">
    <header>
      <div className="brand">SkillMeter</div>
      <label className="upload">Import CSV<input type="file" accept=".csv" onChange={e=>importCsv(e.target.files?.[0])}/></label>
    </header>

    <section className="page">
      {message && <div className="notice" onClick={()=>setMessage('')}>{message}</div>}

      <div className="hero">
        <p className="eyebrow">Adaptive study by skill</p>
        <h1>Master the class, one skill at a time.</h1>
        <p>Diagnose your starting level, practice the whole class, or focus on one skill.</p>
      </div>

      {classes.length===0 ? (
        <div className="card empty-state">
          <div className="empty-icon">＋</div>
          <h2>No classes yet</h2>
          <p>Import a study-pack CSV to add a class. Only classes contained in that CSV will appear here.</p>
          <label className="upload empty-upload">Import CSV<input type="file" accept=".csv" onChange={e=>importCsv(e.target.files?.[0])}/></label>
        </div>
      ) : <>
      <div className="class-tabs">
        {classes.map(c=><button key={c} className={c===selectedClass?'active-tab':'secondary'} onClick={()=>setSelectedClass(c)}>{c}</button>)}
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
            <small>Mix all skills in the class, with extra attention on your weaker areas.</small>
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
