import { useMemo, useState } from 'react'
import './styles.css'
import { parseQuestionCsv } from './csv'
import { gradeAnswer } from './grading'
import { pickQuestion, updateSkillProgress } from './adaptive'
import { sampleQuestions } from './sampleData'
import { getProgress, loadAttempts, loadProgress, loadQuestions, saveAttempts, saveProgress, saveQuestions, skillKey } from './storage'
import type { Attempt, Question, SkillProgress, StudyMode } from './types'

const MODES: Array<StudyMode | 'recommended'> = [
  'recommended','flashcard','multiple_choice','written','repair','ordering','numeric'
]

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
  const [questions,setQuestions]=useState<Question[]>(()=>loadQuestions(sampleQuestions))
  const [progress,setProgress]=useState<Record<string,SkillProgress>>(()=>loadProgress())
  const [attempts,setAttempts]=useState<Attempt[]>(()=>loadAttempts())
  const [selectedClass,setSelectedClass]=useState('CS 131')
  const [selectedSkill,setSelectedSkill]=useState('')
  const [mode,setMode]=useState<StudyMode|'recommended'>('recommended')
  const [current,setCurrent]=useState<Question|null>(null)
  const [message,setMessage]=useState('')

  const classes=useMemo(()=>[...new Set(questions.map(q=>q.className))].sort(),[questions])
  const classQuestions=useMemo(()=>questions.filter(q=>q.className===selectedClass),[questions,selectedClass])
  const skills=useMemo(()=>[...new Set(classQuestions.map(q=>q.skill))].sort(),[classQuestions])

  const classMastery=skills.length
    ? Math.round(skills.reduce((s,skill)=>s+getProgress(progress,selectedClass,skill).mastery,0)/skills.length)
    : 0

  const start=(skill:string)=>{
    setSelectedSkill(skill)
    const p=getProgress(progress,selectedClass,skill)
    const recent=attempts.filter(a=>a.className===selectedClass&&a.skill===skill).slice(-4).map(a=>a.questionId)
    setCurrent(pickQuestion(classQuestions.filter(q=>q.skill===skill),p,mode,recent)??null)
  }

  const next=()=>{
    if(!selectedSkill)return
    const p=getProgress(progress,selectedClass,selectedSkill)
    const recent=attempts.filter(a=>a.className===selectedClass&&a.skill===selectedSkill).slice(-4).map(a=>a.questionId)
    setCurrent(pickQuestion(classQuestions.filter(q=>q.skill===selectedSkill),p,mode,recent)??null)
  }

  const record=(score:number,answer:string)=>{
    if(!current)return
    const key=skillKey(selectedClass,selectedSkill)
    const nextProgress={...progress,[key]:updateSkillProgress(getProgress(progress,selectedClass,selectedSkill),score)}
    const nextAttempts=[...attempts,{questionId:current.id,className:selectedClass,skill:selectedSkill,submittedAnswer:answer,score,timestamp:Date.now()}]
    setProgress(nextProgress); setAttempts(nextAttempts)
    saveProgress(nextProgress); saveAttempts(nextAttempts)
  }

  const importCsv=async(file?:File)=>{
    if(!file)return
    try{
      const imported=await parseQuestionCsv(file)
      const ids=new Set(imported.map(q=>q.id))
      const merged=[...questions.filter(q=>!ids.has(q.id)),...imported]
      setQuestions(merged); saveQuestions(merged)
      setSelectedClass(imported[0]?.className ?? selectedClass)
      setMessage(`Imported ${imported.length} questions.`)
    }catch(e){setMessage(e instanceof Error?e.message:'Import failed')}
  }

  if(current){
    const p=getProgress(progress,selectedClass,selectedSkill)
    return <main className="shell">
      <header><button className="brand" onClick={()=>setCurrent(null)}>← SkillMeter</button><span>{selectedClass}</span></header>
      <section className="page narrow">
        <div className="study-head">
          <div><p className="eyebrow">{selectedSkill}</p><h1>Difficulty {p.difficulty}/5</h1></div>
          <div className="mastery-number">{p.mastery}%<small>mastery</small></div>
        </div>
        <Meter value={p.mastery}/>
        <QuestionCard key={current.id+attempts.length} q={current} onDone={record}/>
        <button className="next" onClick={next}>Next question</button>
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
        <p>Each skill has its own mastery meter and difficulty level. Import any subject as a CSV.</p>
      </div>
      <div className="class-tabs">
        {classes.map(c=><button key={c} className={c===selectedClass?'active-tab':'secondary'} onClick={()=>setSelectedClass(c)}>{c}</button>)}
      </div>
      <div className="class-summary card">
        <div><p className="eyebrow">{selectedClass}</p><h2>{classMastery}% overall mastery</h2></div>
        <div className="mode-wrap">
          <label>Study mode</label>
          <select value={mode} onChange={e=>setMode(e.target.value as StudyMode|'recommended')}>
            {MODES.map(m=><option key={m} value={m}>{m.replaceAll('_',' ')}</option>)}
          </select>
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
              <div className="meta"><span>Difficulty {p.difficulty}/5</span><span>{p.attempts} attempts</span><span>{count} questions</span></div>
            </div>
            <button onClick={()=>start(skill)}>Study</button>
          </div>
        })}
      </div>
    </section>
  </main>
}
