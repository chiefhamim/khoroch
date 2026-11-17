/**
 * Layout maths for the Day book date strip. Pure, so the "today is visible on first render" promise
 * can be tested at any screen width.
 */
export interface DayStripLayout {
  /** Number of day cells. */
  count: number;
  /** Width of one cell in dp. */
  cell: number;
  /** Gap between cells in dp. */
  gap: number;
  /** Inner horizontal padding of the scroll content (also the width of the edge fade). */
  pad: number;
  /** Visible width of the scroll viewport in dp. */
  viewport: number;
}

export function dayStripPitch({ cell, gap }: Pick<DayStripLayout, 'cell' | 'gap'>): number {
  return cell + gap;
}

export function dayStripContentWidth(l: DayStripLayout): number {
  return 2 * l.pad + l.count * l.cell + Math.max(0, l.count - 1) * l.gap;
}

/**
 * Scroll offset that puts the cell at `index` a few cells in from the left edge, snapped to the cell
 * pitch (so cells start exactly at the padding edge), then clamped to the scrollable range.
 */
export function dayStripOffset(l: DayStripLayout, index: number, lead = 3): number {
  const pitch = dayStripPitch(l);
  const maxX = Math.max(0, dayStripContentWidth(l) - l.viewport);
  const wanted = Math.max(0, (index - lead) * pitch);
  return Math.min(wanted, maxX);
}

/** Left and right edge of the cell at `index` in viewport coordinates, for a given scroll offset. */
export function dayStripCellBounds(
  l: DayStripLayout,
  index: number,
  offset: number
): { left: number; right: number } {
  const left = l.pad + index * dayStripPitch(l) - offset;
  return { left, right: left + l.cell };
}
