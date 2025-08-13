import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calculator, DollarSign, TrendingUp, Calendar } from "lucide-react";

interface CommissionData {
  spotType: "10" | "20" | "30";
  locations: number;
  contractLength: 6 | 12;
  hasReferral: boolean;
  isRenewal: boolean;
  renewalYear: 2 | 3 | 4;
  isProbationary: boolean;
}

const SPOT_PRICES = {
  "10": 100,
  "20": 150,
  "30": 200,
};

const CommissionCalculator = () => {
  const [data, setData] = useState<CommissionData>({
    spotType: "20",
    locations: 1,
    contractLength: 12,
    hasReferral: false,
    isRenewal: false,
    renewalYear: 2,
    isProbationary: false,
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

    const totalMonthlyValue = monthlyRate * data.locations;
    const totalContractValue = totalMonthlyValue * data.contractLength;

    // Calculate commission percentages based on renewal year
    let commissionPercentage = 0.15; // 15% for new business (Year 1)
    if (data.isRenewal) {
      if (data.renewalYear === 2) commissionPercentage = 0.15;
      else if (data.renewalYear === 3) commissionPercentage = 0.125;
      else commissionPercentage = 0.1;
    }

    // Apply probationary rates (50% reduction)
    if (data.isProbationary) {
      commissionPercentage *= 0.5;
    }

    const totalCommission = totalContractValue * commissionPercentage;
    const initialCommission = totalMonthlyValue * 0.5; // 50% of first month

    // Subtract referral bonus from total commission (affects residuals only)
    const adjustedTotalCommission = data.hasReferral ? totalCommission - 100 : totalCommission;
    const residualAmount = Math.max(0, adjustedTotalCommission - initialCommission);
    const monthlyResidual = data.contractLength > 1 ? residualAmount / (data.contractLength - 1) : 0;

    return {
      basePrice,
      monthlyRatePerLocation: monthlyRate,
      totalMonthlyValue,
      totalContractValue,
      commissionPercentage: commissionPercentage * 100,
      totalCommission: adjustedTotalCommission,
      initialCommission,
      residualAmount,
      monthlyResidual,
      discountInfo: {
        termDiscount: data.contractLength === 12 ? 10 : 0,
        locationDiscount: data.locations >= 11 ? 15 : data.locations >= 6 ? 10 : data.locations >= 2 ? 5 : 0,
      },
    };
  }, [data]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Calculator className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Commission Calculator</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Calculate your commission earnings for Arrows Displays campaigns
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card className="shadow-soft">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Campaign Details
            </CardTitle>
            <CardDescription>
              Enter the campaign specifications to calculate your commission
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
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
              <h3 className="font-semibold text-foreground">Additional Options</h3>
              
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

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isProbationary"
                  checked={data.isProbationary}
                  onCheckedChange={(checked) =>
                    setData((prev) => ({ ...prev, isProbationary: !!checked }))
                  }
                />
                <Label htmlFor="isProbationary" className="text-sm">
                  Probationary rates (50% reduction)
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-6">
          {/* Pricing Breakdown */}
          <Card className="shadow-soft">
            <CardHeader className="bg-gradient-to-r from-accent/5 to-accent/10 rounded-t-lg">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Pricing Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
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
          <Card className="shadow-elegant border-success">
            <CardHeader className="bg-gradient-to-r from-success/5 to-success/10 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-success">
                <Calendar className="h-5 w-5" />
                Your Commission Earnings
              </CardTitle>
              <CardDescription>
                Commission rate: {calculations.commissionPercentage.toFixed(1)}%
                {data.isProbationary && " (Probationary)"}
                {data.isRenewal && ` (Year ${data.renewalYear} Renewal)`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="p-4 bg-success/5 rounded-lg border border-success/20">
                <div className="flex justify-between items-center">
                  <span className="text-success font-semibold">Initial Commission (Paid Month 1):</span>
                  <span className="text-2xl font-bold text-success font-mono">
                    ${calculations.initialCommission.toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  50% of first month's value
                </p>
              </div>

              {calculations.monthlyResidual > 0 && (
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex justify-between items-center">
                    <span className="text-primary font-semibold">Monthly Residual:</span>
                    <span className="text-xl font-bold text-primary font-mono">
                      ${calculations.monthlyResidual.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Paid monthly for {data.contractLength - 1} months after campaign goes live
                  </p>
                </div>
              )}

              <Separator />

              <div className="p-4 bg-gradient-to-r from-accent/10 to-accent/5 rounded-lg border border-accent/30">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total Year 1 Earnings:</span>
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
    </div>
  );
};

export default CommissionCalculator;