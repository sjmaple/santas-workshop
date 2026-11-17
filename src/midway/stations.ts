/** Names for the original spare booth slots; registered games always take priority. */
const stations = [
  {
    name: 'Gift Wrapping',
    description:
      'The elves are tying the last golden bows. This station is scenery; visit Snowball Workshop for a playable challenge.',
  },
  {
    name: 'Toy Making',
    description:
      'Tiny trains, teddy bears and wooden toys are ready for Christmas. The elves are busy at their workbenches.',
  },
  {
    name: 'Sleigh Mechanic',
    description:
      'Runners polished, bells tuned, stardust topped up. The sleigh crew is preparing for Christmas Eve.',
  },
  {
    name: 'Reindeer Stable',
    description:
      'Warm hay and crunchy carrots for the flight crew. Rudolph and friends are resting in the paddock.',
  },
] as const;
export function stationFor(index: number) {
  return stations[((index % stations.length) + stations.length) % stations.length];
}
