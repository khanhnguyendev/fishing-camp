// The quest board: a list of goals in order (data/quest_list.json), each with a reward. No browser in here.
import data from '../../data/quest_list.json';

/** What a quest asks: serve dishes, buy an unlock, earn coins in total, or raise any upgrade to a level. */
export type QuestKind = 'sell' | 'unlock' | 'earn' | 'level';

/** One quest on the board. */
export interface Quest {
  id: string;
  text: string;
  kind: QuestKind;
  target: number;
  /** For 'sell': which dish (bowl, plate, riceball, hotpot). */
  item?: string;
  /** For 'unlock': which unlock id. */
  unlock?: string;
  reward: number;
}

/** The numbers quests are measured against. */
export interface QuestStats {
  sold: Record<string, number>;
  done: string[];
  earned: number;
  levels: Record<string, number>;
}

/** The quests, in the order they are given. */
export const QUESTS = data as Quest[];

/** How far along a quest is, from 0 to its target. */
export function questProgress(q: Quest, s: QuestStats): number {
  let n = 0;
  if (q.kind === 'sell') n = s.sold[q.item ?? ''] ?? 0;
  else if (q.kind === 'unlock') n = s.done.includes(q.unlock ?? '') ? 1 : 0;
  else if (q.kind === 'earn') n = s.earned;
  else if (q.kind === 'level') n = Math.max(0, ...Object.values(s.levels));
  return Math.min(q.target, n);
}

/** True when a quest's target is reached. */
export function questDone(q: Quest, s: QuestStats): boolean {
  return questProgress(q, s) >= q.target;
}
