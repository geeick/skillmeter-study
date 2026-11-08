# SkillMeter Study

Adaptive study PWA where each class contains multiple skills, and each skill has its own mastery meter and difficulty from 1-5.

## Features

- Any number of classes and skills
- Per-skill mastery meters
- Independent adaptive difficulty per skill
- CSV import for any subject
- Question modes including flashcards, multiple choice, written, repair, ordering, and numeric
- Session-level mode override
- Deterministic Haskell type checker
- Local progress and attempt history
- Installable PWA
- GitHub Pages deployment

## Local setup

```bash
npm install
npm run dev
```

## CSV format

```csv
id,class_name,subject,unit,skill,difficulty,mode,prompt,answer,grader,options,rubric,hint,explanation,tags
```

See `sample-study-pack.csv` and `CHATGPT_STUDY_PACK_PROMPT.md`.

## GitHub Pages

This repository is configured for:

https://geeick.github.io/skillmeter-study/

In GitHub, open Settings → Pages and set Source to **GitHub Actions**. The workflow in `.github/workflows/deploy.yml` will deploy on pushes to `main`.
