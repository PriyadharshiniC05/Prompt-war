// The reward prompt a participant earns by passing the round's AI quiz.
// It is built from the participant's own assigned problem, so it is always relevant.
const QUALITY = 'Design: modern colour palette defined with CSS variables, clean typography, rounded cards with soft shadows, smooth hover and focus states, sticky navigation that scrolls to sections using #id links, a mobile hamburger menu, accessible labels, and a footer. Use realistic placeholder text; use CSS gradients or emoji instead of images. Every button and form must work with JavaScript and show clear success or error messages.';

function rewardPrompt(problem, round, enhancement) {
  const feats = problem.features.join(', ');
  if (round === 1) {
    return `You are an expert front-end developer. Build a complete, responsive, single-file website called "${problem.title}". ${problem.problem} Include these sections and features: ${feats}. ${QUALITY}`;
  }
  return `You are an expert front-end developer. Continue the SAME "${problem.title}" website from the previous round without changing its concept. ${enhancement} Keep every earlier section and feature working, keep the same visual identity, and return the full updated page. ${QUALITY}`;
}
module.exports = { rewardPrompt };
