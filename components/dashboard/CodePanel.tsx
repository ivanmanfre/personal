import React from 'react';

const CLAUDE_CODE_URL = import.meta.env.VITE_CLAUDE_CODE_URL || 'https://claude-code-railway-production.up.railway.app';

const CodePanel: React.FC = () => {
  return (
    <iframe
      src={CLAUDE_CODE_URL}
      className="fixed inset-0 w-screen h-screen border-0 md:left-[240px] md:w-[calc(100vw-240px)] mt-14 md:mt-0 z-10"
      title="Claude Code"
      allow="clipboard-read; clipboard-write"
    />
  );
};

export default CodePanel;
