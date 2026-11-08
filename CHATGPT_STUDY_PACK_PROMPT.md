# Generate a SkillMeter study pack

Upload your course files to ChatGPT and use this prompt:

Create a CSV study pack using ONLY the attached course materials.

Use this exact header:

id,class_name,subject,unit,skill,difficulty,mode,prompt,answer,grader,options,rubric,hint,explanation,tags

Break each class into meaningful skills. Give each question a difficulty from 1 to 5:
1 = direct recall
2 = straightforward application
3 = moderate application
4 = multi-step or subtle
5 = exam-level synthesis or common traps

Available modes:
flashcard, multiple_choice, multi_select, written, fill_blanks, steps, repair, ordering, matching, numeric

Choose the mode based on the learning objective, not just the subject. Important concepts should have multiple variants in different modes when useful.

Available graders:
exact, choice, numeric, unordered, ordered, keywords, rubric, haskell_type

For list fields such as options, rubric, and tags, separate items with |.

Wrong multiple-choice answers should represent realistic student mistakes. Include concise hints and explanations. Generate questions across difficulties 1-5 for every major skill when supported by the material.

Return a downloadable CSV file, not a Markdown table.
