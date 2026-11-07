import React from 'react';
import { HubList } from '../../components/HubList';
import { Screen } from '../../components/ui';

export default function Track() {
  return (
    <Screen title="Track" subtitle="Everything you log, in one place">
      <HubList
        items={[
          { icon: 'chart-line', title: 'Progress', text: 'Weight, BMI, workout history and trends', href: '/progress' },
          { icon: 'water', title: 'Water', text: 'Daily intake, goal and reminders', href: '/water', color: '#4DA3FF' },
          { icon: 'timer-sand', title: 'Fasting', text: 'Intermittent fasting timer and history', href: '/fasting', color: '#F5A623' },
          { icon: 'run-fast', title: 'Running', text: 'GPS or manual runs, pace and distance', href: '/running', color: '#2ECC71' },
          { icon: 'emoticon-happy-outline', title: 'Face Fitness', text: 'Face yoga and relaxation routines', href: '/face' },
          { icon: 'calculator-variant', title: 'Health Calculators', text: 'BMI, body fat, BMR, TDEE and more', href: '/calculators' },
        ]}
      />
    </Screen>
  );
}
