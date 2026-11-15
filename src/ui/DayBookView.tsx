import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { buildDayBook, type DayBookEntry } from '@/domain/daybook';
import {
  addDays,
  diffDays,
  formatFriendlyTime,
  isDevice24HourClock,
  minLocalDate,
  parseLocalDate,
  todayLocalDate,
} from '@/domain/dates';
import type { Category, LocalDate } from '@/domain/types';
import { t, useLocale, type Locale } from '@/i18n';
import { useAccounts } from '@/state/useAccounts';
import { useAppContext } from '@/state/AppContext';
import { useDataVersionStore } from '@/state/dataVersion';
import { useDayBookStore } from '@/state/dayBookStore';
import { usePeople } from '@/state/usePeople';
import { usePrivacyStore } from '@/state/privacyStore';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText } from './AppText';
import { Button } from './Button';
import { DateTimeSheet } from './DateTimeSheet';
import { glassFill, useGlass } from './glass';
import { hapticSelection } from './haptics';
import { IconTile } from './IconTile';
import { Money } from './Money';
import { PressableScale } from './PressableScale';
import { useTabScrollPadding } from './Screen';
import { WalletEditorSheet } from './WalletEditorSheet';

const WEEKDAY_SHORT: Record<Locale, readonly string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  bn: ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'],
};
const MONTH_SHORT: Record<Locale, readonly string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  bn: ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'],
};

function weekdayIndex(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return new Date(year, month - 1, day).getDay();
}

function longDate(date: LocalDate, locale: Locale): string {
  const { month, day, year } = parseLocalDate(date);
  return `${WEEKDAY_SHORT[locale][weekdayIndex(date)]}, ${day} ${MONTH_SHORT[locale][month - 1]} ${year}`;
}

/** Slides and fades the day's content in from the side you navigated toward. */
function DayTransition({ day, children }: { day: LocalDate; children: React.ReactNode }) {
  const { reducedMotion } = useTheme();
  const previous = useRef(day);
  const progress = useSharedValue(1);
  const direction = useSharedValue(1);
  useEffect(() => {
    if (previous.current === day) return;
    direction.set(day > previous.current ? 1 : -1);
    previous.current = day;
    if (reducedMotion) return;
    progress.set(0);
    progress.set(withTiming(1, { duration: 175, easing: Easing.out(Easing.cubic) }));
  }, [day, reducedMotion, progress, direction]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * progress.get(),
    transform: [{ translateX: (1 - progress.get()) * 18 * direction.get() }],
  }));
  return <Animated.View style={[style, { gap: 10 }]}>{children}</Animated.View>;
}

