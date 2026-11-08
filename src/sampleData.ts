import type { Question } from './types'

export const sampleQuestions: Question[] = [
  {
    id:'cs-pfa-1', className:'CS 131', subject:'Computer Science', unit:'Haskell',
    skill:'PFA & Type Inference', difficulty:2, mode:'written',
    prompt:'Infer the most general type of: foo f x = f (f x)',
    answer:'(a -> a) -> a -> a', grader:'haskell_type', options:[], rubric:[],
    hint:'The output of the first f must be valid input to the second f.',
    explanation:'f must map a type back to itself so it can be applied twice.', tags:['haskell','pfa']
  },
  {
    id:'cs-pfa-2', className:'CS 131', subject:'Computer Science', unit:'Haskell',
    skill:'PFA & Type Inference', difficulty:3, mode:'repair',
    prompt:'Repair this type:\nfilter g (map h xs) :: [b] -> [b]',
    answer:'[b]', grader:'haskell_type', options:[], rubric:[],
    hint:'filter g has already received its list.',
    explanation:'After application, filter returns a list, not another function.', tags:['haskell','repair']
  },
  {
    id:'cs-scope-1', className:'CS 131', subject:'Computer Science', unit:'Scope',
    skill:'Lexical Scoping', difficulty:2, mode:'multiple_choice',
    prompt:'f is defined where x = 1. g defines x = 2 and calls f. Under lexical scope, what does f print?',
    answer:'1', grader:'choice', options:['1','2','Name error','It depends on call order'], rubric:[],
    hint:'Look where f was defined.', explanation:'Lexical scope follows program structure.', tags:['scope']
  },
  {
    id:'cs-gc-1', className:'CS 131', subject:'Computer Science', unit:'Memory',
    skill:'Garbage Collection', difficulty:2, mode:'flashcard',
    prompt:'Which collector is especially attractive when very few objects survive?',
    answer:'Mark-and-copy', grader:'exact', options:[], rubric:[],
    hint:'Think about how much live data must move.', explanation:'Only surviving objects are copied.', tags:['gc']
  },
  {
    id:'bio-cell-1', className:'Biology 101', subject:'Biology', unit:'Cells',
    skill:'Cell Organelles', difficulty:1, mode:'flashcard',
    prompt:'Which organelle produces most ATP during aerobic respiration?',
    answer:'Mitochondrion', grader:'exact', options:[], rubric:[],
    hint:'Think cellular respiration.', explanation:'Oxidative phosphorylation occurs on the inner mitochondrial membrane.', tags:['cells']
  },
  {
    id:'bio-flow-1', className:'Biology 101', subject:'Biology', unit:'Circulation',
    skill:'Blood Flow', difficulty:3, mode:'ordering',
    prompt:'Order these structures for blood returning from the body toward the lungs.',
    answer:'Vena cava|Right atrium|Right ventricle|Pulmonary artery', grader:'ordered',
    options:['Pulmonary artery','Right ventricle','Vena cava','Right atrium'], rubric:[],
    hint:'Start with systemic venous return.', explanation:'Vena cava → right atrium → right ventricle → pulmonary artery.', tags:['circulation']
  },
  {
    id:'math-factor-1', className:'Math Review', subject:'Mathematics', unit:'Algebra',
    skill:'Factoring', difficulty:2, mode:'multiple_choice',
    prompt:'Which expression factors x² - 5x + 6?', answer:'(x - 2)(x - 3)', grader:'choice',
    options:['(x - 1)(x - 6)','(x - 2)(x - 3)','(x + 2)(x + 3)','(x - 3)(x + 2)'], rubric:[],
    hint:'Find two values whose product is 6 and sum is -5.', explanation:'-2 and -3 work.', tags:['algebra']
  }
]
