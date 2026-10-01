// AI quiz (replaces the image puzzle). Per round: 2 attempts, 5 questions each, timed.
// The server picks/shuffles the questions and grades the answers; correct answers never reach the browser.
// Passing unlocks the round's reward prompt. A participant never sees the same question twice (60-question bank).
const crypto = require('crypto');
const LIMIT_MS = (Number(process.env.QUIZ_SECONDS) || 60) * 1000;
const GRACE_MS = 3000;                                       // network latency allowance
const PER = Number(process.env.QUIZ_QUESTIONS) || 5;         // questions per attempt
const PASS = Number(process.env.QUIZ_PASS) || 3;             // correct answers needed
const MAX_ATTEMPTS = 2;

// [question, CORRECT answer, wrong, wrong, wrong]  (options are shuffled per attempt)
const BANK = [
  ['What does "LLM" stand for?', 'Large Language Model', 'Linear Logic Machine', 'Long Learning Memory', 'Limited Language Module'],
  ['In AI, what is a "prompt"?', 'The input instruction given to an AI model', 'A type of graphics card', 'A trained model file', 'A dataset label'],
  ['Which prompt is most likely to give a good website?', 'Build a responsive bakery site with a hero, product cards, a contact form and a mobile menu', 'make website', 'website please', 'do it fast'],
  ['What is an AI "hallucination"?', 'Confident output that is false or made up', 'The model overheating', 'Training on images only', 'A slow response'],
  ['What does "GPT" stand for?', 'Generative Pre-trained Transformer', 'General Purpose Terminal', 'Graph Processing Tool', 'Generated Prompt Text'],
  ['In language models, what is a "token"?', 'A small chunk of text the model processes', 'A login credential', 'A CPU core', 'A payment coin'],
  ['Which technique puts worked examples inside the prompt?', 'Few-shot prompting', 'Overfitting', 'Backpropagation', 'Quantization'],
  ['What is "zero-shot prompting"?', 'Asking for a task without giving any examples', 'Sending an empty prompt', 'Using a model with zero parameters', 'Resetting the model'],
  ['What does the "temperature" setting control?', 'How random / creative the output is', 'How hot the hardware gets', 'The output language', 'The price per token'],
  ['A higher temperature generally produces…', 'More varied, creative output', 'Always factual output', 'Shorter answers only', 'Faster hardware'],
  ['What is "overfitting"?', 'A model memorises training data and generalises badly', 'A model that is too small', 'A model that trains too fast', 'A model with no data'],
  ['Supervised learning uses…', 'Labelled data', 'No data at all', 'Only rewards', 'Random noise'],
  ['Reinforcement learning learns mainly from…', 'Rewards and penalties', 'Labelled photos only', 'Clustering', 'File compression'],
  ['Which of these is a neural-network activation function?', 'ReLU', 'HTTP', 'SQL', 'CSS'],
  ['What is "computer vision"?', 'Teaching machines to understand images and video', 'Designing network cables', 'Designing databases', 'Rendering fonts'],
  ['What does "NLP" stand for in AI?', 'Natural Language Processing', 'Network Layer Protocol', 'Neural Logic Program', 'Numeric Loop Parsing'],
  ['Chain-of-thought prompting encourages the model to…', 'Reason step by step', 'Give shorter answers', 'Generate images', 'Guess randomly'],
  ['What is a "system prompt"?', 'Instructions that set the AI\'s role and behaviour', 'A BIOS startup message', 'The user\'s password', 'An error log'],
  ['What is a model\'s "context window"?', 'The maximum text it can consider at once', 'A window on the screen', 'A browser tab', 'The training duration'],
  ['Which is a common source of AI bias?', 'Training data that reflects unfair patterns', 'Too many GPUs', 'A slow internet connection', 'A large monitor'],
  ['What is a "deepfake"?', 'Synthetic media that imitates real people', 'An encrypted file', 'Data from the deep sea', 'A backup type'],
  ['What is "fine-tuning"?', 'Training a pre-trained model further on specific data', 'Adjusting monitor colours', 'Compressing a file', 'Cleaning a keyboard'],
  ['What is "prompt injection"?', 'Text that tries to override the AI\'s instructions', 'A medical injection', 'Adding CSS to a page', 'A database index'],
  ['What does "RAG" stand for in AI?', 'Retrieval-Augmented Generation', 'Random Access Graph', 'Rapid AI Gateway', 'Recursive Answer Grid'],
  ['The Transformer architecture was introduced in the paper…', '"Attention Is All You Need"', '"Deep Blue Wins"', '"The Perceptron Manual"', '"Big Data Rising"'],
  ['Why are GPUs used for AI training?', 'They do huge numbers of parallel matrix calculations', 'They print faster', 'They store emails', 'They type faster'],
  ['Which best describes generative AI?', 'AI that creates new text, images or audio', 'AI that only sorts data', 'AI that only detects spam', 'AI that only plays chess'],
  ['Which model family is widely used for image generation?', 'Diffusion models', 'Binary trees', 'Hash maps', 'Linked lists'],
  ['What does the Turing Test evaluate?', 'Whether a machine\'s conversation is indistinguishable from a human\'s', 'GPU speed', 'Battery life', 'Storage size'],
  ['Who coined the term "artificial intelligence" (1956)?', 'John McCarthy', 'Bill Gates', 'Steve Jobs', 'Linus Torvalds'],
  ['What makes a website-generating prompt better?', 'Naming sections, style and behaviour you want', 'Using a single word', 'Leaving out all details', 'Writing in random languages'],
  ['If the AI output is wrong, what should you do first?', 'Refine the prompt with clearer details and constraints', 'Give up', 'Switch off the internet', 'Type in capital letters only'],
  ['Which is an example of role prompting?', '"You are an expert front-end developer…"', '"Hello"', '"OK"', '"???"'],
  ['An AI-generated single-page website is typically…', 'One HTML file with CSS and JavaScript', 'An MP3 file', 'A scanned PDF', 'A ZIP of photos only'],
  ['Why put "responsive" in a web prompt?', 'So the layout adapts to phone, tablet and desktop', 'To make it play sound', 'To remove all CSS', 'To force fullscreen only'],
  ['What is a "parameter" in a neural network?', 'A learned weight value', 'A web address', 'A cable', 'A username'],
  ['Which is an example of unsupervised learning?', 'Grouping customers into clusters', 'Classifying labelled spam emails', 'A robot learning from rewards', 'Recognising labelled cat photos'],
  ['What does "inference" mean for a trained model?', 'Using the model to make predictions', 'Training it from scratch', 'Collecting the data', 'Deleting the model'],
  ['What is a "multimodal" AI model?', 'One that handles several input types, like text and images', 'One that only reads numbers', 'One that only handles audio', 'One that speaks one language'],
  ['Which is a major AI ethics concern?', 'Privacy and misuse of personal data', 'Keyboard layout', 'Paper size', 'Font colour'],
  ['What is "explainable AI" trying to do?', 'Make a model\'s decisions understandable', 'Make models louder', 'Hide the results', 'Reduce file size'],
  ['What is "data augmentation"?', 'Creating extra training samples from existing data', 'Deleting old data', 'Encrypting data', 'Printing data'],
  ['When can accuracy alone be misleading?', 'When the classes are heavily imbalanced', 'When the data is perfectly balanced', 'When the model is tiny', 'When the screen is small'],
  ['Which Python library is popular for classic machine learning?', 'scikit-learn', 'Photoshop', 'Notepad', 'PowerPoint'],
  ['Which library is popular for deep learning?', 'PyTorch', 'jQuery UI', 'Bootstrap', 'Express'],
  ['What does "API" stand for?', 'Application Programming Interface', 'Advanced Processing Input', 'Automated Page Index', 'Applied Program Icon'],
  ['Why must an AI API key stay secret?', 'Others could misuse it and run up costs', 'It is only decoration', 'Browsers need it to be public', 'It speeds up CSS'],
  ['What is a model "benchmark"?', 'A standard test used to compare model performance', 'A bench in a lab', 'A budget plan', 'A backup copy'],
  ['Which prompt tip helps most with clean output?', 'State the exact output format, e.g. "return only HTML"', 'Never mention the format', 'Ask unrelated questions', 'Use only emojis'],
  ['What are "guardrails" in AI systems?', 'Rules and filters that limit unsafe output', 'Road barriers', 'GPU cooling parts', 'Network cables'],
  ['What is "AGI"?', 'Hypothetical AI with human-level general ability', 'Advanced Graphics Interface', 'Automated Grid Input', 'Audio Gain Index'],
  ['Which approach best reduces hallucinations?', 'Grounding answers in provided documents or sources', 'Raising the temperature', 'Always shortening the prompt', 'Using random seeds'],
  ['What is an "embedding"?', 'A list of numbers that represents the meaning of text', 'A video format', 'A printer driver', 'A CSS rule'],
  ['What does the attention mechanism let a model do?', 'Focus on the most relevant parts of the input', 'Cool down its chips', 'Compress video', 'Encrypt messages'],
  ['What is a sensible first step in a machine-learning project?', 'Define the problem and gather data', 'Deploy immediately', 'Buy new monitors', 'Design a logo'],
  ['What does "prompt iteration" mean?', 'Improving a prompt over several tries', 'Deleting all prompts', 'Using one prompt forever', 'Translating prompts only'],
  ['What is the wisest way to treat AI-written code?', 'Review and test it before trusting it', 'Ship it untested', 'Assume it is always perfect', 'Never run it'],
  ['The bias–variance trade-off is about balancing…', 'Underfitting and overfitting', 'Sound mixing', 'Network latency', 'Colour theory'],
  ['What is a loss function used for?', 'Measuring how wrong predictions are during training', 'Showing advertisements', 'Formatting a disk', 'Sending email'],
  ['Which of these is an LLM-based assistant?', 'ChatGPT, Gemini or Claude', 'A pocket calculator', 'A spreadsheet macro', 'An antivirus scanner'],
];

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Pick `PER` questions this participant has not seen yet (bank is refilled if it ever runs out).
function pickQuestions(used) {
  let ids = BANK.map((_, i) => i).filter(i => !used.includes(i));
  if (ids.length < PER) ids = BANK.map((_, i) => i);
  return shuffle(ids).slice(0, PER).map(id => {
    const [q, correct, ...wrong] = BANK[id];
    const opts = shuffle([correct, ...wrong]);
    return { id, q, opts, ans: opts.indexOf(correct) };
  });
}
function grade(qs, answers) {
  const a = Array.isArray(answers) ? answers : [];
  return qs.reduce((n, q, i) => n + (Number.isInteger(a[i]) && a[i] === q.ans ? 1 : 0), 0);
}
module.exports = { LIMIT_MS, GRACE_MS, PER, PASS, MAX_ATTEMPTS, BANK, pickQuestions, grade };
