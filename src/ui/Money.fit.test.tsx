import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { setLocale } from '@/i18n';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { Money } from './Money';

const VARIANTS = ['display', 'title', 'headline'] as const;

function renderMoney(props: Partial<React.ComponentProps<typeof Money>>) {
  return render(
    <ThemeProvider preference="light" accent="ocean">
      <Money testID="m" amountMinor={123_456_700} currency="BDT" {...props} />
    </ThemeProvider>
  );
}

describe('Money fitWidth', () => {
  afterEach(() => setLocale('en'));

  it('keeps the requested variant when it fits, clipped on one line', async () => {
    const view = await renderMoney({ variant: 'display', fitVariants: VARIANTS, fitWidth: 220 });
    const node = view.getByTestId('m');
    expect(StyleSheet.flatten(node.props.style).fontSize).toBe(34);
    expect(node.props.numberOfLines).toBe(1);
    expect(node.props.ellipsizeMode).toBe('clip');
    expect(node.props.adjustsFontSizeToFit).toBeUndefined();
  });

  it('steps down a variant and sizes the taka sign from the chosen variant', async () => {
    const view = await renderMoney({ variant: 'display', fitVariants: VARIANTS, fitWidth: 150 });
    expect(StyleSheet.flatten(view.getByTestId('m').props.style).fontSize).toBe(22);
    expect(StyleSheet.flatten(view.getByTestId('m-taka').props.style).fontSize).toBe(13);
  });

  it('switches to compact numbers when nothing fits but keeps the exact accessibility label', async () => {
    const view = await renderMoney({ variant: 'display', fitVariants: VARIANTS, fitWidth: 60 });
    const node = view.getByTestId('m');
    expect(StyleSheet.flatten(node.props.style).fontSize).toBe(17);
    expect(node.props.accessibilityLabel).toBe('৳1,234,567');
    expect(node.props.children).toContain('1.2M');
  });

  it('clips instead of the default tail ellipsis for any single line', async () => {
    const view = await renderMoney({ numberOfLines: 1 });
    expect(view.getByTestId('m').props.ellipsizeMode).toBe('clip');
  });

  it('uses Bangla digit widths when the locale is bn', async () => {
    setLocale('bn');
    const view = await renderMoney({ variant: 'display', fitVariants: VARIANTS, fitWidth: 180 });
    expect(StyleSheet.flatten(view.getByTestId('m').props.style).fontSize).toBe(22);
  });
});
