const EVOLUTION_URL = 'http://24.199.118.135:8080';
const EVOLUTION_KEY = 'evo_ivan_n8nclaw_2026';
const IVAN_NUMBER = '5491159385939';

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

  try {
    const res = await fetch(`${EVOLUTION_URL}/message/sendText/ivan-wa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
      body: JSON.stringify({ number: IVAN_NUMBER, text: message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
