import { useState } from "react";
import { Star, MessageSquare, Loader2, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  fromUserId: string;
  toUserId: string;
  targetRole: "DRIVER" | "SHIPPER";
  onSuccess?: () => void;
}

export function RatingDialog({
  open,
  onOpenChange,
  bookingId,
  fromUserId,
  toUserId,
  targetRole,
  onSuccess,
}: RatingDialogProps) {
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [hovered, setHovered] = useState(0);

  async function handleSubmitRating() {
    if (!score) {
      toast.error("Please select a star rating");
      return;
    }
    setLoading(true);
    try {
      // 1. Insert into ratings table
      const { error: ratingError } = await supabase.from("ratings").insert({
        booking_id: bookingId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        score,
        comment: comment.trim() || null,
      });

      if (ratingError) throw ratingError;

      // 2. Fetch existing ratings to calculate new average trust score
      const { data: allRatings } = await supabase
        .from("ratings")
        .select("score")
        .eq("to_user_id", toUserId);

      if (allRatings && allRatings.length > 0) {
        const total = allRatings.reduce((acc, r) => acc + (r.score || 5), 0);
        const avg = Math.round((total / allRatings.length) * 10) / 10;

        if (targetRole === "DRIVER") {
          await supabase.from("drivers").update({ trust_score: avg }).eq("user_id", toUserId);
        } else {
          await supabase.from("shippers").update({ trust_score: avg }).eq("user_id", toUserId);
        }
      }

      toast.success("Thank you! Rating and feedback submitted.");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit rating.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="size-5 text-primary" /> Rate your experience
          </DialogTitle>
          <DialogDescription>
            Help build a transparent logistics network by sharing honest feedback for this {targetRole.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-background space-y-2">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setScore(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  className="p-1 text-2xl transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={`size-7 ${
                      (hovered || score) >= star
                        ? "text-amber-400 fill-amber-400"
                        : "text-muted-foreground/40"
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-xs font-semibold text-muted-foreground">
              {score === 5 && "⭐ Excellent Experience"}
              {score === 4 && "👍 Good & Reliable"}
              {score === 3 && "👌 Satisfactory"}
              {score === 2 && "⚠️ Needs Improvement"}
              {score === 1 && "❌ Poor Service"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-comment" className="flex items-center gap-1.5 text-xs font-medium">
              <MessageSquare className="size-3.5" /> Comments / Feedback
            </Label>
            <Textarea
              id="feedback-comment"
              placeholder="e.g. On-time delivery, smooth communication, prompt unloading..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Skip
          </Button>
          <Button onClick={handleSubmitRating} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Submit Rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
