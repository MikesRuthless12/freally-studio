// UIKitGallery — storybook-lite for the component kit (TASK-C05).
// Rendered on the hidden /uikit route in dev builds only; shows every
// component in every state for screenshot review.
import React, { useState } from 'react';
import { Button, Toggle, Select, Tabs, PanelHeader, Meter, Fader, NumberDrag, Knob } from './index.js';
import './ui-kit.css';

const Row = ({ title, children }) => (
    <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ fontSize: 'var(--text-size-s)', color: 'var(--text-2)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            {children}
        </div>
    </div>
);

const UIKitGallery = () => {
    const [toggleOn, setToggleOn] = useState(true);
    const [selectValue, setSelectValue] = useState('b');
    const [tab, setTab] = useState('two');
    const [fader, setFader] = useState(0.7);
    const [num, setNum] = useState(120);
    const [knob, setKnob] = useState(0.6);

    const options = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }, { value: 'c', label: 'Gamma' }];

    return (
        <div className="fui" style={{ minHeight: '100vh', background: 'var(--surface-0)', padding: 'var(--space-4)', fontFamily: 'inherit' }}>
            <h1 style={{ fontSize: 'var(--text-size-xl)', color: 'var(--text-1)', marginBottom: 'var(--space-4)' }}>
                Freally UI Kit — every component, every state
            </h1>

            <Row title="Button — sizes, variants, states">
                <Button>Default M</Button>
                <Button size="s">Default S</Button>
                <Button variant="primary">Primary</Button>
                <Button variant="danger">Danger</Button>
                <Button active>Active</Button>
                <Button disabled>Disabled</Button>
            </Row>

            <Row title="Toggle">
                <Toggle value={toggleOn} onChange={setToggleOn} label="On/off (live)" />
                <Toggle value={true} onChange={() => {}} label="On" />
                <Toggle value={false} onChange={() => {}} label="Off" />
                <Toggle value={true} onChange={() => {}} label="Small" size="s" />
                <Toggle value={false} onChange={() => {}} label="Disabled" disabled />
            </Row>

            <Row title="Select">
                <Select value={selectValue} onChange={setSelectValue} options={options} />
                <Select value="a" onChange={() => {}} options={options} size="s" />
                <Select value="a" onChange={() => {}} options={options} disabled />
            </Row>

            <Row title="Tabs">
                <Tabs
                    tabs={[{ id: 'one', label: 'One' }, { id: 'two', label: 'Two' }, { id: 'three', label: 'Three', disabled: true }]}
                    active={tab}
                    onChange={setTab}
                />
                <Tabs size="s" tabs={[{ id: 'a', label: 'S size' }, { id: 'b', label: 'Tabs' }]} active="a" onChange={() => {}} />
            </Row>

            <Row title="PanelHeader">
                <div style={{ width: 320, border: '1px solid var(--border-hairline)' }}>
                    <PanelHeader title="Panel title">
                        <Button size="s">Action</Button>
                    </PanelHeader>
                    <div style={{ height: 40, background: 'var(--surface-1)' }} />
                </div>
            </Row>

            <Row title="Meter — quiet, hot, clipping, vertical">
                <Meter value={0.4} />
                <Meter value={0.8} />
                <Meter value={1.0} />
                <Meter value={0.85} vertical />
            </Row>

            <Row title="Fader — vertical (live), horizontal, disabled">
                <Fader value={fader} onChange={setFader} defaultValue={0.7} />
                <Fader value={0.4} onChange={() => {}} vertical={false} />
                <Fader value={0.5} onChange={() => {}} disabled />
            </Row>

            <Row title="NumberDrag — drag vertically; double-click to type">
                <NumberDrag value={num} min={40} max={300} step={1} onChange={setNum} />
                <NumberDrag value={0.5} min={0} max={1} step={0.01} size="s" onChange={() => {}} />
                <NumberDrag value={64} min={0} max={128} onChange={() => {}} disabled />
            </Row>

            <Row title="Knob — live, small, disabled, double-click resets">
                <Knob label="Cutoff" value={knob} min={0} max={1} onChange={setKnob} defaultValue={0.5} size={56} />
                <Knob label="Small" value={0.3} min={0} max={1} onChange={() => {}} size={40} />
                <Knob label="Off" value={0.8} min={0} max={1} onChange={() => {}} size={56} disabled />
            </Row>
        </div>
    );
};

export default UIKitGallery;
