import { useState } from "react";
import { CreditCard, CheckCircle2, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatINR } from "@/lib/geo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  agreedRate: number;
  payerId: string;
  payeeId?: string | null;
  onSuccess?: () => void;
}

export function PaymentDialog({
  open,
  onOpenChange,
  bookingId,
  agreedRate,
  payerId,
  payeeId,
  onSuccess,
}: PaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<"UPI" | "NETBANKING" | "CARD">("UPI");

  const advancePercentage = 80; // 80% advance standard for Indian trucking
  const advanceAmount = Math.round((agreedRate * advancePercentage) / 100);
  const platformFee = Math.round(agreedRate * 0.02);
  const totalPayable = advanceAmount + platformFee;

  async function processAdvancePayment() {
    setLoading(true);
    try {
      const { error } = await supabase.from("payments").insert({
        booking_id: bookingId,
        payer_id: payerId,
        payee_id: payeeId || null,
        amount: totalPayable,
        currency: "INR",
        status: "SUCCESS",
        payment_method: method,
        gateway_payment_id: `pay_${Date.now()}_sim`,
      });

      if (error) throw error;

      toast.success("Advance payment recorded successfully!");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "Payment processing failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="size-5 text-primary" /> Advance Payment
          </DialogTitle>
          <DialogDescription>
            Secure freight advance payment (80% advance to initiate dispatch).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-xl border border-border bg-background p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Agreed Freight:</span>
              <span className="font-medium">{formatINR(agreedRate)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Advance (80%):</span>
              <span className="font-medium">{formatINR(advanceAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Platform Escrow Fee (2%):</span>
              <span className="font-medium">{formatINR(platformFee)}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between font-semibold text-base">
              <span>Total Payable Now:</span>
              <span className="text-primary">{formatINR(totalPayable)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Select Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["UPI", "NETBANKING", "CARD"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                    method === m
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-accent/40 text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/5 p-2.5 rounded-lg border border-primary/20">
            <ShieldCheck className="size-4 text-primary shrink-0" />
            <span>Funds held in secure platform escrow until delivery confirmation.</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={processAdvancePayment} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Confirm & Pay {formatINR(totalPayable)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
