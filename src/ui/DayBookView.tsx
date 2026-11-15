import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { buildDayBook, type DayBookEntry } from '@/domain/daybook';
import {
  addDays,
  formatFriendlyTime,
  isDevice24HourClock,
  parseLocalDate,
  todayLocalDate,
} from '@/domain/dates';
import type { Category, LocalDate } from '@/domain/types';
import { t, useLocale, type Locale } from '@/i18n';
import { useAccounts } from '@/state/useAccounts';
import { useAppContext } from '@/state/AppContext';
import { useDataVersionStore } from '@/state/dataVersion';
import { usePeople } from '@/state/usePeople';
import { usePrivacyStore } from '@/state/privacyStore';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText } from './AppText';
import { Button } from './Button';
import { DateTimeSheet } from './DateTimeSheet';
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
    progress.set(withTiming(1, { duration: 280, easing: Easing.bezier(0.22, 1, 0.36, 1) }));
  }, [day, reducedMotion, progress, direction]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.25 + 0.75 * progress.get(),
    transform: [{ translateX: (1 - progress.get()) * 28 * direction.get() }],
  }));
  return <Animated.View style={[style, { gap: 14 }]}>{children}</Animated.View>;
}

export function DayBookView({ header }: { header: React.ReactNode }) {
  const { theme } = useTheme();
  const locale = useLocale();
  const router = useRouter();
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

  const week = useMemo(() => {
    // Seven days ending on the later of (selected day + 3) and today-capped.
    let end = addDays(day, 3);
    if (end > today) end = today;
    return Array.from({ length: 7 }, (_, i) => addDays(end, i - 6));
  }, [day, today]);

  const go = (delta: number) => {
    const next = addDays(day, delta);
    if (next > today) return;
    hapticSelection();
    setDay(next);
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
          <AppText variant="caption" color="textTertiary" tabularNums style={styles.timeText}>
            {time}
          </AppText>
        </View>
        <View style={styles.railCol}>
          <View style={[styles.railLine, { backgroundColor: theme.colors.separator }]} />
          <View
            style={[
              styles.node,
              {
                borderColor:
                  entry.direction === 'in'
                    ? theme.colors.income
                    : entry.direction === 'out'
                      ? theme.colors.expense
                      : theme.colors.textTertiary,
                backgroundColor: theme.colors.bg,
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
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.cardBorder,
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

  const balanceRow = (label: string, amountMinor: number, testID: string) => (
    <View style={styles.entryRow} testID={testID}>
      <View style={styles.timeCol} />
      <View style={styles.railCol}>
        <View style={[styles.balanceNode, { backgroundColor: theme.colors.textTertiary }]} />
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
        gap: theme.spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      {header}

      {/* Day navigator */}
      <View style={styles.navRow}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('daybook.previousDay')}
          onPress={() => go(-1)}
          style={[styles.navBtn, { borderColor: theme.colors.separator, borderRadius: theme.radius.pill }]}
        >
          <AppIcon name="chevron-left" size={18} color={theme.colors.text} />
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${t('common.pickDate')}: ${longDate(day, locale)}`}
          onPress={() => setPickerOpen(true)}
          style={styles.navCenter}
          testID="daybook-date"
        >
          <View style={styles.navTitle}>
            <AppText variant="headline">{dayTitle}</AppText>
            <AppIcon name="chevron-down" size={16} color={theme.colors.textTertiary} />
          </View>
          <AppText variant="caption" color="textTertiary">
            {longDate(day, locale)}
          </AppText>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('daybook.nextDay')}
          accessibilityState={{ disabled: isToday }}
          disabled={isToday}
          onPress={() => go(1)}
          style={[
            styles.navBtn,
            { borderColor: theme.colors.separator, borderRadius: theme.radius.pill, opacity: isToday ? 0.35 : 1 },
          ]}
        >
          <AppIcon name="chevron-right" size={18} color={theme.colors.text} />
        </PressableScale>
      </View>

      {/* Week strip */}
      <View
        style={[
          styles.weekRow,
          theme.cardShadow,
          {
            gap: theme.spacing.xs,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.card,
            borderWidth: 1,
            borderColor: theme.colors.cardBorder,
            padding: theme.spacing.xs,
          },
        ]}
      >
        {week.map((d) => {
          const selected = d === day;
          const has = activeDays.has(d);
          return (
            <PressableScale
              key={d}
              pressScale={0.94}
              accessibilityRole="button"
              accessibilityLabel={longDate(d, locale)}
              accessibilityState={{ selected }}
              onPress={() => {
                hapticSelection();
                setDay(d);
              }}
              style={[
                styles.weekDay,
                {
                  borderRadius: theme.radius.md,
                  backgroundColor: selected ? theme.colors.ink : 'transparent',
                },
              ]}
            >
              <AppText
                variant="caption"
                numberOfLines={1}
                style={{
                  alignSelf: 'stretch',
                  textAlign: 'center',
                  color: selected ? theme.colors.onInk : theme.colors.textTertiary,
                }}
              >
                {locale === 'bn'
                  ? WEEKDAY_SHORT.bn[weekdayIndex(d)]
                  : WEEKDAY_SHORT.en[weekdayIndex(d)].slice(0, 2)}
              </AppText>
              <AppText
                variant="bodyStrong"
                tabularNums
                style={{ color: selected ? theme.colors.onInk : has ? theme.colors.text : theme.colors.textTertiary }}
              >
                {parseLocalDate(d).day}
              </AppText>
              <View
                style={[
                  styles.weekMark,
                  {
                    backgroundColor: has ? (selected ? theme.colors.onInk : theme.colors.accent) : 'transparent',
                  },
                ]}
              />
            </PressableScale>
          );
        })}
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
                  borderColor: active ? theme.colors.accent : theme.colors.cardBorder,
                  backgroundColor: active ? theme.colors.accent : theme.colors.surface,
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

      <DayTransition day={day}>
      {/* Summary */}
      <View
        style={[
          styles.summary,
          theme.cardShadow,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.cardBorder,
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
              <AppText variant="caption" color="textTertiary">
                {t('daybook.startedWith')}
              </AppText>
              <AppIcon name="pencil" size={11} color={theme.colors.textTertiary} />
            </View>
            <Money amountMinor={book.openingMinor} currency={settings.currency} variant="headline" hidden={hideAmounts} />
          </PressableScale>
          <AppIcon name="arrow-left-right" size={16} color={theme.colors.textTertiary} />
          <View style={[styles.flex, styles.alignEnd]}>
            <AppText variant="caption" color="textTertiary">
              {isToday ? t('daybook.leftNow') : t('daybook.endedWith')}
            </AppText>
            <Money amountMinor={book.closingMinor} currency={settings.currency} variant="display" hidden={hideAmounts} />
          </View>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: theme.colors.separator }]} />
        <View style={[styles.statRow, { gap: theme.spacing.sm }]}>
          <View style={[styles.stat, { backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.md }]}>
            <AppIcon name="arrow-down-left" size={15} color={theme.colors.income} />
            <AppText variant="caption" color="textSecondary">
              {t('daybook.in')}
            </AppText>
            <Money amountMinor={book.inMinor} currency={settings.currency} variant="bodyStrong" hidden={hideAmounts} prefix={book.inMinor > 0 ? '+' : ''} color="income" />
          </View>
          <View style={[styles.stat, { backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.md }]}>
            <AppIcon name="arrow-up-right" size={15} color={theme.colors.expense} />
            <AppText variant="caption" color="textSecondary">
              {t('daybook.out')}
            </AppText>
            <Money
              amountMinor={book.outMinor}
              currency={settings.currency}
              variant="bodyStrong"
              prefix={book.outMinor > 0 ? '−' : ''}
              color="expense"
              hidden={hideAmounts}
            />
          </View>
          <View style={[styles.stat, { backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.md }]}>
            <AppIcon
              name={net > 0 ? 'trending-up' : net < 0 ? 'trending-down' : 'minus'}
              size={15}
              color={net > 0 ? theme.colors.income : theme.colors.textTertiary}
            />
            <AppText variant="caption" color="textSecondary">
              {t('daybook.net')}
            </AppText>
            <Money
              amountMinor={Math.abs(net)}
              currency={settings.currency}
              variant="bodyStrong"
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
          {balanceRow(t('daybook.startedWith'), book.openingMinor, 'daybook-opening')}
          {book.entries.map(entryView)}
          {balanceRow(isToday ? t('daybook.leftNow') : t('daybook.endedWith'), book.closingMinor, 'daybook-closing')}
        </View>
      )}

      </DayTransition>

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
  alignEnd: { alignItems: 'flex-end' },
  openingLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  center: { textAlign: 'center' },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navBtn: { width: 44, height: 44, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  navCenter: { flex: 1, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  navTitle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weekRow: { flexDirection: 'row' },
  weekDay: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2, minHeight: 64 },
  weekMark: { width: 14, height: 3, borderRadius: 2, marginTop: 2 },
  summary: { borderWidth: 1, padding: 18, gap: 14 },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  summaryDivider: { height: StyleSheet.hairlineWidth },
  statRow: { flexDirection: 'row' },
  stat: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, gap: 2 },
  entryRow: { flexDirection: 'row', alignItems: 'stretch' },
  timeCol: { width: 62, paddingTop: 22 },
  timeText: { textAlign: 'right' },
  railCol: { width: 28, alignItems: 'center' },
  railLine: { width: 1.5, flex: 1 },
  railSpacer: { width: 1.5, flex: 1 },
  node: { width: 12, height: 12, borderRadius: 6, borderWidth: 2.5 },
  balanceNode: { width: 8, height: 8, borderRadius: 2, marginTop: 18 },
  entryCard: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 12, gap: 12, marginVertical: 5 },
  entryText: { flex: 1, gap: 2 },
  entryAmounts: { alignItems: 'flex-end', gap: 2 },
  leftRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  balanceText: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingRight: 13 },
  empty: { borderWidth: 1, alignItems: 'center', padding: 24 },
});
