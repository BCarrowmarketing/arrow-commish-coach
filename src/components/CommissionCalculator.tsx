import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Calculator, DollarSign, TrendingUp, Calendar, Printer, Mail } from "lucide-react";

interface CommissionData {
  spotType: "10" | "20" | "30";
  locations: number;
  contractLength: 6 | 12;
  hasReferral: boolean;
  isRenewal: boolean;
  renewalYear: 2 | 3 | 4;
  addOns: {
    peakTime: {
      enabled: boolean;
      locations: number;
    };
    screenTakeover: {
      enabled: boolean;
      locations: number;
    };
  };
}

const SPOT_PRICES = {
  "10": 100,
  "20": 150,
  "30": 200,
};

const ADD_ON_PRICES = {
  peakTime: 50,
  screenTakeover: 50,
};

const CommissionCalculator = () => {
  const { toast } = useToast();
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [customerDataDialog, setCustomerDataDialog] = useState(false);
  const [customerData, setCustomerData] = useState({
    businessName: "",
    dateProposalSigned: "",
    collectedAmount: ""
  });
  const [data, setData] = useState<CommissionData>({
    spotType: "20",
    locations: 1,
    contractLength: 12,
    hasReferral: false,
    isRenewal: false,
    renewalYear: 2,
    addOns: {
      peakTime: {
        enabled: false,
        locations: 1,
      },
      screenTakeover: {
        enabled: false,
        locations: 1,
      },
    },
  });

  const [validationErrors, setValidationErrors] = useState({
    peakTime: false,
    screenTakeover: false,
  });

  const calculations = useMemo(() => {
    const basePrice = SPOT_PRICES[data.spotType];
    let monthlyRate = basePrice;

    // Apply term discount (12-month gets 10% off)
    if (data.contractLength === 12) {
      monthlyRate *= 0.9; // 10% off
    }

    // Apply multi-location discount
    if (data.locations >= 2 && data.locations <= 5) {
      monthlyRate *= 0.95; // Additional 5% off
    } else if (data.locations >= 6 && data.locations <= 10) {
      monthlyRate *= 0.9; // Additional 10% off
    } else if (data.locations >= 11) {
      monthlyRate *= 0.85; // Additional 15% off
    }

    // Calculate add-ons with same discounts
    let addOnMonthlyValue = 0;
    let addOnDetails = {
      peakTime: { enabled: false, locations: 0, monthlyValue: 0 },
      screenTakeover: { enabled: false, locations: 0, monthlyValue: 0 },
    };

    if (data.addOns.peakTime.enabled && data.addOns.peakTime.locations > 0) {
      let peakTimeRate = ADD_ON_PRICES.peakTime;
      
      // Apply same discounts as base pricing
      if (data.contractLength === 12) {
        peakTimeRate *= 0.9; // 10% off
      }
      
      if (data.locations >= 2 && data.locations <= 5) {
        peakTimeRate *= 0.95; // Additional 5% off
      } else if (data.locations >= 6 && data.locations <= 10) {
        peakTimeRate *= 0.9; // Additional 10% off
      } else if (data.locations >= 11) {
        peakTimeRate *= 0.85; // Additional 15% off
      }
      
      const peakTimeMonthlyValue = peakTimeRate * data.addOns.peakTime.locations;
      addOnMonthlyValue += peakTimeMonthlyValue;
      addOnDetails.peakTime = {
        enabled: true,
        locations: data.addOns.peakTime.locations,
        monthlyValue: peakTimeMonthlyValue,
      };
    }

    if (data.addOns.screenTakeover.enabled && data.addOns.screenTakeover.locations > 0) {
      let screenTakeoverRate = ADD_ON_PRICES.screenTakeover;
      
      // Apply same discounts as base pricing
      if (data.contractLength === 12) {
        screenTakeoverRate *= 0.9; // 10% off
      }
      
      if (data.locations >= 2 && data.locations <= 5) {
        screenTakeoverRate *= 0.95; // Additional 5% off
      } else if (data.locations >= 6 && data.locations <= 10) {
        screenTakeoverRate *= 0.9; // Additional 10% off
      } else if (data.locations >= 11) {
        screenTakeoverRate *= 0.85; // Additional 15% off
      }
      
      const screenTakeoverMonthlyValue = screenTakeoverRate * data.addOns.screenTakeover.locations;
      addOnMonthlyValue += screenTakeoverMonthlyValue;
      addOnDetails.screenTakeover = {
        enabled: true,
        locations: data.addOns.screenTakeover.locations,
        monthlyValue: screenTakeoverMonthlyValue,
      };
    }

    const baseMonthlyValue = monthlyRate * data.locations;
    const totalMonthlyValue = baseMonthlyValue + addOnMonthlyValue;
    const totalContractValue = totalMonthlyValue * data.contractLength;

    // Calculate commission percentages based on renewal year
    let commissionPercentage = 0.15; // 15% for new business (Year 1)
    if (data.isRenewal) {
      if (data.renewalYear === 2) commissionPercentage = 0.15;
      else if (data.renewalYear === 3) commissionPercentage = 0.125;
      else commissionPercentage = 0.1;
    }


    const totalCommission = totalContractValue * commissionPercentage;
    
    // For renewals: no initial commission, spread total evenly over contract term
    // For new business: 50% initial, then remainder spread over remaining months
    let initialCommission = 0;
    let monthlyResidual = 0;
    
    if (data.isRenewal) {
      // Renewal: total commission spread evenly over entire contract term
      monthlyResidual = totalCommission / data.contractLength;
    } else {
      // New business: 50% initial, remainder spread over remaining months
      initialCommission = totalMonthlyValue * 0.5;
      const adjustedTotalCommission = data.hasReferral ? totalCommission - 100 : totalCommission;
      const residualAmount = Math.max(0, adjustedTotalCommission - initialCommission);
      monthlyResidual = data.contractLength > 1 ? residualAmount / (data.contractLength - 1) : 0;
    }

    // Apply referral deduction for renewals (affects total commission)
    const finalTotalCommission = data.hasReferral ? totalCommission - 100 : totalCommission;

    return {
      basePrice,
      monthlyRatePerLocation: monthlyRate,
      baseMonthlyValue,
      addOnMonthlyValue,
      totalMonthlyValue,
      totalContractValue,
      commissionPercentage: commissionPercentage * 100,
      totalCommission: finalTotalCommission,
      initialCommission,
      monthlyResidual,
      addOnDetails,
      discountInfo: {
        termDiscount: data.contractLength === 12 ? 10 : 0,
        locationDiscount: data.locations >= 11 ? 15 : data.locations >= 6 ? 10 : data.locations >= 2 ? 5 : 0,
      },
    };
  }, [data]);

  const handlePrint = () => {
    setCustomerDataDialog(true);
  };

  const handleActualPrint = () => {
    setCustomerDataDialog(false);
    setTimeout(() => window.print(), 100);
  };

  const handleEmailReport = async () => {
    if (!emailAddress.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setIsEmailSending(true);
    
    try {
      // Generate HTML content for PDF
      const reportData = {
        email: emailAddress,
        calculationData: {
          customerData,
          spotType: data.spotType,
          locations: data.locations,
          contractLength: data.contractLength,
          isRenewal: data.isRenewal,
          renewalYear: data.renewalYear,
          hasReferral: data.hasReferral,
          addOns: data.addOns,
          calculations: {
            monthlyRatePerLocation: calculations.monthlyRatePerLocation.toFixed(2),
            totalMonthlyValue: calculations.totalMonthlyValue.toFixed(2),
            totalContractValue: calculations.totalContractValue.toFixed(2),
            commissionPercentage: calculations.commissionPercentage.toFixed(1),
            initialCommission: calculations.initialCommission.toFixed(2),
            monthlyResidual: calculations.monthlyResidual.toFixed(2),
            totalCommission: calculations.totalCommission.toFixed(2),
            baseMonthlyRate: calculations.baseMonthlyValue.toFixed(2),
            addOnMonthlyRate: calculations.addOnMonthlyValue.toFixed(2),
          }
        }
      };

      const response = await fetch('https://yprowuaupnwspobugmox.supabase.co/functions/v1/send-commission-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
      });

      if (response.ok) {
        toast({
          title: "Email sent successfully",
          description: `Your commission report has been sent to ${emailAddress}`,
        });
        setEmailDialog(false);
        setEmailAddress("");
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      toast({
        title: "Email failed to send",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsEmailSending(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 print:p-2 print:space-y-2">
      <div className="text-center space-y-6 print:space-y-2 print:mb-2">
        <div className="flex items-center justify-center mb-6 print:mb-2">
          <img 
            src={`${import.meta.env.BASE_URL}lovable-uploads/8d058ccf-cc93-4021-b3ff-6b96d121cd3b.png`}
            alt="Arrows by C-Arrow Marketing Logo"
            className="w-full max-w-2xl h-auto filter invert print:filter-none print:max-w-sm print:h-16"
          />
        </div>
        <div className="flex items-center justify-center gap-2 print:gap-1 print:mb-2">
          <Calculator className="h-8 w-8 text-primary print:h-4 print:w-4 print:text-black" />
          <h1 className="text-3xl font-bold text-foreground print:text-lg print:text-black">Arrows Displays Sales Rep Commission Calculator</h1>
        </div>
        <p className="text-muted-foreground text-lg print:text-sm print:text-gray-600 print:mb-2">
          Calculate your commission earnings for Arrows Displays campaigns
        </p>
        
        {/* Customer Data Section - Visible in print */}
        {(customerData.businessName || customerData.dateProposalSigned || customerData.collectedAmount) && (
          <div className="hidden print:block bg-gray-50 p-4 rounded-lg border mb-6">
            <h2 className="text-xl font-bold text-black mb-4">Customer Information</h2>
            <div className="grid grid-cols-3 gap-4 text-black">
              {customerData.businessName && (
                <div>
                  <h3 className="font-semibold">Business Name:</h3>
                  <p>{customerData.businessName}</p>
                </div>
              )}
              {customerData.dateProposalSigned && (
                <div>
                  <h3 className="font-semibold">Date Proposal Signed:</h3>
                  <p>{customerData.dateProposalSigned}</p>
                </div>
              )}
              {customerData.collectedAmount && (
                <div>
                  <h3 className="font-semibold">Collected Amount:</h3>
                  <p>{customerData.collectedAmount}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons - Hidden in print */}
        <div className="flex justify-center gap-4 print:hidden">
          <Button onClick={handlePrint} variant="outline" className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Print Report
          </Button>
          <Dialog open={emailDialog} onOpenChange={setEmailDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2" onClick={() => setCustomerDataDialog(true)}>
                <Mail className="h-4 w-4" />
                Email Report
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>

        {/* Customer Data Dialog */}
        <Dialog open={customerDataDialog} onOpenChange={setCustomerDataDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Customer Information</DialogTitle>
              <DialogDescription>
                Add customer details to include in your commission report (optional).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="businessName" className="text-right">
                  Business Name
                </Label>
                <Input
                  id="businessName"
                  placeholder="ABC Company Inc."
                  value={customerData.businessName}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, businessName: e.target.value }))}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dateProposalSigned" className="text-right">
                  Date Signed
                </Label>
                <Input
                  id="dateProposalSigned"
                  type="date"
                  value={customerData.dateProposalSigned}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, dateProposalSigned: e.target.value }))}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="collectedAmount" className="text-right">
                  Amount Collected
                </Label>
                <Input
                  id="collectedAmount"
                  placeholder="$5,000.00"
                  value={customerData.collectedAmount}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, collectedAmount: e.target.value }))}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setCustomerDataDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleActualPrint}>
                Print Report
              </Button>
              <Button onClick={() => {
                setCustomerDataDialog(false);
                setEmailDialog(true);
              }}>
                Continue to Email
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Email Dialog */}
        <Dialog open={emailDialog} onOpenChange={setEmailDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Email Commission Report</DialogTitle>
              <DialogDescription>
                Enter your email address to receive a copy of your commission calculation.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@company.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={handleEmailReport} 
                disabled={isEmailSending}
                className="w-full"
              >
                {isEmailSending ? "Sending..." : "Send Report"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 print:grid-cols-1 print:gap-2">
        {/* Input Form */}
        <Card className="shadow-soft print:shadow-none print:border print:border-gray-300 print:compact">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-t-lg print:bg-white print:border-b print:border-gray-300 print:p-2">
            <CardTitle className="flex items-center gap-2 print:text-black print:compact-title">
              <DollarSign className="h-5 w-5 print:text-black print:h-4 print:w-4" />
              Campaign Details
            </CardTitle>
            <CardDescription className="print:text-gray-600 print:text-sm print:hidden">
              Enter the campaign specifications to calculate your commission
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 print:space-y-2 print:pt-2 print:p-2">
            <div className="space-y-2">
              <Label htmlFor="spotType">Spot Duration</Label>
              <Select
                value={data.spotType}
                onValueChange={(value: "10" | "20" | "30") =>
                  setData((prev) => ({ ...prev, spotType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10-Second Spot ($100/month)</SelectItem>
                  <SelectItem value="20">20-Second Spot ($150/month)</SelectItem>
                  <SelectItem value="30">30-Second Spot ($200/month)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="locations">Number of Locations</Label>
              <Input
                id="locations"
                type="number"
                min="1"
                value={data.locations}
                onChange={(e) =>
                  setData((prev) => ({ ...prev, locations: parseInt(e.target.value) || 1 }))
                }
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractLength">Contract Length</Label>
              <Select
                value={data.contractLength.toString()}
                onValueChange={(value: string) =>
                  setData((prev) => ({ ...prev, contractLength: parseInt(value) as 6 | 12 }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 Months</SelectItem>
                  <SelectItem value="12">12 Months (10% discount)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Product Add-Ons</h3>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="peakTime"
                    checked={data.addOns.peakTime.enabled}
                    onCheckedChange={(checked) =>
                      setData((prev) => ({ 
                        ...prev, 
                        addOns: { 
                          ...prev.addOns, 
                          peakTime: { 
                            ...prev.addOns.peakTime, 
                            enabled: !!checked 
                          } 
                        } 
                      }))
                    }
                  />
                  <Label htmlFor="peakTime" className="text-sm">
                    Peak Time Upgrade (+$50/location)
                  </Label>
                </div>

                {data.addOns.peakTime.enabled && (
                  <div className="space-y-2 ml-6">
                    <Label htmlFor="peakTimeLocations">Number of Locations for Peak Time</Label>
                    <Input
                      id="peakTimeLocations"
                      type="number"
                      min="1"
                      value={data.addOns.peakTime.locations}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1;
                        const exceedsLimit = value > data.locations;
                        
                        setValidationErrors(prev => ({ ...prev, peakTime: exceedsLimit }));
                        
                        setData((prev) => ({ 
                          ...prev, 
                          addOns: { 
                            ...prev.addOns, 
                            peakTime: { 
                              ...prev.addOns.peakTime, 
                              locations: Math.min(value, data.locations)
                            } 
                          } 
                        }));
                      }}
                      className={`font-mono ${validationErrors.peakTime ? 'border-muted-foreground' : ''}`}
                    />
                    {validationErrors.peakTime && (
                      <p className="text-xs text-muted-foreground">
                        Cannot exceed {data.locations} location{data.locations !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="screenTakeover"
                    checked={data.addOns.screenTakeover.enabled}
                    onCheckedChange={(checked) =>
                      setData((prev) => ({ 
                        ...prev, 
                        addOns: { 
                          ...prev.addOns, 
                          screenTakeover: { 
                            ...prev.addOns.screenTakeover, 
                            enabled: !!checked 
                          } 
                        } 
                      }))
                    }
                  />
                  <Label htmlFor="screenTakeover" className="text-sm">
                    Screen Takeover (+$50/location)
                  </Label>
                </div>

                {data.addOns.screenTakeover.enabled && (
                  <div className="space-y-2 ml-6">
                    <Label htmlFor="screenTakeoverLocations">Number of Locations for Screen Takeover</Label>
                    <Input
                      id="screenTakeoverLocations"
                      type="number"
                      min="1"
                      value={data.addOns.screenTakeover.locations}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1;
                        const exceedsLimit = value > data.locations;
                        
                        setValidationErrors(prev => ({ ...prev, screenTakeover: exceedsLimit }));
                        
                        setData((prev) => ({ 
                          ...prev, 
                          addOns: { 
                            ...prev.addOns, 
                            screenTakeover: { 
                              ...prev.addOns.screenTakeover, 
                              locations: Math.min(value, data.locations)
                            } 
                          } 
                        }));
                      }}
                      className={`font-mono ${validationErrors.screenTakeover ? 'border-muted-foreground' : ''}`}
                    />
                    {validationErrors.screenTakeover && (
                      <p className="text-xs text-muted-foreground">
                        Cannot exceed {data.locations} location{data.locations !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Commission Adjustments</h3>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasReferral"
                  checked={data.hasReferral}
                  onCheckedChange={(checked) =>
                    setData((prev) => ({ ...prev, hasReferral: !!checked }))
                  }
                />
                <Label htmlFor="hasReferral" className="text-sm">
                  Host Business Employee Referral (-$100 from total commission)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isRenewal"
                  checked={data.isRenewal}
                  onCheckedChange={(checked) =>
                    setData((prev) => ({ ...prev, isRenewal: !!checked }))
                  }
                />
                <Label htmlFor="isRenewal" className="text-sm">
                  This is a renewal contract
                </Label>
              </div>

              {data.isRenewal && (
                <div className="space-y-2 ml-6">
                  <Label htmlFor="renewalYear">Renewal Year</Label>
                  <Select
                    value={data.renewalYear.toString()}
                    onValueChange={(value: string) =>
                      setData((prev) => ({ ...prev, renewalYear: parseInt(value) as 2 | 3 | 4 }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">Year 2 (15%)</SelectItem>
                      <SelectItem value="3">Year 3 (12.5%)</SelectItem>
                      <SelectItem value="4">Year 4+ (10%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-6 print:space-y-2">
          {/* Pricing Breakdown */}
          <Card className="shadow-soft print:shadow-none print:border print:border-gray-300 print:compact">
            <CardHeader className="bg-gradient-to-r from-accent/5 to-accent/10 rounded-t-lg print:bg-white print:border-b print:border-gray-300 print:p-2">
              <CardTitle className="flex items-center gap-2 print:text-black print:compact-title">
                <TrendingUp className="h-5 w-5 print:text-black print:h-4 print:w-4" />
                Pricing Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6 print:space-y-2 print:pt-2 print:p-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Price per Location:</span>
                <span className="font-mono font-semibold">${calculations.basePrice}/month</span>
              </div>
              
              {calculations.discountInfo.termDiscount > 0 && (
                <div className="flex justify-between text-success">
                  <span>Term Discount ({calculations.discountInfo.termDiscount}%):</span>
                  <span className="font-mono">-${(calculations.basePrice * calculations.discountInfo.termDiscount / 100).toFixed(2)}</span>
                </div>
              )}
              
              {calculations.discountInfo.locationDiscount > 0 && (
                <div className="flex justify-between text-success">
                  <span>Multi-Location Discount ({calculations.discountInfo.locationDiscount}%):</span>
                  <Badge variant="secondary">{data.locations} locations</Badge>
                </div>
              )}
              
              <Separator />
              
              <div className="flex justify-between text-lg font-semibold">
                <span>Final Rate per Location:</span>
                <span className="font-mono">${calculations.monthlyRatePerLocation.toFixed(2)}/month</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Monthly Value:</span>
                <span className="font-mono font-semibold">${calculations.baseMonthlyValue.toFixed(2)}</span>
              </div>
              
              {calculations.addOnMonthlyValue > 0 && (
                <>
                  {calculations.addOnDetails.peakTime.enabled && (
                    <div className="flex justify-between text-accent">
                      <span>Peak Time ({calculations.addOnDetails.peakTime.locations} location{calculations.addOnDetails.peakTime.locations !== 1 ? 's' : ''}):</span>
                      <span className="font-mono">+${calculations.addOnDetails.peakTime.monthlyValue.toFixed(2)}</span>
                    </div>
                  )}
                  {calculations.addOnDetails.screenTakeover.enabled && (
                    <div className="flex justify-between text-accent">
                      <span>Screen Takeover ({calculations.addOnDetails.screenTakeover.locations} location{calculations.addOnDetails.screenTakeover.locations !== 1 ? 's' : ''}):</span>
                      <span className="font-mono">+${calculations.addOnDetails.screenTakeover.monthlyValue.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Add-Ons Monthly Value:</span>
                    <span className="font-mono font-semibold">${calculations.addOnMonthlyValue.toFixed(2)}</span>
                  </div>
                </>
              )}
              
              <div className="flex justify-between text-xl font-bold text-primary">
                <span>Total Monthly Value:</span>
                <span className="font-mono">${calculations.totalMonthlyValue.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between text-lg">
                <span>Total Contract Value:</span>
                <span className="font-mono font-semibold">${calculations.totalContractValue.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Commission Results */}
          <Card className="shadow-elegant border-success print:shadow-none print:border print:border-gray-300 print:compact">
            <CardHeader className="bg-gradient-to-r from-success/5 to-success/10 rounded-t-lg print:bg-white print:border-b print:border-gray-300 print:p-2">
              <CardTitle className="flex items-center gap-2 text-foreground print:text-black print:compact-title">
                <Calendar className="h-5 w-5 print:text-black print:h-4 print:w-4" />
                Your Commission Earnings
              </CardTitle>
              <CardDescription className="print:text-gray-600 print:text-sm print:hidden">
                Commission rate: {calculations.commissionPercentage.toFixed(1)}%
                {data.isRenewal && ` (Year ${data.renewalYear === 4 ? '4+' : data.renewalYear} Renewal)`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6 print:space-y-2 print:pt-2 print:p-2">
              {calculations.initialCommission > 0 && (
                <div className="p-4 bg-success/5 rounded-lg border border-success/20">
                  <div className="flex justify-between items-center">
                    <span className="text-success font-semibold">Initial Commission (Paid Month 1):</span>
                    <span className="text-2xl font-bold text-success font-mono">
                      ${calculations.initialCommission.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    50% of first month's value (New business only)
                  </p>
                </div>
              )}

              {calculations.monthlyResidual > 0 && (
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex justify-between items-center">
                    <span className="text-primary font-semibold">
                      {data.isRenewal ? "Monthly Commission:" : "Monthly Residual:"}
                    </span>
                    <span className="text-xl font-bold text-primary font-mono">
                      ${calculations.monthlyResidual.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {data.isRenewal 
                      ? `Paid monthly for ${data.contractLength} months`
                      : `Paid monthly for ${data.contractLength - 1} months after campaign goes live`
                    }
                  </p>
                </div>
              )}

              <Separator />

              <div className="p-4 bg-gradient-to-r from-accent/10 to-accent/5 rounded-lg border border-accent/30">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">
                    Total Campaign Earnings (Year {data.isRenewal ? (data.renewalYear === 4 ? '4+' : data.renewalYear) : 1}):
                  </span>
                  <span className="text-3xl font-bold text-accent font-mono">
                    ${calculations.totalCommission.toFixed(2)}
                  </span>
                </div>
              </div>

              {data.hasReferral && (
                <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
                  <p className="text-sm text-warning-foreground">
                    <strong>Note:</strong> $100 referral bonus has been deducted from your total commission.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Legal Disclaimer */}
      <div className="mt-8 p-4 bg-muted/50 border border-muted rounded-lg print:bg-gray-50 print:border-gray-300 print:p-2 print:mt-2">
        <p className="text-sm text-muted-foreground text-center print:text-gray-600 print:text-sm">
          <strong>DISCLAIMER:</strong> This calculation is for demonstration purposes only and is subject to commission auditing and approvals per your seller agreement.
        </p>
      </div>
    </div>
  );
};

export default CommissionCalculator;