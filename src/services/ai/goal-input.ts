export type GoalPromptCheck = { valid: true } | { valid: false; message: string };

const actionWords = new Set([
  'achieve', 'apply', 'be', 'become', 'build', 'buy', 'clear', 'complete', 'cook',
  'create', 'cut', 'deliver', 'develop', 'draw', 'earn', 'exercise', 'finish', 'fix',
  'gain', 'get', 'grow', 'have', 'improve', 'increase', 'launch', 'learn', 'lose',
  'lower', 'make', 'master', 'move', 'need', 'organise', 'organize', 'pass', 'pay',
  'play', 'practice', 'practise', 'prepare', 'quit', 'read', 'reduce', 'run', 'save',
  'sell', 'speak', 'start', 'stop', 'study', 'submit', 'train', 'travel', 'visit',
  'walk', 'want', 'write',
]);

const keyboardRuns = /(?:asdf|qwer|zxcv|hjkl|1234|abcd|wxyz)/i;
const repeatedCharacter = /(.)\1{4,}/iu;

export function checkGoalPrompt(value: string): GoalPromptCheck {
  const prompt = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (prompt.length < 5) return invalid('Describe what you want to achieve in a short sentence.');
  if (repeatedCharacter.test(prompt) || keyboardRuns.test(prompt.replace(/\s/g, ''))) {
    return invalid('That looks like random text. Tell DOIT the outcome you actually want.');
  }

  const letterWords = prompt.match(/\p{L}[\p{L}'’-]*/gu) ?? [];
  const hasNumberOrAmount = /\d|[£$€¥]/u.test(prompt);
  const normalisedWords = letterWords.map((word) => word.toLocaleLowerCase('en-GB'));
  const hasAction = normalisedWords.some((word) => actionWords.has(word));
  if ((letterWords.length < 2 && !(letterWords.length === 1 && hasAction && hasNumberOrAmount)) || letterWords.every((word) => word.length <= 1)) {
    return invalid('Use at least two meaningful words, like “learn Spanish” or “save £500”.');
  }

  const latinWords = normalisedWords.filter((word) => /^[a-z]+$/i.test(word));
  const consonantMashCount = latinWords.filter((word) => word.length >= 4 && !/[aeiouy]/i.test(word)).length;
  if (latinWords.length > 0 && consonantMashCount >= Math.ceil(latinWords.length * 0.6)) {
    return invalid('That looks like random letters. Write the goal as something you want to do or finish.');
  }

  if (letterWords.length === 2 && !hasAction && !hasNumberOrAmount) {
    return invalid('Turn that into an outcome, for example “improve my fitness” or “finish my project”.');
  }

  if (letterWords.length <= 3 && letterWords.every((word) => word.length <= 3) && !hasAction && !hasNumberOrAmount) {
    return invalid('Add a real action and outcome so DOIT knows what you mean.');
  }

  return { valid: true };
}

function invalid(message: string): GoalPromptCheck {
  return { valid: false, message };
}
