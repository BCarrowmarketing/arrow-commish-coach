import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Resend } from "npm:resend@2.0.0"
import { createClient } from "npm:@supabase/supabase-js@2.45.4"

// The only browser origins allowed to trigger a send. Anything else (or no
// Origin at all) gets a 403 and no email.
const ALLOWED_ORIGINS: readonly string[] = [
  'https://bcarrowmarketing.github.io',
  'https://arrow-commish-coach.lovable.app',
  'http://localhost:8080',
  'http://localhost:5173',
]

const IP_LIMIT_PER_HOUR = 5
const GLOBAL_LIMIT_PER_HOUR = 30
const MAX_BODY_BYTES = 20_000
const MAX_STRING_LEN = 200
const MAX_EMAIL_LEN = 254
const MAX_LOCATIONS = 1000
const MAX_MONEY = 1_000_000_000

// Single address only: no whitespace, commas, semicolons, angle brackets or newlines.
const EMAIL_RE =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function corsHeadersFor(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0].trim()
    if (first) return first.slice(0, 100)
  }
  const cf = req.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf.slice(0, 100)
  return 'unknown'
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const cors = corsHeadersFor(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, cors)
  }

  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: 'Origin not allowed' }, 403, cors)
  }

  try {
    // ---- shape ----
    const raw = await req.text()
    if (raw.length > MAX_BODY_BYTES) {
      throw new HttpError(413, 'Request too large')
    }
    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      throw new HttpError(400, 'Invalid JSON body')
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new HttpError(400, 'Invalid request body')
    }
    const payload = body as Record<string, unknown>

    const email = validateEmail(payload.email)
    const report = normalizeReport(payload.calculationData)
    const htmlReport = generateHTMLReport(report)

    // ---- dependencies (fail closed) ----
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!resendKey || !supabaseUrl || !serviceKey) {
      console.error('send-commission-report: missing configuration', {
        resend: !!resendKey,
        supabaseUrl: !!supabaseUrl,
        serviceKey: !!serviceKey,
      })
      throw new HttpError(503, 'Email service unavailable')
    }

    // ---- rate limit: claim the send BEFORE calling Resend ----
    const ip = clientIp(req)
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    let claim: unknown = null
    let claimError: { code?: string } | null = null
    try {
      const result = await supabase.rpc('claim_commission_report_send', {
        p_ip: ip,
        p_recipient: email,
        p_ip_limit: IP_LIMIT_PER_HOUR,
        p_global_limit: GLOBAL_LIMIT_PER_HOUR,
      })
      claim = result.data
      claimError = result.error
    } catch (_e) {
      claimError = { code: 'exception' }
    }
    if (claimError || typeof claim !== 'string') {
      console.error('send-commission-report: rate-limit claim failed', claimError?.code ?? 'no-result')
      throw new HttpError(503, 'Email service unavailable')
    }
    if (claim !== 'ok') {
      console.warn('send-commission-report: rate limited', claim)
      throw new HttpError(429, 'Too many reports sent. Please try again in an hour.')
    }

    // ---- act ----
    const resend = new Resend(resendKey)
    const emailResponse = await resend.emails.send({
      from: 'Arrows Displays <sales@arrowsdisplays.com>',
      to: [email],
      subject: 'Arrows Displays Commission Calculation Report',
      html: htmlReport,
    })

    if (emailResponse.error) {
      console.error('send-commission-report: Resend error', emailResponse.error.name ?? 'unknown')
      throw new HttpError(502, 'Failed to send commission report')
    }

    return json(
      {
        success: true,
        message: 'Commission report sent successfully',
        emailId: emailResponse.data?.id,
      },
      200,
      cors,
    )
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.message }, error.status, cors)
    }
    console.error('send-commission-report: unexpected error', error instanceof Error ? error.name : 'unknown')
    return json({ error: 'Failed to send commission report' }, 500, cors)
  }
})

// ---------------------------------------------------------------------------
// Validation / normalization. Nothing caller-supplied reaches the HTML except
// through escapeHtml() or a Number(...).toFixed() string.
// ---------------------------------------------------------------------------

