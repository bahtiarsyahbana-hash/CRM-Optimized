import { CatalogueItem, Client, Deal, MasterPolicy } from '../types';

/* -------------------------------------------------------------------------- */
/*                              Code generation                               */
/* -------------------------------------------------------------------------- */

/** Filler words that carry no identifying information in a catalogue name. */
const NOISE = new Set(['THE', 'AND', 'OF', 'FOR', 'ALL', 'INSURANCE', 'ASURANSI']);

/**
 * Derive a short uppercase code from a catalogue name.
 *
 * A single meaningful word gives a readable prefix ("Property" → PROPER);
 * several give initials ("Property All Risk" → PR, since ALL is filler). Kept
 * separate from deriveInsurerCode because the noise words differ — company
 * names are full of PT and Indonesia, catalogue names are not.
 */
export function deriveCatalogueCode(name: string): string {
  const words = name
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(w => !NOISE.has(w.toUpperCase()));

  // Fall back to the name with its noise words kept — but still stripped of
  // punctuation, so a name like "!!!" yields ITEM rather than a code made of
  // symbols.
  const source = words.length > 0
    ? words
    : name.replace(/[^A-Za-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

  const code = source.length === 1
    ? source[0].slice(0, 6)
    : source.map(w => w[0]).join('').slice(0, 6);

  return (code || 'ITEM').toUpperCase();
}

/** Make a code unique within its own catalogue. */
export function uniqueCatalogueCode(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base.slice(0, 5)}${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base.slice(0, 4)}${Date.now() % 1000}`;
}

/* -------------------------------------------------------------------------- */
/*                                   Usage                                    */
/* -------------------------------------------------------------------------- */

export interface CatalogueUsage {
  count: number;
  /** What refers to it, for the confirmation dialog. */
  label: string;
}

const norm = (s?: string) => (s || '').trim().toLowerCase();

/**
 * How many records refer to a product, by name.
 *
 * Matched on name rather than id because `Deal.productType` is still the
 * ProductType string — the Products catalogue is standalone in this build and
 * does not yet drive the submission cascade.
 */
export function productUsage(
  item: CatalogueItem,
  deals: Pick<Deal, 'productType'>[],
  masterPolicies: Pick<MasterPolicy, 'productType'>[],
): CatalogueUsage {
  const d = deals.filter(x => norm(x.productType) === norm(item.name)).length;
  const m = masterPolicies.filter(x => norm(x.productType) === norm(item.name)).length;
  return { count: d + m, label: `${d} deal(s), ${m} master polic(ies)` };
}

/** Clients classified under a line of business, matched on name. */
export function lineOfBusinessUsage(
  item: CatalogueItem,
  clients: Pick<Client, 'lineOfBusiness'>[],
): CatalogueUsage {
  const c = clients.filter(x => norm(x.lineOfBusiness) === norm(item.name)).length;
  return { count: c, label: `${c} client(s)` };
}

/**
 * Benefits are referenced by nothing yet — the catalogue is flat and the
 * SOC coverage reconciliation is deferred, so every benefit is freely
 * deletable for now.
 */
export function benefitUsage(): CatalogueUsage {
  return { count: 0, label: 'nothing yet' };
}

/** A referenced item is deactivated rather than deleted. */
export const canHardDeleteCatalogueItem = (usage: CatalogueUsage): boolean => usage.count === 0;

/** Items offered in a picker: active ones, plus whichever is already selected. */
export function selectableCatalogueItems(items: CatalogueItem[], currentId?: string): CatalogueItem[] {
  return items
    .filter(i => i.active || i.id === currentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}
