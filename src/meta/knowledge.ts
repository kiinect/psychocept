// Monkey Knowledge progression on the profile (pure). Effects live in src/knowledge.ts.
import { KNOWLEDGE, KNOWLEDGE_BY_NAME, type KnowledgeTree } from '../knowledge';
import type { Profile } from './profile';

/** Points earned: one per rank from rank 30 (wiki: "starting from Level 30, almost every level up" gives a point). */
export const knowledgeEarned = (p: Profile) => Math.max(0, p.rank - 29);
export const knowledgeAvailable = (p: Profile) => knowledgeEarned(p) - p.mk.length;
export const treeSpent = (p: Profile, tree: KnowledgeTree) => p.mk.filter(n => KNOWLEDGE_BY_NAME[n]?.tree === tree).length;
export const RESPEC_MM = 2000;

export type KnowledgeState = 'owned' | 'available' | 'locked';
/** Why a point can't be bought yet (or '' when it can). */
export function knowledgeBlock(p: Profile, name: string): string {
  const k = KNOWLEDGE_BY_NAME[name]; if (!k) return 'Unknown knowledge';
  if (p.mk.includes(name)) return 'Owned';
  const known = k.prereq.filter(n => KNOWLEDGE_BY_NAME[n]);
  if (known.length && !known.some(n => p.mk.includes(n))) return `Requires ${known.join(' or ')}`;
  if (treeSpent(p, k.tree) < k.points) return `Requires ${k.points} points in this tree`;
  if (knowledgeAvailable(p) < 1) return p.rank < 30 ? 'Knowledge points start at rank 30' : 'No knowledge points left';
  if (p.mm < k.mm) return `Needs ${k.mm} Monkey Money`;
  return '';
}
export const knowledgeState = (p: Profile, name: string): KnowledgeState => p.mk.includes(name) ? 'owned' : knowledgeBlock(p, name) ? 'locked' : 'available';
export function unlockKnowledge(p: Profile, name: string): Profile {
  if (knowledgeBlock(p, name)) return p;
  return { ...p, mk: [...p.mk, name], mm: p.mm - KNOWLEDGE_BY_NAME[name].mm };
}
/** Refund every point for 2000 MM (row MM costs are not refunded). */
export function respecKnowledge(p: Profile): Profile {
  if (p.mm < RESPEC_MM || !p.mk.length) return p;
  return { ...p, mk: [], mm: p.mm - RESPEC_MM };
}
export const treeKnowledge = (tree: KnowledgeTree) => KNOWLEDGE.filter(k => k.tree === tree);
