// Vitest: the quest board's rules and its data (data/quest_list.json).
import { describe, expect, it } from 'vitest';
import { QUESTS, questDone, questProgress, type QuestStats } from '../../src/game/quests';
import { UNLOCKS } from '../../src/game/unlocks';

const empty = (): QuestStats => ({ sold: {}, done: [], earned: 0, levels: {} });

describe('questProgress', () => {
  it('counts dishes served toward a sell quest, capped at its target', () => {
    const q = QUESTS.find(x => x.kind === 'sell')!, s = empty();
    s.sold[q.item!] = q.target - 1;
    expect(questProgress(q, s)).toBe(q.target - 1);
    expect(questDone(q, s)).toBe(false);
    s.sold[q.item!] = q.target + 50;
    expect(questProgress(q, s)).toBe(q.target);
    expect(questDone(q, s)).toBe(true);
  });

  it('an unlock quest is done when the unlock is bought', () => {
    const q = QUESTS.find(x => x.kind === 'unlock')!, s = empty();
    expect(questDone(q, s)).toBe(false);
    s.done.push(q.unlock!);
    expect(questDone(q, s)).toBe(true);
  });

  it('a level quest is done when any upgrade reaches the level', () => {
    const q = QUESTS.find(x => x.kind === 'level')!, s = empty();
    s.levels = { up_stove: q.target - 1, up_rods: 0 };
    expect(questDone(q, s)).toBe(false);
    s.levels.up_rods = q.target;
    expect(questDone(q, s)).toBe(true);
  });

  it('an earn quest counts every coin earned', () => {
    const q = QUESTS.find(x => x.kind === 'earn')!, s = empty();
    s.earned = q.target;
    expect(questDone(q, s)).toBe(true);
  });
});

describe('the quest list', () => {
  it('names only real unlocks and dishes, has unique ids, and pays every quest', () => {
    const unlockIds = new Set(UNLOCKS.map(u => u.id)), dishes = ['bowl', 'plate', 'riceball', 'hotpot'];
    expect(new Set(QUESTS.map(q => q.id)).size).toBe(QUESTS.length);
    for (const q of QUESTS) {
      expect(q.reward).toBeGreaterThan(0);
      expect(q.target).toBeGreaterThan(0);
      if (q.kind === 'unlock') expect(unlockIds.has(q.unlock!), q.id).toBe(true);
      if (q.kind === 'sell') expect(dishes, q.id).toContain(q.item);
    }
  });

  it('opens the zones in the order the camp does', () => {
    const order = ['gate', 'gate3', 'gate4'].map(g => QUESTS.findIndex(q => q.unlock === g));
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
