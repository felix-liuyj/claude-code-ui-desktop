import React from 'react';

const ClaudeLogo = ({ className = 'w-5 h-5' }) => {
    // Use relative path so it resolves under file:// in Electron
    const src = 'claude.svg';
    return <img src={ src } alt="Claude" className={ className }/>;
};

export default ClaudeLogo;


