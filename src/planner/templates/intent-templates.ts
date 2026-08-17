import type { GoalIntent, PlanTemplate } from '../types';

const commonMilestones = [
  'Baseline and success measure recorded',
  'First complete attempt finished',
  'Weakest gap improved and retested',
  'Target outcome achieved and reviewed',
];

export const INTENT_TEMPLATES: Record<GoalIntent, PlanTemplate> = {
  learn: { intent: 'learn', outcomeFrame: 'Demonstrate {subject} through work completed without step-by-step help.', milestoneFrames: ['Core concepts used in a small exercise', 'First practical result completed', 'A harder result completed from memory', 'Independent capstone passes its success test'], weeklyFrame: 'Complete one learn–practise–build cycle.', todayFrame: 'Complete one small exercise and explain the result.' },
  build: { intent: 'build', outcomeFrame: 'Ship a usable {subject} that completes its main job.', milestoneFrames: ['User and finish condition defined', 'Smallest end-to-end version works', 'Real feedback improves the result', 'Finished version is delivered or published'], weeklyFrame: 'Ship one testable slice.', todayFrame: 'Define the user, main job, and smallest usable version.' },
  improve: { intent: 'improve', outcomeFrame: 'Improve {subject} from a recorded baseline to a repeatable target result.', milestoneFrames: commonMilestones, weeklyFrame: 'Practise the weakest measured skill and retest it.', todayFrame: 'Record a real baseline before practising.' },
  finish: { intent: 'finish', outcomeFrame: 'Finish {subject} by closing the remaining scope and passing a final review.', milestoneFrames: ['Remaining scope listed', 'Core work complete', 'Quality check passes', 'Final result delivered'], weeklyFrame: 'Close the highest-risk unfinished part.', todayFrame: 'List what remains and finish the smallest complete section.' },
  prepare: { intent: 'prepare', outcomeFrame: 'Be ready for {subject} by practising the real performance conditions.', milestoneFrames: ['Baseline under test conditions recorded', 'Highest-impact gaps practised', 'Full rehearsal completed', 'Final rehearsal meets the readiness score'], weeklyFrame: 'Run one realistic practice and repair its biggest gap.', todayFrame: 'Complete a short diagnostic under real conditions.' },
  earn: { intent: 'earn', outcomeFrame: 'Earn the target through a repeatable offer, outreach, and delivery system.', milestoneFrames: ['Offer and buyer defined', 'First sale completed', 'Sales process repeated', 'Income target reached'], weeklyFrame: 'Create leads, make offers, follow up, and deliver.', todayFrame: 'Define one buyer, offer, price, and first five prospects.' },
  save: { intent: 'save', outcomeFrame: 'Save the target in a protected pot with a realistic recurring transfer.', milestoneFrames: ['Savings pot and first transfer complete', '25% saved', '50% saved', 'Full target saved'], weeklyFrame: 'Make and record the planned transfer.', todayFrame: 'Create the savings pot and make the first transfer.' },
  start: { intent: 'start', outcomeFrame: 'Start {subject} with a repeatable routine and visible proof of action.', milestoneFrames: commonMilestones, weeklyFrame: 'Repeat the smallest sustainable version.', todayFrame: 'Do the smallest real version today.' },
  reduce: { intent: 'reduce', outcomeFrame: 'Reduce {subject} with a measured baseline, friction, and a replacement behaviour.', milestoneFrames: commonMilestones, weeklyFrame: 'Review triggers and strengthen the replacement.', todayFrame: 'Measure today’s baseline and remove one trigger.' },
  increase: { intent: 'increase', outcomeFrame: 'Increase {subject} from a baseline to the target at a sustainable pace.', milestoneFrames: commonMilestones, weeklyFrame: 'Complete the planned increment and record it.', todayFrame: 'Record the baseline and complete the first safe increment.' },
  maintain: { intent: 'maintain', outcomeFrame: 'Maintain {subject} through a minimum standard and recovery rule.', milestoneFrames: commonMilestones, weeklyFrame: 'Meet the minimum standard and review misses.', todayFrame: 'Define and complete the minimum version.' },
  unknown: { intent: 'unknown', outcomeFrame: 'Turn {subject} into a visible, testable outcome.', milestoneFrames: commonMilestones, weeklyFrame: 'Complete one testable improvement cycle.', todayFrame: 'Define success and record the baseline.' },
};
