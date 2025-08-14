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
  <title>Commission Report</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      max-width: 800px; 
      margin: 0 auto; 
      padding: 20px; 
      background: white; 
      color: black; 
      line-height: 1.6;
    }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #333; padding-bottom: 20px; }
    .logo { max-width: 300px; height: auto; }
    h1 { color: #333; font-size: 24px; margin-bottom: 10px; }
    h2 { color: #333; font-size: 20px; margin: 30px 0 15px 0; border-bottom: 2px solid #333; padding-bottom: 8px; }
    h3 { color: #333; font-size: 16px; margin: 20px 0 10px 0; border-bottom: 1px solid #666; padding-bottom: 5px; }
    .customer-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #333; }
    .customer-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .customer-item h3 { border: none; margin: 0 0 5px 0; font-size: 14px; font-weight: bold; color: #555; }
    .customer-item p { margin: 0; font-size: 16px; color: #333; }
    .section { margin-bottom: 25px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #fff; }
    .details { display: flex; justify-content: space-between; margin: 12px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
    .details:last-child { border-bottom: none; }
    .details span:first-child { font-weight: 500; color: #555; }
    .details span:last-child { font-weight: bold; color: #333; }
    .highlight { background: #f0f8ff; padding: 15px; border-radius: 8px; font-weight: bold; border-left: 4px solid #007bff; margin-top: 15px; }
    .add-ons { background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 10px 0; }
    .add-ons h4 { margin: 0 0 10px 0; color: #333; font-size: 14px; }
    .add-on-item { margin: 5px 0; padding: 5px 0; border-bottom: 1px solid #ddd; }
    .add-on-item:last-child { border-bottom: none; }
    .disclaimer { background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin-top: 30px; border-left: 4px solid #ffc107; }
    .disclaimer strong { color: #856404; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Arrows Displays Commission Report</h1>
    <p style="margin: 0; color: #666; font-size: 14px;">Generated on ${new Date().toLocaleDateString()}</p>
  </div>

  ${data.customerData && (data.customerData.businessName || data.customerData.dateProposalSigned || data.customerData.collectedAmount) ? `
  <div class="customer-info">
    <h2>Customer Information</h2>
    <div class="customer-grid">
      ${data.customerData.businessName ? `
      <div class="customer-item">
        <h3>Business Name:</h3>
        <p>${data.customerData.businessName}</p>
      </div>
      ` : ''}
      ${data.customerData.dateProposalSigned ? `
      <div class="customer-item">
        <h3>Date Proposal Signed:</h3>
        <p>${data.customerData.dateProposalSigned}</p>
      </div>
      ` : ''}
      ${data.customerData.collectedAmount ? `
      <div class="customer-item">
        <h3>Collected Amount:</h3>
        <p>${data.customerData.collectedAmount}</p>
      </div>
      ` : ''}
    </div>
  </div>
  ` : ''}

  <div class="section">
    <h3>Campaign Details</h3>
    <div class="details">
      <span>Spot Duration:</span>
      <span>${data.spotType}-second spot</span>
    </div>
    <div class="details">
      <span>Locations:</span>
      <span>${data.locations}</span>
    </div>
    <div class="details">
      <span>Contract Length:</span>
      <span>${data.contractLength} months</span>
    </div>
    <div class="details">
      <span>Campaign Type:</span>
      <span>${data.isRenewal ? `Renewal (Year ${data.renewalYear === 4 ? '4+' : data.renewalYear})` : 'New Business'}</span>
    </div>
    ${data.hasReferral ? `
    <div class="details">
      <span>Referral Bonus:</span>
      <span>Included</span>
    </div>
    ` : ''}
  </div>

  <div class="section">
    <h3>Pricing Breakdown</h3>
    <div class="details">
      <span>Base Monthly Rate per Location:</span>
      <span>$${(parseFloat(data.calculations.baseMonthlyRate) / parseInt(data.locations)).toFixed(2)}</span>
    </div>
    ${parseFloat(data.calculations.addOnMonthlyRate) > 0 ? `
    <div class="details">
      <span>Add-on Monthly Rate:</span>
      <span>$${data.calculations.addOnMonthlyRate}</span>
    </div>
    ` : ''}
    <div class="details">
      <span>Total Monthly Rate per Location:</span>
      <span>$${data.calculations.monthlyRatePerLocation}</span>
    </div>
    <div class="details">
      <span>Total Monthly Value:</span>
      <span>$${data.calculations.totalMonthlyValue}</span>
    </div>
    <div class="details">
      <span>Total Contract Value:</span>
      <span>$${data.calculations.totalContractValue}</span>
    </div>
    
    ${data.addOns && (data.addOns.peakTime?.enabled || data.addOns.screenTakeover?.enabled) ? `
    <div class="add-ons">
      <h4>Selected Add-ons:</h4>
      ${data.addOns.peakTime?.enabled ? '<div class="add-on-item">Peak Time Scheduling</div>' : ''}
      ${data.addOns.screenTakeover?.enabled ? '<div class="add-on-item">Screen Takeover</div>' : ''}
    </div>
    ` : ''}
  </div>

  <div class="section">
    <h3>Commission Earnings (${data.calculations.commissionPercentage}%)</h3>
    ${parseFloat(data.calculations.initialCommission) > 0 ? `
    <div class="details">
      <span>Initial Commission (Month 1):</span>
      <span>$${data.calculations.initialCommission}</span>
    </div>
    ` : ''}
    ${parseFloat(data.calculations.monthlyResidual) > 0 ? `
    <div class="details">
      <span>Monthly ${data.isRenewal ? 'Commission' : 'Residual'}:</span>
      <span>$${data.calculations.monthlyResidual}</span>
    </div>
    ` : ''}
    <div class="highlight">
      <div class="details" style="border: none;">
        <span>Total Campaign Earnings:</span>
        <span style="font-size: 18px; color: #007bff;">$${data.calculations.totalCommission}</span>
      </div>
    </div>
  </div>

  <div class="disclaimer">
    <strong>DISCLAIMER:</strong> This calculation is for demonstration purposes only and is subject to commission auditing and approvals per your seller agreement.
  </div>
</body>
</html>
  `
}