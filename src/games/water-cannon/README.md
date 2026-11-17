# Snowball Workshop

Help the elves test their moving ornament targets with 15 snowballs.

## How to play

- Move the mouse to aim the launcher, and click (or tap) to throw a snowball.
- You have 15 shots. The game ends when the snowballs run out and the last shot has landed.
- Click again on the game over screen to play another round.

## Scoring

Each target scores 10 points for every 60 px/s of speed, rounded up:

| Rail   | Speed    | Points |
| ------ | -------- | ------ |
| Top    | 180 px/s | 30     |
| Middle | 120 px/s | 20     |
| Bottom | 60 px/s  | 10     |

Your final score is saved to the workshop’s score board when the game ends.

The existing `water-cannon` route and score key are preserved, so old bookmarks
and personal bests continue to work.

## Files

- `game.ts`: the game logic (`createState`, `fire`, `step`, `scoreForHit`) and the
  `waterCannon` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
