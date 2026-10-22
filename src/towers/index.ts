import { dart } from './dart';
import { boomerang } from './boomerang';
import { bomb } from './bomb';
import { tack } from './tack';
import { ice } from './ice';
import { glue } from './glue';
export const TOWERS = { dart, boomerang, bomb, tack, ice, glue };
export type TowerKind = keyof typeof TOWERS;
export { resultingStats, canUpgrade } from './types';
