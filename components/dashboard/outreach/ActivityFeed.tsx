import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { filterSystemEvents } from './outreachHelpers';
import type { OutreachEngagementLog, OutreachProspect } from '../../../types/dashboard';

const actionTypeIcons: Record<string, string> = {
  profile_view: 'Viewed profile',
  like: 'Liked post',
  react: 'Reacted to post',
  connection_request: 'Connection sent',
  dm: 'DM sent',
  dm_sent: 'DM sent',
  invite_withdrawn: 'Invite withdrawn',
};

export function ActivityFeed({ events, prospects }: { events: OutreachEngagementLog[]; prospects: OutreachProspect[] }) {
  const [expanded, setExpanded] = useState(false);
  const [includeSystem, setIncludeSystem] = useState(false);
  const visible = filterSystemEvents(events, includeSystem);
  const hiddenCount = events.length - visible.length;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-zinc-200">Recent Activity</span>
          <span className="text-[10px] text-zinc-500">({visible.length})</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors">
            <input
              type="checkbox"
              checked={includeSystem}
              onChange={(e) => setIncludeSystem(e.target.checked)}
              className="rounded border-zinc-600"
            />
            Show system events{hiddenCount > 0 && !includeSystem ? ` (${hiddenCount})` : ''}
          </label>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {expanded ? 'collapse' : 'expand all'}
          </button>
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="text-xs text-zinc-600 text-center py-4">No activity yet</p>
      ) : (
        <div className={`space-y-1.5 overflow-y-auto ${expanded ? 'max-h-96' : 'max-h-48'}`}>
          {(expanded ? visible : visible.slice(0, 8)).map((e) => {
            const prospect = prospects.find((p) => p.id === e.prospectId);
            const profileUrl = prospect?.linkedinUrl;
            const actionUrl = e.targetUrl || profileUrl;
            return (
              <div key={e.id} className="flex items-start gap-2 text-xs">
                <span className="text-zinc-600 whitespace-nowrap w-12 shrink-0">
                  {new Date(e.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={e.success ? 'text-zinc-400' : 'text-red-400'}>
                  {actionUrl ? (
                    <a href={actionUrl} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-blue-300 transition-colors">
                      {actionTypeIcons[e.actionType] || e.actionType}
                    </a>
                  ) : (actionTypeIcons[e.actionType] || e.actionType)}
                  {prospect && (
                    profileUrl ? (
                      <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-blue-300 hover:underline transition-colors"> {prospect.name}</a>
                    ) : <span className="text-zinc-300"> {prospect.name}</span>
                  )}
                  {prospect?.campaignName && <span className="text-zinc-600"> ({prospect.campaignName})</span>}
                  {!e.success && e.errorMessage && <span className="text-red-500/70"> · {e.errorMessage.slice(0, 60)}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ActivityFeed;
