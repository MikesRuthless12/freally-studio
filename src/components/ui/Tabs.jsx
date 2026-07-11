// Tabs — flat segmented tab strip (TASK-C05)
import React from 'react';
import './ui-kit.css';

const Tabs = ({ tabs = [], active, onChange, size = 'm', style }) => (
    <span className={`fui-tabs ${size === 's' ? 'fui-s' : 'fui-m'}`} role="tablist" style={style}>
        {tabs.map(tab => (
            <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active === tab.id}
                className={`fui-tab ${active === tab.id ? 'fui-active' : ''}`}
                disabled={tab.disabled}
                onClick={() => onChange && onChange(tab.id)}
            >
                {tab.label}
            </button>
        ))}
    </span>
);

export default Tabs;
