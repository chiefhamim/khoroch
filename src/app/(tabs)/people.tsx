import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatFriendlyDate } from '@/domain/dates';
import { computePersonDueSchedule, formatInlineMoney, type PersonSummary } from '@/domain/dues';
import { t, useLocale } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { usePeople } from '@/state/usePeople';
import { useToday } from '@/state/useToday';
import { usePrivacyStore } from '@/state/privacyStore';
import { useTheme } from '@/theme/useTheme';
import { AppText, estimateSingleLineMinWidth } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { DueEntrySheet } from '@/ui/DueEntrySheet';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { ListRow } from '@/ui/ListRow';
import { Money } from '@/ui/Money';
import { PersonAvatar } from '@/ui/PersonAvatar';
import { PersonEditorSheet } from '@/ui/PersonEditorSheet';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';
import { DUE_SOON_DAYS, dueStatusText } from '@/ui/dueStatus';
import { hapticSelection } from '@/ui/haptics';

export default function PeopleTabScreen() {
  const { settings } = useAppContext();
  const locale = useLocale();
  const { theme } = useTheme();
  const { allPeople, overview, loading, error, reload } = usePeople();

  const bnMinWidth = (text: string, fontSize: number) =>
    locale === 'bn' ? { minWidth: estimateSingleLineMinWidth(text, fontSize) } : null;

  const [dueSheetOpen, setDueSheetOpen] = useState(false);
  const [personSheetOpen, setPersonSheetOpen] = useState(false);

  const today = useToday();
  const currency = settings.currency;
  const hideAmounts = usePrivacyStore((s) => s.hideAmounts);
  const showPoisha = usePrivacyStore((s) => s.showPoisha);

  // Due schedule per person, computed once per data or day change, not per row render.
  const scheduleByPerson = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computePersonDueSchedule>>();
    for (const summary of overview.allActivePeople) {
      map.set(summary.person.id, computePersonDueSchedule(summary.entries, today));
    }
    return map;
  }, [overview.allActivePeople, today]);

  const visibleList = overview.openPeople;
  const owesYouLabel = t('people.owesYou');
  const youOweLabel = t('people.youOwe');
  const settledLabel = t('people.settledLabel');
  const getCountText =
    overview.openReceivableCount === 1
      ? t('people.personSingle')
      : t('people.personPlural', { count: overview.openReceivableCount });
  const oweCountText =
    overview.openPayableCount === 1
      ? t('people.personSingle')
      : t('people.personPlural', { count: overview.openPayableCount });

  const renderPersonRow = (summary: PersonSummary, idx: number, total: number) => {
    const countLabel =
      summary.activeEntryCount === 1
        ? t('people.entryMetaSingle')
        : t('people.entriesMeta', { count: summary.activeEntryCount });

    const subtitle =
      summary.netMinor !== 0 && summary.sinceDate
        ? `${t('people.sinceDate', { date: formatFriendlyDate(summary.sinceDate, today, locale) })} · ${countLabel}`
        : summary.activeEntryCount > 0
          ? `${t('people.settledOn')} · ${countLabel}`
          : settledLabel;

    const absNet = Math.abs(summary.netMinor);

    // One caption line: overdue amount wins; otherwise a due date within DUE_SOON_DAYS.
    const schedule =
      scheduleByPerson.get(summary.person.id) ?? computePersonDueSchedule(summary.entries, today);
    let caption: string | undefined;
    let captionTone: 'danger' | 'textSecondary' = 'textSecondary';
    if (schedule.overdueMinor > 0) {
      caption = t('people.overdueAmount', {
        amount: formatInlineMoney(schedule.overdueMinor, currency, {
          hidden: hideAmounts,
          showPoisha,
        }),
      });
      captionTone = 'danger';
    } else if (
      schedule.daysUntilNext !== null &&
      schedule.daysUntilNext >= 0 &&
      schedule.daysUntilNext <= DUE_SOON_DAYS
    ) {
      caption = dueStatusText(schedule.daysUntilNext);
    }

    return (
      <ListRow
        key={summary.person.id}
        testID={`people-row-${summary.person.id}`}
        title={summary.person.name}
        subtitle={subtitle}
        caption={caption}
        captionTone={captionTone}
        left={
          <PersonAvatar
            name={summary.person.name}
            colorKey={summary.person.colorKey}
            size="sm"
          />
        }
        right={
          summary.netMinor > 0 ? (
            <View style={styles.balanceRight}>
              <AppText
                variant="caption"
                color="accent"
                numberOfLines={1}
                style={[styles.rightText, bnMinWidth(owesYouLabel, 12)]}
              >
                {owesYouLabel}
              </AppText>
              <Money
                variant="bodyStrong"
                amountMinor={absNet}
                currency={currency}
                prefix="+"
                color="accent"
              />
            </View>
          ) : summary.netMinor < 0 ? (
            <View style={styles.balanceRight}>
              <AppText
                variant="caption"
                color="danger"
                numberOfLines={1}
                style={[styles.rightText, bnMinWidth(youOweLabel, 12)]}
              >
                {youOweLabel}
              </AppText>
              <Money
                variant="bodyStrong"
                amountMinor={absNet}
                currency={currency}
                prefix="−"
                color="danger"
              />
            </View>
          ) : (
            <View
              style={[
                styles.settledPill,
                {
                  backgroundColor: theme.colors.surfaceSunken,
                  borderRadius: theme.radius.pill,
                },
              ]}
            >
              <AppText
                variant="caption"
                color="textSecondary"
                numberOfLines={1}
                style={bnMinWidth(settledLabel, 12)}
              >
                {settledLabel}
              </AppText>
            </View>
          )
        }
        showDivider={idx < total - 1}
        onPress={() => router.push(`/people/${summary.person.id}` as never)}
      />
    );
  };

  return (
    <Screen scroll>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <AppText variant="title" style={styles.flex1}>
          {t('people.title')}
        </AppText>
        <IconButton
          testID="people-add-person-btn"
          icon="plus"
          variant="sunken"
          accessibilityLabel={t('people.newPersonTitle')}
          onPress={() => {
            hapticSelection();
            setPersonSheetOpen(true);
          }}
        />
      </View>

      {error ? (
        <ErrorState
          title={t('people.title')}
          body={t('error.genericBody')}
          retryLabel={t('common.retry')}
          onRetry={reload}
        />
      ) : null}

      {/* Two summary cards: You'll get & You owe */}
      <View style={[styles.summaryRow, { gap: theme.spacing.sm }]}>
        <Surface
          testID="people-summary-get"
          style={[styles.summaryCard, { gap: theme.spacing.xs }]}
        >
          <AppText
            variant="label"
            color="textSecondary"
            numberOfLines={1}
            style={bnMinWidth(t('people.youWillGet'), 13)}
          >
            {t('people.youWillGet')}
          </AppText>
          <Money
            testID="people-summary-get-amount"
            variant="title"
            amountMinor={overview.youWillGetMinor}
            currency={currency}
            prefix={overview.youWillGetMinor > 0 ? '+' : ''}
            color={overview.youWillGetMinor > 0 ? 'accent' : 'text'}
            allowCompact
          />
          {overview.openReceivableCount > 0 ? (
            <AppText
              variant="caption"
              color="textSecondary"
              numberOfLines={1}
              style={bnMinWidth(getCountText, 12)}
            >
              {getCountText}
            </AppText>
          ) : null}
        </Surface>

        <Surface
          testID="people-summary-owe"
          style={[styles.summaryCard, { gap: theme.spacing.xs }]}
        >
          <AppText
            variant="label"
            color="textSecondary"
            numberOfLines={1}
            style={bnMinWidth(youOweLabel, 13)}
          >
            {youOweLabel}
          </AppText>
          <Money
            testID="people-summary-owe-amount"
            variant="title"
            amountMinor={overview.youOweMinor}
            currency={currency}
            prefix={overview.youOweMinor > 0 ? '−' : ''}
            color={overview.youOweMinor > 0 ? 'danger' : 'text'}
            allowCompact
          />
          {overview.openPayableCount > 0 ? (
            <AppText
              variant="caption"
              color="textSecondary"
              numberOfLines={1}
              style={bnMinWidth(oweCountText, 12)}
            >
              {oweCountText}
            </AppText>
          ) : null}
        </Surface>
      </View>

      {/* Primary Action */}
      <Button
        testID="people-new-due-btn"
        title={t('people.newEntry')}
        variant="primary"
        leftIcon="hand-coins"
        onPress={() => {
          hapticSelection();
          setDueSheetOpen(true);
        }}
      />

      {!loading && overview.allActivePeople.length === 0 ? (
        <Surface testID="people-empty-state">
          <EmptyState
            icon="users"
            title={t('people.emptyTitle')}
            body={t('people.emptyBody')}
            ctaLabel={t('people.emptyCta')}
            onCtaPress={() => setDueSheetOpen(true)}
          />
        </Surface>
      ) : (
        <>
          {visibleList.length === 0 ? (
            <Surface testID="people-empty-open">
              <EmptyState
                icon="circle-check"
                title={t('people.openEmptyTitle')}
                body={t('people.openEmptyBody')}
              />
            </Surface>
          ) : (
            <Surface testID="people-list-card" padded={false}>
              {visibleList.map((summary, idx) =>
                renderPersonRow(summary, idx, visibleList.length)
              )}
            </Surface>
          )}

          {overview.settledPeople.length > 0 ? (
            <>
              <AppText
                variant="label"
                color="textSecondary"
                numberOfLines={1}
                style={bnMinWidth(t('people.settledTab'), 13)}
              >
                {t('people.settledTab')}
              </AppText>
              <Surface testID="people-settled-list-card" padded={false}>
                {overview.settledPeople.map((summary, idx) =>
                  renderPersonRow(summary, idx, overview.settledPeople.length)
                )}
              </Surface>
            </>
          ) : null}
        </>
      )}

      <DueEntrySheet
        visible={dueSheetOpen}
        onClose={() => setDueSheetOpen(false)}
      />

      <PersonEditorSheet
        visible={personSheetOpen}
        onClose={() => setPersonSheetOpen(false)}
        existingCount={allPeople.length}
        onSaved={(personId) => {
          router.push(`/people/${personId}` as never);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex1: {
    flex: 1,
    minWidth: 0,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  summaryCard: {
    flex: 1,
    minWidth: 0,
  },
  balanceRight: {
    alignItems: 'flex-end',
    gap: 1,
  },
  rightText: {
    textAlign: 'right',
  },
  settledPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