function validateEmail(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, 'Valid email address is required')
  const email = value.trim()
  if (email.length === 0 || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    throw new HttpError(400, 'Valid email address is required')
  }
  return email
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeText(value: unknown, field: string): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new HttpError(400, `Invalid ${field}`)
  }
  const s = String(value).trim()
  if (s.length > MAX_STRING_LEN) throw new HttpError(400, `${field} is too long`)
  return escapeHtml(s)
}

function finiteNumber(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new HttpError(400, `Invalid ${field}`)
  }
  if (typeof value === 'string' && (value.trim() === '' || value.length > 50)) {
    throw new HttpError(400, `Invalid ${field}`)
  }
  const n = Number(value)
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `Invalid ${field}`)
  return n
}

function money(value: unknown, field: string): string {
  return finiteNumber(value, field, -MAX_MONEY, MAX_MONEY).toFixed(2)
}

type AddOn = { enabled: boolean; locations: string }

type NormalizedReport = {
  customer: { businessName: string; dateProposalSigned: string; collectedAmount: string } | null
  spotType: string
  locations: string
  contractLength: string
  isRenewal: boolean
  renewalYearLabel: string
  peakTime: AddOn
  screenTakeover: AddOn
  calc: {
    monthlyRatePerLocation: string
    addOnMonthlyRate: string
    addOnMonthlyRateNum: number
    totalMonthlyValue: string
    totalContractValue: string
    commissionPercentage: string
    initialCommission: string
    initialCommissionNum: number
    monthlyResidual: string
    monthlyResidualNum: number
    totalCommission: string
  }
}

function normalizeAddOn(value: unknown, field: string): AddOn {
  if (value === undefined || value === null) return { enabled: false, locations: '0' }
  if (typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, `Invalid ${field}`)
  const v = value as Record<string, unknown>
  const enabled = v.enabled === true
  const locations = enabled ? finiteNumber(v.locations, `${field}.locations`, 0, MAX_LOCATIONS).toFixed(0) : '0'
  return { enabled, locations }
}

function normalizeReport(data: unknown): NormalizedReport {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpError(400, 'calculationData is required')
  }
  const d = data as Record<string, unknown>

  // Customer block (optional)
  let customer: NormalizedReport['customer'] = null
  if (d.customerData !== undefined && d.customerData !== null) {
    if (typeof d.customerData !== 'object' || Array.isArray(d.customerData)) {
      throw new HttpError(400, 'Invalid customerData')
    }
    const c = d.customerData as Record<string, unknown>
    const businessName = safeText(c.businessName, 'businessName')
    const dateProposalSigned = safeText(c.dateProposalSigned, 'dateProposalSigned')
    let collectedAmount = ''
    if (c.collectedAmount !== undefined && c.collectedAmount !== null && String(c.collectedAmount).trim() !== '') {
      // The UI placeholder is "$5,000.00", so tolerate a leading $ and thousands commas.
      const cleaned = typeof c.collectedAmount === 'string'
        ? c.collectedAmount.trim().replace(/^\$/, '').replace(/,/g, '')
        : c.collectedAmount
      collectedAmount = money(cleaned, 'collectedAmount')
    }
    if (businessName || dateProposalSigned || collectedAmount) {
      customer = { businessName, dateProposalSigned, collectedAmount }
    }
  }

  // Add-ons: the caller sends an object with two known keys; nothing else is read.
  const addOns = d.addOns
  if (addOns !== undefined && addOns !== null && (typeof addOns !== 'object' || Array.isArray(addOns))) {
    throw new HttpError(400, 'Invalid addOns')
  }
  const addOnsObj = (addOns ?? {}) as Record<string, unknown>
  const peakTime = normalizeAddOn(addOnsObj.peakTime, 'addOns.peakTime')
  const screenTakeover = normalizeAddOn(addOnsObj.screenTakeover, 'addOns.screenTakeover')

  const isRenewal = d.isRenewal === true
  let renewalYearLabel = '1'
  if (isRenewal) {
    const year = finiteNumber(d.renewalYear, 'renewalYear', 1, 99)
    renewalYearLabel = year === 4 ? '4+' : year.toFixed(0)
  }

  const calcRaw = d.calculations
  if (!calcRaw || typeof calcRaw !== 'object' || Array.isArray(calcRaw)) {
    throw new HttpError(400, 'calculations are required')
  }
  const c = calcRaw as Record<string, unknown>
  const addOnMonthlyRateNum = finiteNumber(c.addOnMonthlyRate, 'addOnMonthlyRate', -MAX_MONEY, MAX_MONEY)
  const initialCommissionNum = finiteNumber(c.initialCommission, 'initialCommission', -MAX_MONEY, MAX_MONEY)
  const monthlyResidualNum = finiteNumber(c.monthlyResidual, 'monthlyResidual', -MAX_MONEY, MAX_MONEY)

  return {
    customer,
    spotType: safeText(d.spotType, 'spotType'),
    locations: finiteNumber(d.locations, 'locations', 0, MAX_LOCATIONS).toFixed(0),
    contractLength: finiteNumber(d.contractLength, 'contractLength', 0, 120).toFixed(0),
    isRenewal,
    renewalYearLabel,
    peakTime,
    screenTakeover,
    calc: {
      monthlyRatePerLocation: money(c.monthlyRatePerLocation, 'monthlyRatePerLocation'),
      addOnMonthlyRate: addOnMonthlyRateNum.toFixed(2),
      addOnMonthlyRateNum,
      totalMonthlyValue: money(c.totalMonthlyValue, 'totalMonthlyValue'),
      totalContractValue: money(c.totalContractValue, 'totalContractValue'),
      commissionPercentage: finiteNumber(c.commissionPercentage, 'commissionPercentage', 0, 100).toFixed(1),
      initialCommission: initialCommissionNum.toFixed(2),
      initialCommissionNum,
      monthlyResidual: monthlyResidualNum.toFixed(2),
      monthlyResidualNum,
      totalCommission: money(c.totalCommission, 'totalCommission'),
    },
  }
}

