// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import fixture from '../../lib/reply-source-v1.fixture.json'
const { rpc, from, tableRows } = vi.hoisted(() => {
 const rpc = vi.fn(), tableRows = { pending: [] as any[] }
 const from = vi.fn((table: string) => {
  let columns = ''
  const chain: any = new Proxy({}, { get: (_, key) => {
   if (key === 'then') return Promise.resolve({ data: table === 'outreach_messages' && columns.includes('outreach_prospects(name)') ? tableRows.pending : [], error: null, count: 0 }).then.bind(Promise.resolve({ data: table === 'outreach_messages' && columns.includes('outreach_prospects(name)') ? tableRows.pending : [], error: null, count: 0 }))
   return (...args: any[]) => { if (key === 'select') columns = args[0]; return chain }
  } })
  return chain
 })
 return { rpc, from, tableRows }
})
vi.mock('../../lib/supabase', () => ({ supabase: { rpc, from, auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) }, channel: () => ({ on() { return this }, subscribe() { return this } }), removeChannel: () => {} } }))
vi.mock('../../contexts/DashboardContext', () => ({ useDashboard: () => ({ userTimezone: 'Europe/Warsaw', refreshRate: 3600000, lastRefreshed: new Date('2026-10-07T12:00:00Z'), setLastRefreshed: () => {} }) }))
import ClientBoardPage from '../ClientBoardPage'
import DeskOutreachSurface from './DeskOutreachSurface'
import { ReplySourceSummary } from './ReplySourceSummary'
import PerformancePanel from '../dashboard/PerformancePanel'
import OutreachPanel from '../dashboard/OutreachPanel'
import { TemplatesKpisView, TemplatesPanel, LaneKpisPanel } from '../dashboard-v2/sections/clientops2/TemplatesKpis'
import { OutreachView } from '../dashboard-v2/sections/clientops2/OutreachView'
import { saveBoardSession } from '../../lib/boardSession'
let mode = 'live', skin = 'desk', configured = true, boardClient = 'risedtc'
const log = [{ prospect_id: 'p-a', name: 'Ada Fixture', company: 'Fixture Co', lane: 'cold', replied: true, last_reply_at: '2026-10-07T10:00:00Z', messages: [{ direction: 'outbound', type: 'dm', channel: 'linkedin', sent_at: '2026-10-01T10:00:00Z', text: 'Existing sent message' }] }]
const board = () => ({ company_name: 'Fixture Co', client_id: configured ? boardClient : null, queue: [], skin, outreach: { sequences: { channels: [] } }, performance: { posts: [] } })
const sourceCalls = () => rpc.mock.calls.filter(([name]) => /^client_board_reply_source(?:_v2)?$/.test(name))
const metricCalls = () => rpc.mock.calls.filter(([name]) => /^client_board_reply_sources(?:_v2)?$/.test(name))
function mountBoard(tab = 'performance', slug = 'fixture', light = false) {
 window.history.replaceState(null, '', `/${light ? '?light' : ''}#${tab}`)
 return render(<MemoryRouter initialEntries={[`/client/${slug}?k=test-token`]}><Routes><Route path="/client/:slug" element={<ClientBoardPage />} /></Routes></MemoryRouter>)
}
beforeEach(() => {
 localStorage.clear(); mode = 'live'; skin = 'desk'; configured = true; boardClient = 'risedtc'; tableRows.pending = []
 vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }))
 vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} })
 vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
 rpc.mockImplementation(async (name: string, args: any) => {
  if (/^client_board_report(?:_v2)?$/.test(name)) return { data: { ok: true, report: { client: args.p_slug === 'arch-agency' ? 'arch' : 'risedtc', start_date: '2026-07-21', people: [{ n: 'Ada Fixture', c: 'Fixture Co', bk: '2026-10-07T10:00:00Z', w: ['2026-10-07T10:00:00Z'], gv: 'apps' }], came: [], engaged: [], posts: [], assists: [] } }, error: null }
  if (name === 'get_client_board' || name === 'get_client_board_by_session') return { data: { board: board(), mode }, error: null }
  if (/^client_board_reply_sources(?:_v2)?$/.test(name)) return { data: configured ? fixture.metrics : { status: 'not_configured', data: null }, error: null }
  if (/^client_board_reply_source(?:_v2)?$/.test(name) || name === 'inbox_reply_source') return { data: fixture.detail, error: null }
  if (name === 'outreach_reply_sources') return { data: fixture.metrics, error: null }
  if (/^client_board_outreach_log/.test(name)) return { data: { ok: true, log }, error: null }
  return { data: null, error: null }
 })
})
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals() })
it.each(['desk', 'blackbox'])('mounts board metrics on the %s Performance branch with token scope', async value => {
 skin = value; mountBoard()
 expect(await screen.findByText('First observed text replies')).toBeTruthy()
 expect(metricCalls()[0]).toEqual(['client_board_reply_sources', { p_slug: 'fixture', p_token: 'test-token', p_days: 30 }])
 expect(screen.getAllByRole('table')).toHaveLength(3)
})
it('prefers the existing board session for the new read when a session and token are present', async () => {
 saveBoardSession('fixture', { token: 'test-session', email: 'fixture@example.test', expires_at: '2099-01-01T00:00:00Z' }); mountBoard()
 expect(await screen.findByText('First observed text replies')).toBeTruthy()
 expect(metricCalls()[0]).toEqual(['client_board_reply_sources_v2', { p_slug: 'fixture', p_session: 'test-session', p_days: 30 }])
})
it.each(['preview', 'demo'])('keeps the %s board free of live source reads', async value => {
 mode = value; mountBoard(); expect(await screen.findByText(/Preview board/)).toBeTruthy(); expect(metricCalls()).toHaveLength(0); expect(sourceCalls()).toHaveLength(0)
})
it('makes no live source read for a generating board', async () => {
 mode = 'generating'; mountBoard(); expect(await screen.findByText(/We're building/)).toBeTruthy(); expect(metricCalls()).toHaveLength(0); expect(sourceCalls()).toHaveLength(0)
})
it('keeps a null-client live board apart from Ivan metrics', async () => {
 configured = false; mountBoard(); expect(await screen.findByText(/Reply sources are not configured/)).toBeTruthy(); expect(screen.queryByRole('table')).toBeNull()
 expect(metricCalls()[0][1]).not.toHaveProperty('p_client_id')
})
it.each(['desk', 'blackbox'])('reads one %s board log source only after a prospect detail opens', async value => {
 skin = value; mountBoard('outreach')
 const name = await screen.findByText('Ada Fixture'); expect(sourceCalls()).toHaveLength(0)
 const element = name.closest('details')!; element.open = true; fireEvent(element, new Event('toggle'))
 expect(await screen.findByText('First observed text reply')).toBeTruthy(); expect(sourceCalls()).toHaveLength(1)
 expect(sourceCalls()[0]).toEqual(['client_board_reply_source', { p_slug: 'fixture', p_token: 'test-token', p_prospect_id: 'p-a' }])
 expect(screen.getByText('Existing sent message')).toBeTruthy()
 element.open = false; fireEvent(element, new Event('toggle')); expect(screen.queryByText('First observed text reply')).toBeNull()
})
it('uses the actual desk log detail slot without reading closed summaries', async () => {
 render(<DeskOutreachSurface board={board()} accent="#FFFFFF" log={log as any} renderReplySource={(id, open) => <ReplySourceSummary scope={{ kind: 'board-token', slug: 'fixture', token: 'test-token' }} prospectId={id} enabled={open} />} />)
 expect(sourceCalls()).toHaveLength(0)
 const element = screen.getByText('Ada Fixture').closest('details')!; element.open = true; fireEvent(element, new Event('toggle'))
 expect(await screen.findByText('First observed text reply')).toBeTruthy(); expect(sourceCalls()).toHaveLength(1)
})
it.each(['performance', 'classic'])('mounts Ivan operator metrics in own %s dashboard', async surface => {
 render(surface === 'performance' ? <PerformancePanel /> : <OutreachPanel />)
 expect(await screen.findByText('First observed text replies')).toBeTruthy()
 expect(rpc.mock.calls.find(([n]) => n === 'outreach_reply_sources')).toEqual(['outreach_reply_sources', { p_client_id: 'ivan', p_campaign_id: null, p_days: 30 }])
})
it.each(['arch', null])('mounts the KPI read for the selected dashboard client %s', async clientId => {
 render(<TemplatesKpisView clientId={clientId} />)
 expect(await screen.findByText('First observed text replies')).toBeTruthy()
 expect(rpc.mock.calls.find(([n]) => n === 'outreach_reply_sources')).toEqual(['outreach_reply_sources', { p_client_id: clientId ?? 'ivan', p_campaign_id: null, p_days: 30 }])
})
it('sorts known template purpose first and unknown steps last in lexical order', async () => {
 const steps = ['z_other','dm5','recycle','dm4','dm3','dm2','dm1','connection_note','a_other','followup','deliver','inmail','email']
 const templates = steps.map(step => ({ key: step, client_id: 'arch', lane: 'cold', step, label: `Template ${step}`, body: 'Fixture copy', subject: null, tokens: [], editable: false, in_rotation: true, source: null, live_synced: true, notes: null, updated_at: '2026-10-07T12:00:00Z', history: [] }))
 rpc.mockImplementation(async name => ({ data: name === 'operator_outreach_templates' ? { wired: false, templates } : null, error: null }))
 const view = render(<TemplatesPanel clientId="arch" />)
 await screen.findByText('Template dm5')
 expect([...view.container.querySelectorAll('.co4-chip')].map(e => e.textContent)).toEqual(['Note','DM 1','DM 2','DM 3','DM 4','DM 5','Recycle','Requested delivery','Conversation follow-up','InMail','Email','a_other','z_other'])
})
it('labels the existing lane rate as all-time counter data without a formula change', async () => {
 const kpis = { staged: 1, sent: 10, sent_mtd: 10, sent_7d: 1, sent_1d: 1, sendable: 1, held_no_ads: 0, held_no_note: 0, accepted: 2, accept_rate: .2, dm1: 2, dm2: 1, replied: 1, reply_rate: .5, needs_reply: 0, last_send_at: null }
 rpc.mockImplementation(async () => ({ data: { lanes: [{ id: 'lane', name: 'Cold', is_active: true, lane_key: 'cold', kpis }] }, error: null }))
 render(<LaneKpisPanel clientId="arch" />)
 expect(await screen.findByText('All-time, counter-based')).toBeTruthy(); expect(screen.getByText(/50% ·/)).toBeTruthy()
})
it('keeps unknown numeric draft positions distinct from a source purpose in classic Outreach', async () => {
 tableRows.pending = [null, 4].map((sequence_step, i) => ({ id: `draft-${i}`, prospect_id: 'p-a', direction: 'outbound', message_type: 'dm', sequence_step, message_text: 'Draft copy', created_at: '2026-10-07T10:00:00Z', sent_at: null, approved_at: null, outreach_prospects: { name: 'Ada Draft' } }))
 render(<OutreachPanel />); await screen.findByText('First observed text replies')
 fireEvent.click(await screen.findByRole('tab', { name: /Review/ }))
 expect((await screen.findAllByText('Unknown touch')).some(e => e.tagName === 'SPAN')).toBe(true); expect(screen.getByText('Sequence position 4')).toBeTruthy(); expect(screen.queryByText('DM Step null')).toBeNull()
})
it('reads an operator prospect source when its existing details open', async () => {
 const prospect = { id: 'p-a', campaign_id: 'c-a', name: 'Ada Operator', company: 'Fixture Co', headline: null, icp_score: 8, stage: 'replied', preferred_channel: 'linkedin', note_variant: null, send_priority: null, blacklisted: false, skip_reason: null, connection_note: null, offer_angle: null, gate: null, anchor_client: null, last_dm_sent_at: null, connection_sent_at: null, connected_at: null, last_reply_at: '2026-10-07T10:00:00Z', reply_count: 1, dm_count: 1, needs_manual_reply: false, next_touch_after: null, messaged: true, awaiting_reply: false, messages: [] }
 const payload = { ok: true, armed: false, sequences: { channels: [] }, lanes_meta: {}, campaigns: [{ id: 'c-a', name: 'Cold', is_active: true, lane_key: 'cold', counts: { total: 1, messaged: 1, awaiting_reply: 0, needs_reply: 0, replied: 1, gated: 0 } }], prospects: [prospect] }
 rpc.mockImplementation(async name => ({ data: name === 'operator_client_outreach' ? payload : name === 'inbox_reply_source' ? fixture.detail : null, error: null }))
 render(<OutreachView clientId="arch" company="Fixture Co" />)
 fireEvent.click(screen.getByRole('tab', { name: /Lanes & sequences/ }))
 const button = await screen.findByRole('button', { name: /Ada Operator/ }); expect(rpc.mock.calls.filter(([n]) => n === 'inbox_reply_source')).toHaveLength(0)
 fireEvent.click(button); expect(await screen.findByText('First observed text reply')).toBeTruthy()
 expect(rpc.mock.calls.filter(([n]) => n === 'inbox_reply_source')).toEqual([['inbox_reply_source', { p_prospect_id: 'p-a' }]])
})

it.each([
 ['risedtc-com', 'risedtc', true], ['arch-agency', 'arch', true],
 ['risedtc-com', 'risedtc', false], ['arch-agency', 'arch', false],
] as const)('reads the real %s report message source once after open, client=%s light=%s', async (slug, client, light) => {
 boardClient = client
 const view = mountBoard('outreach', slug, light)
 await screen.findAllByText('Ada Fixture')
 expect(view.container.querySelector('[data-report="pipeline"]')).toBeTruthy()
 expect(sourceCalls()).toHaveLength(0)
 if (light) {
  const detail = screen.getByText('the messages').closest('details')!
  detail.open = true; fireEvent(detail, new Event('toggle'))
 } else fireEvent.click(await screen.findByRole('button', { name: /Read the thread/ }))
 expect(await screen.findByText('First observed text reply')).toBeTruthy()
 expect(sourceCalls()).toEqual([['client_board_reply_source', { p_slug: slug, p_token: 'test-token', p_prospect_id: 'p-a' }]])
 expect(screen.getByText('Existing sent message')).toBeTruthy()
 if (light) {
  const detail = screen.getByText('the messages').closest('details')!
  detail.open = false; fireEvent(detail, new Event('toggle'))
 } else fireEvent.click(screen.getByRole('button', { name: /Hide the thread/ }))
 expect(screen.queryByText('First observed text reply')).toBeNull()
 expect(sourceCalls()).toHaveLength(1)
})
