// PanelHeader — flat panel title bar; children render right-aligned (TASK-C05)
import React from 'react';
import './ui-kit.css';

const PanelHeader = ({ title, children, style }) => (
    <div className="fui-panel-header" style={style}>
        <span>{title}</span>
        <span className="fui-panel-header-spacer" />
        {children}
    </div>
);

export default PanelHeader;
