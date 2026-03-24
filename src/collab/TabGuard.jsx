import React from 'react';
import LockedOverlay from './LockedOverlay';

const TAB_PERMISSION_MAP = {
    drums: 'canEditDrums',
    chords: 'canEditChords',
    melody: 'canEditMelody',
    bass: 'canEditBass',
};

export function TabGuard({ tab, myId, owners, freeForAll, onRequestAccess, permissions, children }) {
    // In free-for-all mode, never lock any tab via ownership
    // but still enforce permissions
    if (!freeForAll) {
        const ownerId = owners[tab];
        const isLocked = ownerId && ownerId !== myId;

        if (isLocked) {
            return <LockedOverlay
                ownerId={ownerId}
                onRequestAccess={onRequestAccess ? () => onRequestAccess(tab) : null}
            />;
        }
    }

    // Check fine-grained permissions (host always has full access)
    const permKey = TAB_PERMISSION_MAP[tab];
    if (permKey && permissions && permissions[permKey] === false) {
        return <LockedOverlay
            ownerId="host"
            message="Permission denied by host"
        />;
    }

    return children;
}

export default TabGuard;
