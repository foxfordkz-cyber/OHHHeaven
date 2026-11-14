import { useState } from 'react';
import { cityView, fixtureFeed, fixtureWeather, worldPublic } from '../app/fixtures';
import { useGameStore } from '../app/store';
import {
  AiBadge, Badge, Banner, BottomNav, Button, Card, Clock, Feed, Field, ICON_NAMES, Icon, List, ListRow, MoneyText, ProgressBar,
  RuleCard, SegmentedControl, Sheet, Skeleton, Slider, Stat, Stepper, Tabs, Toggle, TopBar, formatMoney,
} from './index';

const SWATCHES = ['--bg', '--surface', '--surface-2', '--border', '--text', '--text-2', '--accent', '--profit', '--loss', '--warn', '--info'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="stack">
      <div className="eyebrow">{title}</div>
      {children}
    </section>
  );
}

/** /dev/ui — every shared component on one page. */
export function DevUi() {
  const store = useGameStore();
  const [sheet, setSheet] = useState(false);
  const [staff, setStaff] = useState(3);
  const [price, setPrice] = useState(6.4);
  const [fund, setFund] = useState(true);
  const [seg, setSeg] = useState<'list' | 'map'>('list');
  const [tab, setTab] = useState<'today' | 'manage' | 'books'>('today');

  return (
    <main className="screen screen--with-nav">
      <TopBar title="Design system" right={<Badge tone="accent">/dev/ui</Badge>} />

      <Section title="Tokens">
        <div className="grid-3">
          {SWATCHES.map((v) => (
            <div key={v} className="stack-sm">
              <div style={{ height: 40, borderRadius: 10, background: `var(${v})`, border: '1px solid var(--border)' }} />
              <span className="xsmall faint">{v}</span>
            </div>
          ))}
        </div>
        <div className="stack-sm">
          <div className="h1">Heading one</div>
          <div className="h2">Heading two</div>
          <div className="h3">Heading three</div>
          <p>Body text: real rent, real permits, real taxes.</p>
          <p className="small muted">Small muted text for hints.</p>
          <span className="eyebrow">Eyebrow label</span>
        </div>
      </Section>

      <Section title="Button">
        <Button block size="lg" icon="store">Start my business</Button>
        <div className="row wrap">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </div>
        <div className="row wrap">
          <Button size="sm" icon="plus">Small</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button variant="secondary" iconRight="arrowRight">Next</Button>
        </div>
      </Section>

      <Section title="Card, Stat, MoneyText">
        <Card title="Maya's Morning Cup" subtitle="Coffee shop · 114 Avenue A" action={<Badge tone="profit">Open</Badge>}>
          <div className="grid-2">
            <Stat label="Cash" value={<MoneyText value={38_420} />} />
            <Stat label="This month" value={<MoneyText value={5_400} signed />} hint="projected" />
            <Stat label="Lost customers" value="41" hint="not enough seats" small />
            <Stat label="Tax due Mar 20" value={<MoneyText value={-6_120} signed />} small />
          </div>
        </Card>
        <Card tone="accent" title="Accent card">Used for the main call to action.</Card>
        <Card tone="warn" title="Warning card">Permit not ready yet.</Card>
        <Card tone="loss" title="Loss card">Cash runs out in 1.4 months.</Card>
        <Card onClick={() => store.toast('Card tapped', 'info')} title="Clickable card" subtitle="Tap me" />
        <p className="small">
          Formats: {formatMoney(1_250_000, { compact: true })} · {formatMoney(6.4)} · {formatMoney(-1_010)} · {formatMoney(3_240, { signed: true })}
        </p>
      </Section>

      <Section title="Badge, AiBadge, ProgressBar">
        <div className="row wrap">
          <Badge>Neutral</Badge>
          <Badge tone="accent">Accent</Badge>
          <Badge tone="profit" icon="check">Grade A</Badge>
          <Badge tone="loss">Closed</Badge>
          <Badge tone="warn" icon="hourglass">Waiting</Badge>
          <Badge tone="info">Info</Badge>
          <AiBadge />
        </div>
        <ProgressBar value={0.72} label="Seats used" />
        <ProgressBar value={0.35} tone="profit" />
        <ProgressBar value={0.9} tone="loss" />
      </Section>

      <Section title="ListRow">
        <List>
          <ListRow icon="doc" iconTone="accent" title="Food Service Establishment Permit" subtitle="NYC Health Department · 21 days" value={<MoneyText value={280} />} onClick={() => setSheet(true)} />
          <ListRow icon="money" iconTone="profit" title="Sales" value={<MoneyText value={43_879} />} />
          <ListRow icon="receipt" iconTone="loss" title="Rent" subtitle="114 Avenue A" value={<MoneyText value={-9_000} signed />} />
          <ListRow icon="lock" title="Required item" subtitle="Cannot be removed" trailing={<Badge>Required</Badge>} />
        </List>
      </Section>

      <Section title="Stepper, Slider, Toggle, SegmentedControl, Tabs">
        <div className="row-between">
          <span>Baristas</span>
          <Stepper value={staff} min={0} max={8} onChange={setStaff} label="baristas" />
        </div>
        <Slider label="Price" value={price} min={3} max={12} step={0.1} onChange={setPrice} format={(v) => formatMoney(v, { cents: true })} marks={['$3.00', 'niche average $6.40']} />
        <Toggle checked={fund} onChange={setFund} label="Chip in to the block fund" description="$300 a month. Foot traffic +10% for the whole block when 60% of neighbors join." />
        <SegmentedControl options={[{ value: 'list', label: 'List' }, { value: 'map', label: 'Map' }]} value={seg} onChange={setSeg} label="View" />
        <Tabs tabs={[{ id: 'today', label: 'Today', badge: 2 }, { id: 'manage', label: 'Manage' }, { id: 'books', label: 'Books' }]} value={tab} onChange={setTab} label="Business" />
      </Section>

      <Section title="Field, Banner, Skeleton">
        <Field label="What would you open?" hint="For example: a coffee shop with pastries near a subway">
          <input className="input" placeholder="A coffee shop…" />
        </Field>
        <Banner>No connection to the city. Your changes are kept.</Banner>
        <Banner tone="info" icon="info">Settings apply from the next game day.</Banner>
        <Skeleton height={56} />
      </Section>

      <Section title="Sheet and Toast">
        <div className="row wrap">
          <Button variant="secondary" onClick={() => setSheet(true)}>Open sheet</Button>
          <Button variant="secondary" onClick={() => store.toast('Saved. Applies from tomorrow.', 'success')}>Success toast</Button>
          <Button variant="secondary" onClick={() => store.toast('Not enough cash for this purchase.', 'error')}>Error toast</Button>
        </div>
      </Section>

      <Section title="RuleCard">
        <RuleCard title="No permit, no coffee" text="You need a Food Service Establishment Permit before you serve anything. Opening early is a violation that can close you." law="NYC Health Code § 81.05" penalty="Fine up to $2,000 · closure" source="https://www.nyc.gov/site/doh/business/food-operators/food-service-establishments.page" />
      </Section>

      <Section title="Clock and Feed">
        <Card>
          <Clock world={worldPublic()} weather={fixtureWeather[0]} />
        </Card>
        <Card>
          <Clock world={{ ...worldPublic(), config: { ...cityView.world.config, demo: false, dayMs: 2_880_000 }, msToNextDay: 1_860_000 }} weather={fixtureWeather[1]} />
        </Card>
        <Card title="City feed">
          <Feed items={fixtureFeed} max={5} />
        </Card>
      </Section>

      <Section title="Icons">
        <div className="grid-3" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
          {ICON_NAMES.map((n) => (
            <div key={n} className="stack-sm" style={{ alignItems: 'center' }} title={n}>
              <Icon name={n} size={22} />
              <span className="faint" style={{ fontSize: 9 }}>{n}</span>
            </div>
          ))}
        </div>
      </Section>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Food Service Establishment Permit" footer={<Button block onClick={() => setSheet(false)}>Got it</Button>}>
        <p className="muted">Issued by the NYC Department of Health and Mental Hygiene after a pre-permit inspection.</p>
        <List>
          <ListRow icon="money" title="Fee" value={<MoneyText value={280} />} />
          <ListRow icon="hourglass" title="Wait" value="21 days" />
        </List>
      </Sheet>

      <BottomNav items={[{ to: '/dev/ui', label: 'Today', icon: 'home', badge: 2 }, { to: '/dev/ui/manage', label: 'Manage', icon: 'edit' }, { to: '/dev/ui/books', label: 'Books', icon: 'receipt' }, { to: '/dev/ui/network', label: 'Network', icon: 'users' }, { to: '/dev/ui/insights', label: 'Insights', icon: 'chart' }]} />
    </main>
  );
}
