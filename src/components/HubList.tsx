import React from 'react';
import { router } from 'expo-router';
import { AppText, Card, Grid, Icon, Row } from './ui';
import { colors } from '../lib/theme';

export type HubItem = { icon: string; title: string; text: string; href: string; color?: string; badge?: number };

export function HubList({ items }: { items: HubItem[] }) {
  return (
    <Grid cols={{ mobile: 1, tablet: 2, desktop: 3 }}>
      {items.map((it) => (
        <Card key={it.href} onPress={() => router.navigate(it.href as any)}>
          <Row gap={14}>
            <Icon name={it.icon} size={26} color={it.color || colors.primary} />
            <Row style={{ flex: 1 }}>
              <AppText variant="h3" style={{ flex: 1 }}>
                {it.title}
              </AppText>
              {it.badge ? (
                <AppText variant="caption" color={colors.primary} style={{ fontWeight: '800' }}>
                  {it.badge} new
                </AppText>
              ) : null}
              <Icon name="chevron-right" color={colors.textDim} />
            </Row>
          </Row>
          <AppText variant="caption" muted style={{ marginTop: 6 }}>
            {it.text}
          </AppText>
        </Card>
      ))}
    </Grid>
  );
}