export function DayBookView({
  header,
  active = true,
  onOpenDayInAll,
}: {
  header: React.ReactNode;
  /** True while the day book is the visible ledger mode; lets the + button default to the viewed day. */
  active?: boolean;
  /** Called when a day in the strip is double tapped. */
  onOpenDayInAll?: (date: LocalDate) => void;
}) {
  const { theme, reducedMotion } = useTheme();
  const isDark = theme.scheme === 'dark';
  const glass = useGlass();
  const g = glassFill(theme.mode);
  const cardFill = isDark && glass ? g.fill : theme.colors.surface;
  const cardRim = isDark && glass ? g.rim : theme.colors.cardBorder;
  const locale = useLocale();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { repo, settings } = useAppContext();
  const hideAmounts = usePrivacyStore((s) => s.hideAmounts);
  const dataVersion = useDataVersionStore((s) => s.dataVersion);
  const tabScrollPadding = useTabScrollPadding();
  const use24Hour = isDevice24HourClock();
  const today = todayLocalDate();

  const [day, setDay] = useState<LocalDate>(today);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [editingWalletOpen, setEditingWalletOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const { allAccounts, accountsById, transactions, transfers, dueEntries, loading } = useAccounts();
  const { peopleById } = usePeople();

  useEffect(() => {
    let active = true;
    repo
      .listCategories({ includeArchived: true })
      .then((rows) => {
        if (active) setCategories(rows);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [repo, dataVersion]);

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const activeWallets = useMemo(
    () => allAccounts.filter((a) => a.archivedAt == null),
    [allAccounts]
  );
  const selectedWallet = walletId ? activeWallets.find((a) => a.id === walletId) ?? null : null;

  const scoped = useMemo(() => {
    if (!selectedWallet) {
      return { accounts: allAccounts, transactions, transfers, dues: dueEntries };
    }
    const id = selectedWallet.id;
    return {
      accounts: [selectedWallet],
      transactions: transactions.filter((tx) => tx.accountId === id),
      transfers: transfers.filter((tr) => tr.fromAccountId === id || tr.toAccountId === id),
      dues: dueEntries.filter((d) => d.accountId === id),
    };
  }, [selectedWallet, allAccounts, transactions, transfers, dueEntries]);

  const book = useMemo(
    () =>
      buildDayBook({
        date: day,
        accounts: scoped.accounts,
        transactions: scoped.transactions,
        transfers: scoped.transfers,
        dues: scoped.dues,
        currency: settings.currency,
      }),
    [day, scoped, settings.currency]
  );

  // Days with entries, for the week strip.
  const activeDays = useMemo(() => {
    const set = new Set<LocalDate>();
    for (const tx of transactions) if (tx.deletedAt == null) set.add(tx.occurredOn);
    for (const tr of transfers) if (tr.deletedAt == null) set.add(tr.occurredOn);
    for (const d of dueEntries) if (d.deletedAt == null) set.add(d.occurredOn);
    return set;
  }, [transactions, transfers, dueEntries]);

  const stripStart = useMemo(() => {
    let earliest = addDays(today, -365);
    for (const d of activeDays) {
      earliest = minLocalDate(earliest, d);
    }
    return minLocalDate(earliest, addDays(day, -30));
  }, [activeDays, day, today]);

  const stripDays = useMemo(() => {
    const count = Math.max(7, diffDays(today, stripStart) + 1);
    return Array.from({ length: count }, (_, i) => addDays(stripStart, i));
  }, [stripStart, today]);

  const [stripOuterWidth, setStripOuterWidth] = useState(
    Math.max(280, windowWidth - theme.geometry.screenMargin * 2)
  );
  const stripPad = theme.spacing.xs;
  const stripBorder = 1;
  const stripInnerWidth = Math.max(280, stripOuterWidth - (stripPad + stripBorder) * 2);
  const stripInnerRadius = Math.max(0, theme.radius.card - stripPad - stripBorder);
  const slotWidth = stripInnerWidth / 7;
  const snapOffsets = useMemo(
    () => Array.from({ length: Math.max(1, stripDays.length - 6) }, (_, i) => i * slotWidth),
    [stripDays.length, slotWidth]
  );

  const stripRef = useRef<FlatList<LocalDate>>(null);
  const stripOffsetRef = useRef(Math.max(0, stripDays.length - 7) * slotWidth);
  const stripScrollingRef = useRef(false);
  const stripMomentumRef = useRef(false);
  const skipNextSyncScrollRef = useRef(false);
  const stripSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (stripSettleTimerRef.current) clearTimeout(stripSettleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (skipNextSyncScrollRef.current) {
      skipNextSyncScrollRef.current = false;
      return;
    }
    if (stripScrollingRef.current) return;
    const selectedIdx = diffDays(day, stripStart);
    const currentFirst = stripOffsetRef.current / slotWidth;
    if (selectedIdx < currentFirst - 0.1 || selectedIdx > currentFirst + 6.1) {
      const targetFirst = Math.max(0, Math.min(stripDays.length - 7, selectedIdx - 3));
      const targetOffset = targetFirst * slotWidth;
      stripOffsetRef.current = targetOffset;
      stripRef.current?.scrollToOffset?.({ offset: targetOffset, animated: !reducedMotion });
    }
  }, [day, reducedMotion, slotWidth, stripDays.length, stripStart]);

  const go = (delta: number) => {
    const next = addDays(day, delta);
    if (next > today) return;
    hapticSelection();
    setDay(next);
  };

  const setStoreDay = useDayBookStore((s) => s.setDay);
  useEffect(() => {
    setStoreDay(active ? day : null);
    return () => setStoreDay(null);
  }, [active, day, setStoreDay]);

  const dayRef = useRef(day);
  const isTodaySv = useSharedValue(day === today);
  useEffect(() => {
    dayRef.current = day;
    isTodaySv.set(day === today);
  }, [day, isTodaySv, today]);

  const handleDataSwipe = useCallback((delta: number) => {
    const next = addDays(dayRef.current, delta);
    if (next > todayLocalDate()) return;
    hapticSelection();
    setDay(next);
  }, [setDay]);

  const dragX = useSharedValue(0);
  const swipeGesture = usePanGesture({
    activeOffsetX: [-14, 14],
    failOffsetY: [-10, 10],
    onUpdate: (e) => {
      'worklet';
      if (reducedMotion) return;
      const dx = e.translationX;
      const clamped = isTodaySv.get() && dx < 0 ? dx * 0.2 : dx * 0.45;
      dragX.set(Math.max(-96, Math.min(96, clamped)));
    },
    onDeactivate: (e) => {
      'worklet';
      const trigger = Math.abs(e.translationX) > 36 || Math.abs(e.velocityX) > 300;
      const delta = e.translationX < 0 ? 1 : -1;
      dragX.set(withTiming(0, { duration: 150, easing: Easing.out(Easing.cubic) }));
      if (trigger) {
        runOnJS(handleDataSwipe)(delta);
      }
    },
  });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.get() }],
  }));

  const settleStrip = useCallback(
    (offsetX: number) => {
      stripScrollingRef.current = false;
      const maxFirst = Math.max(0, stripDays.length - 7);
      const firstVisible = Math.max(0, Math.min(maxFirst, Math.round(offsetX / slotWidth)));
      const snappedOffset = firstVisible * slotWidth;
      stripOffsetRef.current = snappedOffset;
      if (Math.abs(offsetX - snappedOffset) > 0.5) {
        stripRef.current?.scrollToOffset?.({ offset: snappedOffset, animated: !reducedMotion });
      }
      const curIdx = diffDays(dayRef.current, stripStart);
      if (curIdx < firstVisible) {
        hapticSelection();
        skipNextSyncScrollRef.current = true;
        setDay(addDays(stripStart, firstVisible));
      } else if (curIdx > firstVisible + 6) {
        hapticSelection();
        skipNextSyncScrollRef.current = true;
        setDay(addDays(stripStart, firstVisible + 6));
      }
    },
    [reducedMotion, setDay, slotWidth, stripDays.length, stripStart]
  );

  const handleStripScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    stripOffsetRef.current = e.nativeEvent.contentOffset.x;
  };

  const handleStripScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    if (stripSettleTimerRef.current) clearTimeout(stripSettleTimerRef.current);
    stripSettleTimerRef.current = setTimeout(() => {
      if (!stripMomentumRef.current) settleStrip(x);
    }, 55);
  };

  const handleStripMomentumBegin = () => {
    stripMomentumRef.current = true;
    if (stripSettleTimerRef.current) {
      clearTimeout(stripSettleTimerRef.current);
      stripSettleTimerRef.current = null;
    }
  };

  const handleStripMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    stripMomentumRef.current = false;
    settleStrip(e.nativeEvent.contentOffset.x);
  };

  const lastTap = useRef<{ date: LocalDate; at: number } | null>(null);
  const tapDay = (d: LocalDate) => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const prev = lastTap.current;
    if (prev && prev.date === d && now - prev.at < 320) {
      lastTap.current = null;
      hapticSelection();
      onOpenDayInAll?.(d);
      return;
    }
    lastTap.current = { date: d, at: now };
    hapticSelection();
    setDay(d);
  };

  const dayTitle =
    day === today
      ? t('common.today')
      : day === addDays(today, -1)
        ? t('common.yesterday')
        : longDate(day, locale).split(',')[0];
  const isToday = day === today;
  const net = book.closingMinor - book.openingMinor;
  const untrackedNoteKey = useMemo(() => {
    if (book.untrackedOutMinor + book.untrackedInMinor === 0) return null;
    let hasNoWallet = false;
    let hasBeforeOpening = false;
    for (const entry of book.entries) {
      if (entry.runningMinor !== null || entry.kind === 'transfer') continue;
      const accountId = entry.transaction?.accountId ?? entry.due?.accountId ?? null;
      if (accountId) hasBeforeOpening = true;
      else hasNoWallet = true;
    }
    if (hasBeforeOpening && hasNoWallet) return 'daybook.untrackedMixedNote';
    if (hasBeforeOpening) return 'daybook.beforeOpeningNote';
    return 'daybook.untrackedNote';
  }, [book]);

  const entryView = (entry: DayBookEntry, index: number) => {
    const isLast = index === book.entries.length - 1;
    let title = '';
    let subtitle = '';
    let icon: AppIconName = 'shapes';
    let colorKey: string = 'gray';
    let onPress: (() => void) | undefined;

    if (entry.kind === 'transaction' && entry.transaction) {
      const tx = entry.transaction;
      const cat = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
      const wallet = tx.accountId ? accountsById.get(tx.accountId) : undefined;
      title = tx.description.trim() || cat?.name || t('common.uncategorized');
      const parts = [cat?.name ?? t('common.uncategorized')];
      parts.push(wallet ? wallet.name : t('daybook.noWallet'));
      subtitle = parts.filter((p, i) => i > 0 || p !== title).join(' · ');
      icon = (cat?.icon as AppIconName) ?? 'shapes';
      colorKey = cat?.colorKey ?? 'gray';
      onPress = () => router.push({ pathname: '/transaction/[id]', params: { id: tx.id } });
    } else if (entry.kind === 'transfer' && entry.transfer) {
      const tr = entry.transfer;
      const from = accountsById.get(tr.fromAccountId)?.name ?? t('tx.walletLabel');
      const to = accountsById.get(tr.toAccountId)?.name ?? t('tx.walletLabel');
      title = t('activity.transferTitle', { from, to });
      subtitle = tr.note.trim() || t('daybook.moved');
      icon = 'arrow-left-right';
      onPress = () => router.push({ pathname: '/transfer/[id]', params: { id: tr.id } });
    } else if (entry.kind === 'due' && entry.due) {
      const d = entry.due;
      const name = peopleById.get(d.personId)?.name ?? t('due.personLabel');
      const key =
        d.kind === 'lent'
          ? 'daybook.dueLent'
          : d.kind === 'borrowed'
            ? 'daybook.dueBorrowed'
            : d.kind === 'received_back'
              ? 'daybook.dueReceivedBack'
              : 'daybook.duePaidBack';
      title = t(key, { name });
      const wallet = d.accountId ? accountsById.get(d.accountId)?.name : null;
      subtitle = [d.note.trim(), wallet ?? t('daybook.noWallet')].filter(Boolean).join(' · ');
      icon = 'hand-coins';
      colorKey = 'violet';
      onPress = () => router.push({ pathname: '/people/[id]', params: { id: d.personId } });
    }

    const time = entry.occurredTime
      ? formatFriendlyTime(entry.occurredTime, use24Hour)
      : formatFriendlyTime(
          `${String(Math.floor(entry.sortMinute / 60)).padStart(2, '0')}:${String(entry.sortMinute % 60).padStart(2, '0')}`,
          use24Hour
        );

    const [timeMain, timePeriod] = time.split(/\s+/);

    return (
      <PressableScale
        key={`${entry.kind}-${entry.id}`}
        pressScale={0.985}
        accessibilityRole="button"
        accessibilityLabel={`${time}, ${title}`}
        onPress={onPress}
        style={styles.entryRow}
      >
        <View style={styles.timeCol}>
          <AppText variant="caption" tabularNums style={[styles.timeText, styles.timeMain]}>
            {timeMain}
          </AppText>
          {timePeriod ? (
            <AppText
              variant="caption"
              color="textTertiary"
              tabularNums
              style={[styles.timeText, styles.timeMain, styles.timePeriod]}
            >
              {timePeriod}
            </AppText>
          ) : null}
        </View>
        <View style={styles.railCol}>
          <View style={[styles.railLine, { backgroundColor: theme.colors.separator }]} />
          <View
            style={[
              styles.node,
              {
                backgroundColor:
                  entry.direction === 'in'
                    ? theme.colors.income
                    : entry.direction === 'out'
                      ? theme.colors.expense
                      : theme.colors.textTertiary,
                borderColor: theme.colors.bg,
              },
            ]}
          />
          {isLast ? <View style={styles.railSpacer} /> : <View style={[styles.railLine, { backgroundColor: theme.colors.separator }]} />}
        </View>
        <View
          style={[
            styles.entryCard,
            theme.cardShadow,
            {
              backgroundColor: cardFill,
              borderColor: cardRim,
              borderRadius: theme.radius.card,
            },
          ]}
        >
          <IconTile icon={icon} colorKey={colorKey} size={34} />
          <View style={styles.entryText}>
            <AppText variant="bodyStrong">{title}</AppText>
            {subtitle ? (
              <AppText variant="caption" color="textSecondary">
                {subtitle}
              </AppText>
            ) : null}
          </View>
          <View style={styles.entryAmounts}>
            <Money
              amountMinor={entry.amountMinor}
              currency={settings.currency}
              variant="bodyStrong"
              hidden={hideAmounts}
              prefix={entry.direction === 'in' ? '+' : entry.direction === 'out' ? '−' : ''}
              color={
                entry.direction === 'in'
                  ? 'income'
                  : entry.direction === 'out'
                    ? 'expense'
                    : 'text'
              }
            />
            {entry.runningMinor !== null ? (
              <View style={styles.leftRow}>
                <AppText variant="caption" color="textTertiary">
                  {t('daybook.left')}
                </AppText>
                <Money
                  amountMinor={entry.runningMinor}
                  currency={settings.currency}
                  variant="caption"
                  hidden={hideAmounts}
                  color="textTertiary"
                />
              </View>
            ) : null}
          </View>
        </View>
      </PressableScale>
    );
  };

  const balanceRow = (
    label: string,
    amountMinor: number,
    testID: string,
    position: 'opening' | 'closing'
  ) => (
    <View style={styles.entryRow} testID={testID}>
      <View style={styles.timeCol} />
      <View style={styles.railCol}>
        {position === 'opening' ? (
          <>
            <View style={styles.railTopSpacer} />
            <View style={[styles.balanceNode, { backgroundColor: theme.colors.textTertiary }]} />
            <View style={[styles.railLine, { backgroundColor: theme.colors.separator }]} />
          </>
        ) : (
          <View
            style={[
              styles.balanceNode,
              styles.railTopMargin,
              { backgroundColor: theme.colors.textTertiary },
            ]}
          />
        )}
      </View>
      <View style={styles.balanceText}>
        <AppText variant="label" color="textSecondary">
          {label}
        </AppText>
        <Money
          amountMinor={amountMinor}
          currency={settings.currency}
          variant="label"
          hidden={hideAmounts}
          color="textSecondary"
        />
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{
        paddingHorizontal: theme.geometry.screenMargin,
        paddingTop: theme.spacing.lg,
        paddingBottom: tabScrollPadding,
        gap: theme.spacing.md,
      }}
      showsVerticalScrollIndicator={false}
    >
      {header}

      <View style={{ gap: theme.spacing.sm }}>
        {/* Day navigator */}
        <View style={styles.navRow}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('daybook.previousDay')}
            hitSlop={5}
            onPress={() => go(-1)}
            style={[
              styles.navBtn,
              {
                backgroundColor: isDark ? cardFill : 'transparent',
                borderColor: isDark ? cardRim : theme.colors.separator,
                borderRadius: theme.radius.pill,
              },
            ]}
          >
            <AppIcon name="chevron-left" size={17} color={theme.colors.text} />
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${t('common.pickDate')}: ${longDate(day, locale)}`}
            hitSlop={4}
            onPress={() => setPickerOpen(true)}
            style={styles.navCenter}
            testID="daybook-date"
          >
            <View style={styles.navTitle}>
              <AppText variant="headline">{dayTitle}</AppText>
              <AppIcon
                name="chevron-down"
                size={16}
                color={isDark ? theme.colors.textSecondary : theme.colors.textTertiary}
              />
            </View>
            <AppText variant="caption" color={isDark ? 'textSecondary' : 'textTertiary'}>
              {longDate(day, locale)}
            </AppText>
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('daybook.nextDay')}
            accessibilityState={{ disabled: isToday }}
            disabled={isToday}
            hitSlop={5}
            onPress={() => go(1)}
            style={[
              styles.navBtn,
              {
                backgroundColor: isDark ? cardFill : 'transparent',
                borderColor: isDark ? cardRim : theme.colors.separator,
                borderRadius: theme.radius.pill,
                opacity: isToday ? (isDark ? 0.42 : 0.35) : 1,
              },
            ]}
          >
            <AppIcon name="chevron-right" size={17} color={theme.colors.text} />
          </PressableScale>
        </View>

        {/* Scrollable Date Slider */}
        <View
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - stripOuterWidth) > 1) setStripOuterWidth(w);
          }}
          style={[
            styles.weekRow,
            theme.cardShadow,
            {
              justifyContent: 'center',
              backgroundColor: cardFill,
              borderRadius: theme.radius.card,
              borderWidth: stripBorder,
              borderColor: cardRim,
              padding: stripPad,
            },
          ]}
        >
          <View
            style={{
              width: stripInnerWidth,
              borderRadius: stripInnerRadius,
              overflow: 'hidden',
            }}
          >
            <FlatList
              ref={stripRef}
              horizontal
              style={{ width: stripInnerWidth }}
              data={stripDays}
              keyExtractor={(d) => d}
              showsHorizontalScrollIndicator={false}
              snapToOffsets={snapOffsets}
              snapToAlignment="start"
              decelerationRate="fast"
              initialScrollIndex={Math.max(0, stripDays.length - 7)}
              initialNumToRender={14}
              maxToRenderPerBatch={14}
              windowSize={5}
              getItemLayout={(_data, index) => ({
                length: slotWidth,
                offset: slotWidth * index,
                index,
              })}
              onScrollBeginDrag={() => {
                stripScrollingRef.current = true;
                if (stripSettleTimerRef.current) clearTimeout(stripSettleTimerRef.current);
              }}
              onScroll={handleStripScroll}
              onScrollEndDrag={handleStripScrollEndDrag}
              onMomentumScrollBegin={handleStripMomentumBegin}
              onMomentumScrollEnd={handleStripMomentumEnd}
              scrollEventThrottle={16}
              extraData={`${day}:${stripDays.length}:${stripInnerWidth.toFixed(1)}`}
              renderItem={({ item: d }) => {
                const selected = d === day;
                const has = activeDays.has(d);
                return (
                  <PressableScale
                    pressScale={0.94}
                    accessibilityRole="button"
                    accessibilityLabel={longDate(d, locale)}
                    accessibilityState={{ selected }}
                    onPress={() => tapDay(d)}
                    style={[
                      styles.weekDay,
                      {
                        width: slotWidth,
                        // Concentric with the strip: outer radius minus its padding and border.
                        borderRadius: stripInnerRadius,
                        backgroundColor: selected ? theme.colors.accent : 'transparent',
                      },
                    ]}
                  >
                    <AppText
                      variant="caption"
                      numberOfLines={1}
                      style={{
                        alignSelf: 'stretch',
                        textAlign: 'center',
                        fontSize: 11.5,
                        lineHeight: 15,
                        color: selected
                          ? theme.colors.onAccent
                          : isDark
                            ? theme.colors.textSecondary
                            : theme.colors.textTertiary,
                      }}
                    >
                      {locale === 'bn'
                        ? WEEKDAY_SHORT.bn[weekdayIndex(d)]
                        : WEEKDAY_SHORT.en[weekdayIndex(d)].slice(0, 2)}
                    </AppText>
                    <AppText
                      variant="bodyStrong"
                      tabularNums
                      style={{
                        lineHeight: 19,
                        color: selected
                          ? theme.colors.onAccent
                          : has
                            ? theme.colors.text
                            : isDark
                              ? theme.colors.textSecondary
                              : theme.colors.textTertiary,
                      }}
                    >
                      {parseLocalDate(d).day}
                    </AppText>
                    <View
                      style={[
                        styles.weekMark,
                        {
                          backgroundColor: has
                            ? selected
                              ? theme.colors.onAccent
                              : theme.colors.accent
                            : 'transparent',
                        },
                      ]}
                    />
                  </PressableScale>
                );
              }}
            />
          </View>
        </View>
      </View>

      {/* Wallet scope: the opening and closing balances follow the chosen wallet */}
      {activeWallets.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.sm, paddingHorizontal: 2 }}
          style={{ flexGrow: 0 }}
        >
          {[{ id: null as string | null, name: t('daybook.allWallets') }, ...activeWallets].map((w) => {
            const active = (w.id ?? null) === walletId;
            return (
              <PressableScale
                key={w.id ?? 'all'}
                pressScale={0.96}
                accessibilityRole="button"
                accessibilityLabel={w.name}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  hapticSelection();
                  setWalletId(w.id);
                }}
                style={{
                  paddingHorizontal: 14,
                  minHeight: 34,
                  justifyContent: 'center',
                  borderRadius: theme.radius.pill,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.accent : cardRim,
                  backgroundColor: active ? theme.colors.accent : cardFill,
                }}
              >
                <AppText
                  variant="label"
                  style={{
                    color: active ? theme.colors.onAccent : theme.colors.textSecondary,
                    fontFamily: active ? 'Manrope_700Bold' : 'Manrope_500Medium',
                  }}
                >
                  {w.name}
                </AppText>
              </PressableScale>
            );
          })}
        </ScrollView>
      ) : null}

      <GestureDetector gesture={swipeGesture}>
      <Animated.View style={[styles.swipeArea, dragStyle]}>
      <DayTransition day={day}>
      {/* Summary */}
      <View
        style={[
          styles.summary,
          theme.cardShadow,
          {
            backgroundColor: cardFill,
            borderColor: cardRim,
            borderRadius: theme.radius.heroCard,
          },
        ]}
        testID="daybook-summary"
      >
        <View style={styles.summaryTop}>
          <PressableScale
            pressScale={0.97}
            accessibilityRole="button"
            accessibilityLabel={t('daybook.startedWith') + ': ' + t('daybook.editOpening')}
            onPress={() => {
              hapticSelection();
              if (selectedWallet) setEditingWalletOpen(true);
              else router.push('/wallets' as never);
            }}
            style={styles.flex}
          >
            <View style={styles.openingLabel}>
              <AppText variant="caption" color="textTertiary" style={styles.openingText}>
                {t('daybook.startedWith')}
              </AppText>
              <AppIcon name="pencil" size={11} color={theme.colors.textTertiary} />
            </View>
            <Money amountMinor={book.openingMinor} currency={settings.currency} variant="headline" hidden={hideAmounts} />
          </PressableScale>
          <View
            style={
              isDark
                ? [
                    styles.swapPill,
                    { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.cardBorder },
                  ]
                : undefined
            }
          >
            <AppIcon
              name="arrow-left-right"
              size={14}
              color={isDark ? theme.colors.textSecondary : theme.colors.textTertiary}
            />
          </View>
          <View style={[styles.flex, styles.alignEnd]}>
            <View style={styles.openingLabel}>
              <AppText variant="caption" color="textTertiary" style={styles.openingText}>
                {isToday ? t('daybook.leftNow') : t('daybook.endedWith')}
              </AppText>
            </View>
            <Money
              amountMinor={book.closingMinor}
              currency={settings.currency}
              variant="headline"
              numberOfLines={1}
              hidden={hideAmounts}
            />
          </View>
        </View>
        <View style={[styles.statRow, { gap: theme.spacing.sm }]}>
          <View
            style={[
              styles.stat,
              {
                backgroundColor: isDark ? theme.colors.surfaceRaised : theme.colors.incomeBg,
                borderRadius: theme.radius.md,
                borderWidth: isDark ? 1 : 0,
                borderColor: cardRim,
              },
            ]}
          >
            <View style={styles.statHead}>
              <AppIcon name="arrow-down-left" size={13} color={theme.colors.income} />
              <AppText
                variant="caption"
                color="textSecondary"
                numberOfLines={1}
                ellipsizeMode="clip"
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={styles.statLabel}
              >
                {t('daybook.in')}
              </AppText>
            </View>
            <Money
              amountMinor={book.inMinor}
              currency={settings.currency}
              variant="bodyStrong"
              style={styles.statAmount}
              hidden={hideAmounts}
              prefix={book.inMinor > 0 ? '+' : ''}
              color="income"
            />
          </View>
          <View
            style={[
              styles.stat,
              {
                backgroundColor: isDark ? theme.colors.surfaceRaised : theme.colors.expenseBg,
                borderRadius: theme.radius.md,
                borderWidth: isDark ? 1 : 0,
                borderColor: cardRim,
              },
            ]}
          >
            <View style={styles.statHead}>
              <AppIcon
                name="arrow-up-right"
                size={13}
                color={isDark ? theme.colors.danger : theme.colors.expense}
              />
              <AppText
                variant="caption"
                color="textSecondary"
                numberOfLines={1}
                ellipsizeMode="clip"
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={styles.statLabel}
              >
                {t('daybook.out')}
              </AppText>
            </View>
            <Money
              amountMinor={book.outMinor}
              currency={settings.currency}
              variant="bodyStrong"
              style={styles.statAmount}
              prefix={book.outMinor > 0 ? '−' : ''}
              color={isDark ? 'danger' : 'expense'}
              hidden={hideAmounts}
            />
          </View>
          <View
            style={[
              styles.stat,
              {
                backgroundColor: isDark ? theme.colors.surfaceRaised : theme.colors.accentSoft,
                borderRadius: theme.radius.md,
                borderWidth: isDark ? 1 : 0,
                borderColor: cardRim,
              },
            ]}
          >
            <View style={styles.statHead}>
              <AppIcon
                name={net > 0 ? 'trending-up' : net < 0 ? 'trending-down' : 'minus'}
                size={13}
                color={
                  net > 0
                    ? theme.colors.income
                    : net < 0
                      ? isDark
                        ? theme.colors.danger
                        : theme.colors.expense
                      : theme.colors.textSecondary
                }
              />
              <AppText
                variant="caption"
                color="textSecondary"
                numberOfLines={1}
                ellipsizeMode="clip"
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={styles.statLabel}
              >
                {t('daybook.net')}
              </AppText>
            </View>
            <Money
              amountMinor={Math.abs(net)}
              currency={settings.currency}
              variant="bodyStrong"
              style={styles.statAmount}
              hidden={hideAmounts}
              prefix={net > 0 ? '+' : net < 0 ? '−' : ''}
              color={net > 0 ? 'income' : net < 0 ? 'expense' : 'text'}
            />
          </View>
        </View>
        {untrackedNoteKey ? (
          <AppText variant="caption" color="textTertiary">
            {t(untrackedNoteKey)}
          </AppText>
        ) : null}
      </View>

      {/* Timeline */}
      {loading ? null : book.entries.length === 0 ? (
        <View
          style={[
            styles.empty,
            { borderColor: theme.colors.separator, borderRadius: theme.radius.card, gap: theme.spacing.sm },
          ]}
        >
          <AppIcon name="scroll-text" size={22} color={theme.colors.textTertiary} />
          <AppText variant="bodyStrong">{t('daybook.emptyTitle')}</AppText>
          <AppText variant="caption" color="textSecondary" style={styles.center}>
            {isToday ? t('daybook.emptyBodyToday') : t('daybook.emptyBody')}
          </AppText>
          {isToday ? (
            <Button
              title={t('daybook.addEntry')}
              size="sm"
              leftIcon="plus"
              onPress={() => router.push('/transaction/new')}
              style={{ marginTop: theme.spacing.xs }}
            />
          ) : null}
        </View>
      ) : (
        <View>
          {balanceRow(t('daybook.startedWith'), book.openingMinor, 'daybook-opening', 'opening')}
          {book.entries.map(entryView)}
          {balanceRow(
            isToday ? t('daybook.leftNow') : t('daybook.endedWith'),
            book.closingMinor,
            'daybook-closing',
            'closing'
          )}
        </View>
      )}

      </DayTransition>
      </Animated.View>
      </GestureDetector>

      <WalletEditorSheet
        visible={editingWalletOpen}
        onClose={() => setEditingWalletOpen(false)}
        account={selectedWallet}
      />

      <DateTimeSheet
        visible={pickerOpen}
        mode="date"
        date={day}
        maxDate={today}
        weekStartsOn={settings.weekStartsOn}
        onDateChange={setDay}
        onClose={() => setPickerOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  swipeArea: { minHeight: 360 },
  alignEnd: { alignItems: 'flex-end' },
  openingLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 15 },
  openingText: { fontSize: 12, lineHeight: 15 },
  center: { textAlign: 'center' },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navBtn: { width: 38, height: 38, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  navCenter: { flex: 1, alignItems: 'center', minHeight: 40, justifyContent: 'center' },
  navTitle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weekRow: { flexDirection: 'row', overflow: 'hidden' },
  weekDay: { alignItems: 'center', justifyContent: 'center', paddingVertical: 5, gap: 1, minHeight: 52 },
  weekMark: { width: 12, height: 2.5, borderRadius: 2, marginTop: 1 },
  swapPill: { width: 28, height: 28, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  summary: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statRow: { flexDirection: 'row' },
  stat: { flex: 1, paddingVertical: 8, paddingHorizontal: 10, gap: 3 },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 12, lineHeight: 15, includeFontPadding: false, flexShrink: 1 },
  statAmount: { fontSize: 15, lineHeight: 20, includeFontPadding: false },
  entryRow: { flexDirection: 'row', alignItems: 'stretch' },
  timeCol: { width: 42, paddingRight: 2, alignItems: 'flex-end', justifyContent: 'center' },
  timeText: { textAlign: 'right', lineHeight: 15 },
  timeMain: { fontFamily: 'Manrope_700Bold', fontSize: 12.5, lineHeight: 15 },
  timePeriod: { letterSpacing: -0.5 },
  railCol: { width: 22, alignItems: 'center' },
  railTopSpacer: { height: 11 },
  railTopMargin: { marginTop: 11 },
  railLine: { width: 1.5, flex: 1 },
  railSpacer: { width: 1.5, flex: 1 },
  node: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, marginTop: 2 },
  balanceNode: { width: 8, height: 8, borderRadius: 2 },
  entryCard: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 10, marginVertical: 4 },
  entryText: { flex: 1, gap: 2 },
  entryAmounts: { alignItems: 'flex-end', gap: 2 },
  leftRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  balanceText: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, paddingRight: 13 },
  empty: { borderWidth: 1, alignItems: 'center', padding: 24 },
});
