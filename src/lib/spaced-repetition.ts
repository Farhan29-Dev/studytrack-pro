import { addDays, addHours, isAfter, isBefore, startOfDay } from 'date-fns';

export type Difficulty = 'easy' | 'medium' | 'hard';

// SM-2 inspired algorithm intervals (in days)
const INTERVALS: Record<Difficulty, number[]> = {
  easy: [1, 3, 7, 14, 30, 60, 120],
  medium: [1, 2, 4, 8, 16, 32, 64],
  hard: [0.5, 1, 2, 4, 8, 16, 32],
};

export function calculateNextReview(
  reviewCount: number,
  difficulty: Difficulty
): Date {
  const intervals = INTERVALS[difficulty];
  const intervalIndex = Math.min(reviewCount, intervals.length - 1);
  const daysToAdd = intervals[intervalIndex];

  if (daysToAdd < 1) {
    // Less than a day, add hours
    return addHours(new Date(), daysToAdd * 24);
  }

  return addDays(new Date(), daysToAdd);
}

export function isTopicDueForReview(nextReview: string | null): boolean {
  if (!nextReview) return false;
  const reviewDate = new Date(nextReview);
  return isBefore(reviewDate, new Date()) || isBefore(reviewDate, addHours(new Date(), 1));
}

export function getTopicsDueToday(topics: Array<{ next_review: string | null }>): number {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);

  return topics.filter(topic => {
    if (!topic.next_review) return false;
    const reviewDate = new Date(topic.next_review);
    return isBefore(reviewDate, tomorrow);
  }).length;
}

export function getDifficultyColor(difficulty: Difficulty): string {
  switch (difficulty) {
    case 'easy':
      return 'text-success';
    case 'medium':
      return 'text-warning';
    case 'hard':
      return 'text-destructive';
    default:
      return 'text-muted-foreground';
  }
}

export function getDifficultyBadgeVariant(difficulty: Difficulty): 'default' | 'secondary' | 'destructive' {
  switch (difficulty) {
    case 'easy':
      return 'secondary';
    case 'medium':
      return 'default';
    case 'hard':
      return 'destructive';
    default:
      return 'secondary';
  }
}
