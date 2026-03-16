const N8NCLAW_WEBHOOK = 'https://n8n.intelligents.agency/webhook/n8nclaw-whatsapp';
const IVAN_JID = '5491159385939@s.whatsapp.net';

export async function sendToEngineer(workflowName: string, workflowId: string, errorMessage: string | null, errorCount: number): Promise<boolean> {
  const message = [
    `[ENGINEER REQUEST from Dashboard]`,
    `Workflow: ${workflowName}`,
    `ID: ${workflowId}`,
    `Errors (24h): ${errorCount}`,
    errorMessage ? `Last error: ${errorMessage}` : '',
    '',
    `Please fetch this workflow, diagnose the issue, and fix it.`,
  ].filter(Boolean).join('\n');

  // Send as Evolution-formatted WhatsApp message directly to n8nClaw's active webhook
  const payload = {
    event: 'messages.upsert',
    instance: 'ivan-wa',
    data: {
      key: {
        remoteJid: IVAN_JID,
        fromMe: false,
        id: `DASHBOARD_${Date.now()}`,
      },
      pushName: 'Dashboard',
      message: { conversation: message },
      messageType: 'conversation',
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
  };

  try {
    const res = await fetch(N8NCLAW_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
