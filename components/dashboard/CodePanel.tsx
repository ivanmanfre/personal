import React from 'react';

const CLAUDE_CODE_URL = import.meta.env.VITE_CLAUDE_CODE_URL || 'https://claude-code-railway-production.up.railway.app';

const CodePanel: React.FC = () => {
  return (
    <div className="h-[calc(100vh-80px)] md:h-screen w-full -m-6 md:-m-8">
      <iframe
        src={CLAUDE_CODE_URL}
        className="w-full h-full border-0"
        title="Claude Code"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
};

export default CodePanel;
