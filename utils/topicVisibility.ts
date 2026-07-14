import { Topic } from '../data/types';

const ENGLISH_TOPIC_MARKERS = [
  'english',
  'anglit',
  'אנגלית',
  'תרגול אנגלית',
];

export function isEnglishPracticeTopic(topic: Pick<Topic, 'id' | 'name' | 'slug' | 'description'>): boolean {
  const haystack = [topic.id, topic.name, topic.slug, topic.description]
    .join(' ')
    .toLowerCase();

  return ENGLISH_TOPIC_MARKERS.some(marker => haystack.includes(marker.toLowerCase()));
}

export function visiblePracticeTopics<T extends Pick<Topic, 'id' | 'name' | 'slug' | 'description'>>(topics: T[]): T[] {
  return topics.filter(topic => !isEnglishPracticeTopic(topic));
}
