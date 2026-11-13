import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { CategoryColorKey } from '@/domain/types';
import { IconTile } from './IconTile';

const VALID_IONICONS = Ionicons.glyphMap as Record<string, unknown>;

/** @deprecated Compatibility helper for un-migrated v1 screens until Phase 12 cleanup. */
export function resolveIoniconName(icon: string | undefined | null): keyof typeof Ionicons.glyphMap {
  if (icon && icon in VALID_IONICONS) {
    return icon as keyof typeof Ionicons.glyphMap;
  }
  return 'ellipsis-horizontal';
}

export interface CategoryIconProps {
  icon?: string | null;
  colorKey?: CategoryColorKey | string | null;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'neutral' | 'primary' | 'income' | 'expense';
  selected?: boolean;
}

export function CategoryIcon({
  icon,
  colorKey,
  size = 'md',
  tone = 'neutral',
  selected = false,
}: CategoryIconProps) {
  const resolvedColorKey: CategoryColorKey | string | undefined =
    colorKey ??
    (tone === 'primary' || tone === 'income'
      ? 'teal'
      : tone === 'expense'
        ? 'orange'
        : 'gray');

  return (
    <IconTile
      icon={icon}
      colorKey={resolvedColorKey}
      size={size}
      selected={selected}
      neutral={!colorKey && tone === 'neutral'}
    />
  );
}
