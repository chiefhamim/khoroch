import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatFriendlyDate, todayLocalDate } from '@/domain/dates';
import { type PersonSummary } from '@/domain/dues';
import { t } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { usePeople } from '@/state/usePeople';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
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
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Surface } from '@/ui/Surface';
import { hapticSelection } from '@/ui/haptics';

type PeopleTabFilter = 'open' | 'settled';

export default function PeopleTabScreen() {
  const { settings } = useAppContext();
  const { theme } = useTheme();
  const { allPeople, overview, loading, error, reload } = usePeople();

  const [tab, setTab] = useState<PeopleTabFilter>('open');
  const [dueSheetOpen, setDueSheetOpen] = useState(false);
  const [personSheetOpen, setPersonSheetOpen] = useState(false);

  const today = todayLocalDate();
  const currency = settings.currency;

  const visibleList: PersonSummary[] = useMemo(
    () => (tab === 'open' ? overview.openPeople : overview.settledPeople),
    [tab, overview.openPeople, overview.settledPeople]
  );

  const renderPersonRow = (summary: PersonSummary, idx: number, total: number) => {
    const countLabel =
      summary.activeEntryCount === 1
        ? t('people.entryMetaSingle')
        : t('people.entriesMeta', { count: summary.activeEntryCount });

    const subtitle =
      summary.netMinor !== 0 && summary.sinceDate
        ? `${t('people.sinceDate', { date: formatFriendlyDate(summary.sinceDate, today) })} · ${countLabel}`
        : summary.activeEntryCount > 0
          ? `${t('people.settledOn')} · ${countLabel}`
          : t('people.settledLabel');

    const absNet = Math.abs(summary.netMinor);

    return (
      <ListRow
        key={summary.person.id}
        testID={`people-row-${summary.person.id}`}
        title={summary.person.name}
        subtitle={subtitle}
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
              <AppText variant="caption" color="accent">
                Owes you
              </AppText>
              <Money
                variant="bodyStrong"
                amountMinor={absNet}
                currency={currency}
                color="accent"
              />
            </View>
          ) : summary.netMinor < 0 ? (
            <View style={styles.balanceRight}>
              <AppText variant="caption" color="danger">
                You owe
              </AppText>
              <Money
                variant="bodyStrong"
                amountMinor={absNet}
                currency={currency}
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
              <AppText variant="caption" color="textSecondary">
                {t('people.settledLabel')}
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
          <AppText variant="label" color="textSecondary">
            {t('people.youWillGet')}
          </AppText>
          <Money
            testID="people-summary-get-amount"
            variant="title"
            amountMinor={overview.youWillGetMinor}
            currency={currency}
            color={overview.youWillGetMinor > 0 ? 'accent' : 'text'}
          />
          {overview.openReceivableCount > 0 ? (
            <AppText variant="caption" color="textSecondary">
              {overview.openReceivableCount === 1
                ? '1 person'
                : `${overview.openReceivableCount} people`}
            </AppText>
          ) : null}
        </Surface>

        <Surface
          testID="people-summary-owe"
          style={[styles.summaryCard, { gap: theme.spacing.xs }]}
        >
          <AppText variant="label" color="textSecondary">
            {t('people.youOwe')}
          </AppText>
          <Money
            testID="people-summary-owe-amount"
            variant="title"
            amountMinor={overview.youOweMinor}
            currency={currency}
            color={overview.youOweMinor > 0 ? 'danger' : 'text'}
          />
          {overview.openPayableCount > 0 ? (
            <AppText variant="caption" color="textSecondary">
              {overview.openPayableCount === 1
                ? '1 person'
                : `${overview.openPayableCount} people`}
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
          <SegmentedControl<PeopleTabFilter>
            testID="people-tab-segment"
            value={tab}
            onChange={setTab}
            options={[
              {
                value: 'open',
                label: `${t('people.openTab')} (${overview.openPeople.length})`,
              },
              {
                value: 'settled',
                label: `${t('people.settledTab')} (${overview.settledPeople.length})`,
              },
            ]}
          />

          {visibleList.length === 0 ? (
            <Surface testID={`people-empty-${tab}`}>
              <EmptyState
                icon={tab === 'open' ? 'circle-check' : 'users'}
                title={
                  tab === 'open'
                    ? t('people.openEmptyTitle')
                    : t('people.settledEmptyTitle')
                }
                body={
                  tab === 'open'
                    ? t('people.openEmptyBody')
                    : t('people.settledEmptyBody')
                }
              />
            </Surface>
          ) : (
            <Surface testID="people-list-card" padded={false}>
              {visibleList.map((summary, idx) =>
                renderPersonRow(summary, idx, visibleList.length)
              )}
            </Surface>
          )}
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
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  summaryCard: {
    flex: 1,
  },
  balanceRight: {
    alignItems: 'flex-end',
    gap: 1,
  },
  settledPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