function generateHTMLReport(data: NormalizedReport) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commission Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      line-height: 1.6;
      color: #e5e7eb;
      background-color: #111827;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #1f2937;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    }
    .header {
      background: linear-gradient(135deg, #374151, #4b5563);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
    }
    .header p {
      margin: 5px 0 0 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .content {
      padding: 0;
    }
    .section {
      margin: 0;
      border-bottom: 1px solid #374151;
    }
    .section:last-child {
      border-bottom: none;
    }
    .section-header {
      background-color: #374151;
      color: #f3f4f6;
      padding: 15px 25px;
      font-size: 18px;
      font-weight: 600;
      margin: 0;
      border-bottom: 2px solid #4b5563;
    }
    .section-content {
      padding: 25px;
      background-color: #1f2937;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 20px;
      margin-bottom: 0;
    }
    .info-item {
      background-color: #374151;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #6b7280;
    }
    .info-label {
      font-size: 12px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
      font-weight: 500;
    }
    .info-value {
      font-size: 16px;
      color: #f3f4f6;
      font-weight: 600;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #374151;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      color: #d1d5db;
      font-size: 14px;
    }
    .detail-value {
      color: #f3f4f6;
      font-weight: 600;
      font-family: 'SF Mono', Consolas, monospace;
    }
    .highlight-box {
      background: linear-gradient(135deg, #059669, #10b981);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      margin: 20px 0;
    }
    .highlight-amount {
      font-size: 28px;
      font-weight: 700;
      margin: 5px 0;
      font-family: 'SF Mono', Consolas, monospace;
    }
    .addon-item {
      background-color: #4b5563;
      padding: 10px 15px;
      border-radius: 6px;
      margin-bottom: 8px;
      border-left: 3px solid #6b7280;
    }
    .addon-name {
      color: #f3f4f6;
      font-weight: 500;
      font-size: 14px;
    }
    .footer {
      background-color: #111827;
      color: #9ca3af;
      text-align: center;
      padding: 20px;
      font-size: 12px;
      border-top: 1px solid #374151;
    }
    @media only screen and (max-width: 600px) {
      .container {
        margin: 0;
        border-radius: 0;
      }
      .info-grid {
        grid-template-columns: 1fr;
      }
      .detail-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 5px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Arrows Displays Commission Report</h1>
      <p>Generated on ${new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}</p>
    </div>

    <div class="content">
      ${data.customer ? `
      <div class="section">
        <h2 class="section-header">Customer Information</h2>
        <div class="section-content">
          <div class="info-grid">
            ${data.customer.businessName ? `
            <div class="info-item">
              <div class="info-label">Business Name</div>
              <div class="info-value">${data.customer.businessName}</div>
            </div>
            ` : ''}
            ${data.customer.dateProposalSigned ? `
            <div class="info-item">
              <div class="info-label">Date Proposal Signed</div>
              <div class="info-value">${data.customer.dateProposalSigned}</div>
            </div>
            ` : ''}
            ${data.customer.collectedAmount ? `
            <div class="info-item">
              <div class="info-label">Collected Amount</div>
              <div class="info-value">$${data.customer.collectedAmount}</div>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
      ` : ''}

      <div class="section">
        <h2 class="section-header">Campaign Details</h2>
        <div class="section-content">
          <div class="detail-row">
            <span class="detail-label">Spot Duration:</span>
            <span class="detail-value">${data.spotType}-second spot</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Locations:</span>
            <span class="detail-value">${data.locations}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Contract Length:</span>
            <span class="detail-value">${data.contractLength} months</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Campaign Type:</span>
            <span class="detail-value">${data.isRenewal ? `Year ${data.renewalYearLabel} Renewal` : 'New Business'}</span>
          </div>
          ${(data.peakTime.enabled || data.screenTakeover.enabled) ? `
          <div class="detail-row">
            <span class="detail-label">Selected Add-ons:</span>
            <div>
              ${data.peakTime.enabled ? `<div class="addon-item"><div class="addon-name">Peak Time Scheduling (${data.peakTime.locations} locations)</div></div>` : ''}
              ${data.screenTakeover.enabled ? `<div class="addon-item"><div class="addon-name">Screen Takeover (${data.screenTakeover.locations} locations)</div></div>` : ''}
            </div>
          </div>
          ` : ''}
        </div>
      </div>

      <div class="section">
        <h2 class="section-header">Pricing Breakdown</h2>
        <div class="section-content">
          <div class="detail-row">
            <span class="detail-label">Base Monthly Rate per Location:</span>
            <span class="detail-value">$${data.calc.monthlyRatePerLocation}</span>
          </div>
          ${data.calc.addOnMonthlyRateNum > 0 ? `
          <div class="detail-row">
            <span class="detail-label">Add-on Monthly Rate:</span>
            <span class="detail-value">$${data.calc.addOnMonthlyRate}</span>
          </div>
          ` : ''}
          <div class="detail-row">
            <span class="detail-label">Total Monthly Value:</span>
            <span class="detail-value">$${data.calc.totalMonthlyValue}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Total Contract Value:</span>
            <span class="detail-value">$${data.calc.totalContractValue}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h2 class="section-header">Commission Earnings (${data.calc.commissionPercentage}%)</h2>
        <div class="section-content">
          ${data.calc.initialCommissionNum > 0 ? `
          <div class="detail-row">
            <span class="detail-label">Initial Commission (Month 1):</span>
            <span class="detail-value">$${data.calc.initialCommission}</span>
          </div>
          ` : ''}
          ${data.calc.monthlyResidualNum > 0 ? `
          <div class="detail-row">
            <span class="detail-label">${data.isRenewal ? 'Monthly Commission' : 'Monthly Residual'}:</span>
            <span class="detail-value">$${data.calc.monthlyResidual}</span>
          </div>
          ` : ''}

          <div class="highlight-box">
            <div style="font-size: 16px; opacity: 0.9;">Total Campaign Earnings</div>
            <div class="highlight-amount">$${data.calc.totalCommission}</div>
            <div style="font-size: 14px; opacity: 0.8;">Year ${data.isRenewal ? data.renewalYearLabel : 1}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p><strong>DISCLAIMER:</strong> This calculation is for demonstration purposes only and is subject to commission auditing and approvals per your seller agreement.</p>
    </div>
  </div>
</body>
</html>`
}
