import { theme } from '../carnival';

const { colors } = theme;

/**
 * The North Pole's winter palette. Legacy ground keys remain compatible with
 * the existing map: grass is fresh snow, paths are packed snow, and hedges
 * are evergreen boundaries capped with snow.
 */
export const palette = {
  sky: '#193e51',
  skyHigh: '#081e34',
  cloud: '#8baebf',
  cloudShade: '#668d9f',
  haze: '#b2cad6',

  grass: '#d4e5ed',
  grassDark: '#b9d1df',
  grassEdge: '#acc5d4',
  grassLight: '#edf5f7',
  path: '#b1cbd5',
  pathShade: '#92b1c2',
  hedge: '#215b50',
  hedgeDark: '#163f3d',
  hedgeLight: '#4b8270',
  shadow: 'rgba(24, 61, 82, 0.20)',

  red: colors.stripeA,
  redShade: '#b8283a',
  cream: colors.stripeB,
  creamShade: '#e3d9c2',
  gold: colors.accent,
  goldShade: '#e0a91c',
  blue: '#2b8ccc',
  blueShade: '#1f6aa0',
  sky2: colors.water,
  pink: '#f59ac0',
  pinkShade: '#e076a4',
  wood: colors.wood,
  woodDark: '#6b4429',
  woodLight: '#b7834f',
  board: '#c8955b',
  metal: '#e9e4f2',
  metalShade: '#b9b0cc',
  ink: colors.background,
  opening: '#4a2a28',
  closed: '#a99cc4',
  closedShade: '#8a7daa',
  white: '#ffffff',

  skins: ['#f1c27d', '#c68642', '#8d5524', '#e0ac69', '#ffdbac'],
  hairs: ['#3b2219', '#1b1035', '#a55728', '#e6c35c', '#6b4429'],
  shirts: [colors.water, '#7bd389', '#b48ee0', colors.danger, '#2b8ccc', colors.stripeB],
  pants: ['#2d3a6b', '#3b2a4f', '#5a4a3a'],
  bunting: [colors.stripeA, colors.accent, '#2b8ccc', colors.stripeB],
  balloons: [colors.stripeA, colors.accent, '#2b8ccc', colors.water, '#f59ac0'],
} as const;
