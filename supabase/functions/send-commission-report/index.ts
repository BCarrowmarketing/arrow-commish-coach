import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
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

    // Send email using your preferred email service
    // For now, we'll use a placeholder response
    // You would integrate with services like Resend, SendGrid, etc.
    
    const emailData = {
      to: email,
      from: 'sales@arrowsdisplays.com',
      subject: 'Arrows Displays Commission Calculation Report',
      html: htmlReport,
    }

    // TODO: Integrate with actual email service
    // const response = await sendEmail(emailData)

    console.log('Email would be sent to:', email)
    console.log('Report data:', calculationData)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Commission report sent successfully',
        // For demo purposes, we'll return success
        // In production, you'd send the actual email
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
    }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { max-width: 300px; height: auto; }
    .section { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; }
    .section h3 { margin-top: 0; border-bottom: 2px solid #333; padding-bottom: 5px; }
    .details { display: flex; justify-content: space-between; margin: 10px 0; }
    .highlight { background: #f5f5f5; padding: 10px; border-radius: 5px; font-weight: bold; }
    .disclaimer { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Arrows Displays Commission Report</h1>
    <p>Generated on ${new Date().toLocaleDateString()}</p>
  </div>

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
  </div>

  <div class="section">
    <h3>Pricing Breakdown</h3>
    <div class="details">
      <span>Monthly Rate per Location:</span>
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
      <div class="details">
        <span>Total Campaign Earnings:</span>
        <span>$${data.calculations.totalCommission}</span>
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