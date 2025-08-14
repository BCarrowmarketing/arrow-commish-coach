import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Resend } from "npm:resend@2.0.0"

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('Function called, method:', req.method)
  
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, calculationData } = await req.json()

    // Validate email
    if (!email || !email.includes('@')) {
      throw new Error('Valid email address is required')
    }

    // Generate HTML report
    const htmlReport = generateHTMLReport(calculationData)

    console.log('Sending email to:', email)
    console.log('RESEND_API_KEY available:', !!Deno.env.get('RESEND_API_KEY'))
    
    // Send email using Resend
    const emailResponse = await resend.emails.send({
      from: 'Arrows Displays <sales@arrowsdisplays.com>',
      to: [email],
      subject: 'Arrows Displays Commission Calculation Report',
      html: htmlReport,
    })

    console.log('Email sent successfully:', emailResponse)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Commission report sent successfully',
        emailId: emailResponse.data?.id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send commission report' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})

function generateHTMLReport(data: any) {
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
      ${data.customerData && (data.customerData.businessName || data.customerData.dateProposalSigned || data.customerData.collectedAmount) ? `
      <div class="section">
        <h2 class="section-header">Customer Information</h2>
        <div class="section-content">
          <div class="info-grid">
            ${data.customerData.businessName ? `
            <div class="info-item">
              <div class="info-label">Business Name</div>
              <div class="info-value">${data.customerData.businessName}</div>
            </div>
            ` : ''}
            ${data.customerData.dateProposalSigned ? `
            <div class="info-item">
              <div class="info-label">Date Proposal Signed</div>
              <div class="info-value">${data.customerData.dateProposalSigned}</div>
            </div>
            ` : ''}
            ${data.customerData.collectedAmount ? `
            <div class="info-item">
              <div class="info-label">Collected Amount</div>
              <div class="info-value">$${data.customerData.collectedAmount}</div>
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
            <span class="detail-value">${data.isRenewal ? `Year ${data.renewalYear === 4 ? '4+' : data.renewalYear} Renewal` : 'New Business'}</span>
          </div>
          ${(data.addOns && (data.addOns.peakTime?.enabled || data.addOns.screenTakeover?.enabled)) ? `
          <div class="detail-row">
            <span class="detail-label">Selected Add-ons:</span>
            <div>
              ${data.addOns.peakTime?.enabled ? `<div class="addon-item"><div class="addon-name">Peak Time Scheduling (${data.addOns.peakTime.locations} locations)</div></div>` : ''}
              ${data.addOns.screenTakeover?.enabled ? `<div class="addon-item"><div class="addon-name">Screen Takeover (${data.addOns.screenTakeover.locations} locations)</div></div>` : ''}
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
            <span class="detail-value">$${data.calculations.monthlyRatePerLocation}</span>
          </div>
          ${parseFloat(data.calculations.addOnMonthlyRate) > 0 ? `
          <div class="detail-row">
            <span class="detail-label">Add-on Monthly Rate:</span>
            <span class="detail-value">$${data.calculations.addOnMonthlyRate}</span>
          </div>
          ` : ''}
          <div class="detail-row">
            <span class="detail-label">Total Monthly Value:</span>
            <span class="detail-value">$${data.calculations.totalMonthlyValue}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Total Contract Value:</span>
            <span class="detail-value">$${data.calculations.totalContractValue}</span>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h2 class="section-header">Commission Earnings (${data.calculations.commissionPercentage}%)</h2>
        <div class="section-content">
          ${parseFloat(data.calculations.initialCommission) > 0 ? `
          <div class="detail-row">
            <span class="detail-label">Initial Commission (Month 1):</span>
            <span class="detail-value">$${data.calculations.initialCommission}</span>
          </div>
          ` : ''}
          ${parseFloat(data.calculations.monthlyResidual) > 0 ? `
          <div class="detail-row">
            <span class="detail-label">${data.isRenewal ? 'Monthly Commission' : 'Monthly Residual'}:</span>
            <span class="detail-value">$${data.calculations.monthlyResidual}</span>
          </div>
          ` : ''}
          
          <div class="highlight-box">
            <div style="font-size: 16px; opacity: 0.9;">Total Campaign Earnings</div>
            <div class="highlight-amount">$${data.calculations.totalCommission}</div>
            <div style="font-size: 14px; opacity: 0.8;">Year ${data.isRenewal ? (data.renewalYear === 4 ? '4+' : data.renewalYear) : 1}</div>
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