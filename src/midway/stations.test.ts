import { describe, expect, it } from 'vitest';
import { stationFor } from './stations';
import { boothInReach, layoutMidway, pathToBooth } from './world';
import { PLAYER_LOOK, visitorLook } from './render';
import { theme } from '../carnival';

describe('North Pole workshop', () => {
  it('keeps the existing game route and all scenic stations reachable', () => {
    const map = layoutMidway(['water-cannon']);
    expect(map.booths[0].gameId).toBe('water-cannon');
    expect(map.booths.slice(1).map((b) => stationFor(b.index).name)).toEqual([
      'Toy Making',
      'Sleigh Mechanic',
      'Reindeer Stable',
    ]);
    for (const booth of map.booths) {
      const path = pathToBooth(map, map.spawn, booth);
      expect(path?.length).toBeGreaterThan(0);
      expect(boothInReach(map, path!.at(-1)!)).toBe(booth);
    }
  });
  it('still assigns newly registered games to their own cabins as the village grows', () => {
    const ids = Array.from({ length: 11 }, (_, i) => `christmas-game-${i}`);
    const map = layoutMidway(ids);
    expect(map.booths.filter((b) => b.gameId).map((b) => b.gameId)).toEqual(ids);
    for (const booth of map.booths) {
      expect(pathToBooth(map, map.spawn, booth)).toBeDefined();
      expect(stationFor(booth.index).description.length).toBeGreaterThan(0);
    }
  });
  it('distinguishes Santa’s red hat and white hair from the elves', () => {
    expect(PLAYER_LOOK.cap).toBe(theme.colors.stripeA);
    for (let i = 0; i < 9; i++) {
      expect(visitorLook(i).cap).not.toBe(PLAYER_LOOK.cap);
      expect(visitorLook(i).hair).not.toBe(PLAYER_LOOK.hair);
    }
  });
});
