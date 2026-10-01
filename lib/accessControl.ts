import { Question, Topic } from '../data/types';
import type { PremiumConfig } from '../store/adminStore';

export type PremiumFeatureKey = keyof PremiumConfig['premiumFeatures'];

export function canAccessPremiumFeature(
  feature: PremiumFeatureKey,
  isPremium: boolean,
  premiumConfig: PremiumConfig,
): boolean {
  return premiumConfig.premiumFeatures[feature] ? isPremium : true;
}

export function canAccessMode(
  mode: string | undefined,
  isPremium: boolean,
  premiumConfig: PremiumConfig,
  premiumOnlyModes: string[] = [],
): boolean {
  if (!mode || mode === 'practice' || mode === 'review') return true;
  if (premiumOnlyModes.includes(mode)) return isPremium;
  if (mode === 'speed') return canAccessPremiumFeature('speedMode', isPremium, premiumConfig);
  if (mode === 'adaptive') return canAccessPremiumFeature('adaptiveAlgorithm', isPremium, premiumConfig);
  if (mode === 'simulation') return canAccessPremiumFeature('simulations', isPremium, premiumConfig);
  return true;
}

export function canAccessTopic(topic: Topic, isPremium: boolean, premiumConfig: PremiumConfig): boolean {
  if (!topic.isPremiumOnly) return true;
  if (premiumConfig.freePremiumTopics.includes(topic.id)) return true;
  return isPremium && premiumConfig.premiumFeatures.allTopics;
}

export function canAccessQuestion(question: Question, isPremium: boolean): boolean {
  return question.accessLevel !== 'premium' || isPremium;
}

export function getSessionQuestionLimit(
  requestedLimit: number,
  isPremium: boolean,
  freePracticeLimit: number,
  premiumConfig: PremiumConfig,
  premiumUserQuestionLimit: number,
): number {
  if (!isPremium) return Math.min(requestedLimit, freePracticeLimit, premiumConfig.freeUserDailyQuestionLimit);
  if (premiumConfig.premiumFeatures.unlimitedQuestions) return requestedLimit;
  return Math.min(requestedLimit, Math.max(1, premiumUserQuestionLimit));
}
