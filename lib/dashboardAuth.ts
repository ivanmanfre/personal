const DASHBOARD_HASH = import.meta.env.VITE_DASHBOARD_HASH || '';
const SESSION_KEY = 'dashboard_auth';

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(password: string): Promise<boolean> {
  const hash = await sha256(password);
  if (hash === DASHBOARD_HASH) {
    localStorage.setItem(SESSION_KEY, hash);
    return true;
  }
  return false;
}

export function isAuthenticated(): boolean {
  return localStorage.getItem(SESSION_KEY) === DASHBOARD_HASH;
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}
