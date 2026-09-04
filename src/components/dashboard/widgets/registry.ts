import { WidgetDefinition } from './shared';
import { PortfolioWidget } from './PortfolioWidget';
import { ProductionWidget } from './ProductionWidget';
import { RetentionWidget } from './RetentionWidget';
import { InsurerPanelWidget } from './InsurerPanelWidget';

/**
 * Widget registry, keyed by stable id.
 *
 * Phase 1 (built): the dashboard renders DEFAULT_LAYOUT in a fixed grid.
 * Phase 2 (not built): per-user layout persistence, add/remove, drag and
 * resize. The seams for that are:
 *
 *   - Widgets are addressed only by id, never imported directly by the
 *     dashboard, so a persisted layout is just `string[]`.
 *   - Each definition carries `defaultSpan`, which a persisted layout
 *     overrides per user without touching the widget.
 *   - Every widget takes the same `WidgetProps` and reads its own data, so
 *     one can be mounted, unmounted or reordered without coordination.
 *   - `title` / `description` exist for an "add widget" picker that does not
 *     exist yet.
 *
 * Ids are permanent. Never reuse one for a different widget — a stale
 * persisted layout would then render the wrong thing.
 */
export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  portfolio: {
    id: 'portfolio',
    title: 'Portfolio',
    description: 'The bound book: policies in force, sum insured, premium and product mix.',
    defaultSpan: 1,
    component: PortfolioWidget,
  },
  production: {
    id: 'production',
    title: 'Production',
    description: 'Premium written this month against last, split new business vs renewal.',
    defaultSpan: 1,
    component: ProductionWidget,
  },
  retention: {
    id: 'retention',
    title: 'Retention',
    description: 'Policies expiring within 90 days and renewals already in the funnel.',
    defaultSpan: 1,
    component: RetentionWidget,
  },
  'insurer-panel': {
    id: 'insurer-panel',
    title: 'Insurer Panel',
    description: 'Premium share by insurer across the bound book.',
    defaultSpan: 1,
    component: InsurerPanelWidget,
  },
};

/**
 * Phase 1 layout — fixed, same for everyone, order is deliberate.
 * Phase 2 replaces this with a per-user value loaded from storage, falling
 * back to exactly this array.
 */
export const DEFAULT_LAYOUT: string[] = [
  'portfolio',
  'production',
  'retention',
  'insurer-panel',
];

/** Resolve a layout to definitions, skipping ids that no longer exist. */
export const resolveLayout = (layout: string[] = DEFAULT_LAYOUT): WidgetDefinition[] =>
  layout.map(id => WIDGET_REGISTRY[id]).filter((w): w is WidgetDefinition => Boolean(w));
