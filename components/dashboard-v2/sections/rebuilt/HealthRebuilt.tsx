// DASHFIN stub — will be replaced by the BB v4 elevate rebuild of Health.
// Until the builder lands, re-hosts the v1 three-tab composition unchanged.
import React from 'react';
import { InternalTabs } from '../../../dashboard/InternalTabs';
import OverviewPanel from '../../../dashboard/OverviewPanel';
import WorkflowsPanel from '../../../dashboard/WorkflowsPanel';
import ScheduledOpsPanel from '../../../dashboard/ScheduledOpsPanel';

export default function HealthRebuilt() {
  return (
    <InternalTabs
      storageKey="r2-system-health-tab"
      tabs={[
        { key: 'overview', label: 'Overview', render: () => <OverviewPanel /> },
        { key: 'workflows', label: 'Workflows', render: () => <WorkflowsPanel /> },
        { key: 'ops', label: 'Scheduled Ops', render: () => <ScheduledOpsPanel /> },
      ]}
    />
  );
}
