import React from 'react';
import './StepResolutionSelector.css';

const StepResolutionSelector = ({ resolution, onChange }) => {
    const resolutions = ['1/4', '1/8', '1/16', '1/32'];

    return (
        <div className="step-resolution-selector">
            <span className="resolution-label">GRID:</span>
            <div className="resolution-buttons">
                {resolutions.map(res => (
                    <button
                        key={res}
                        className={`resolution-btn ${resolution === res ? 'active' : ''}`}
                        onClick={() => onChange(res)}
                        title={`${res} notes`}
                    >
                        {res}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default StepResolutionSelector;
