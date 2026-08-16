import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Package, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TruckLoad AI return-load platform" },
      {
        name: "description",
        content:
          "Sign in or create a TruckLoad AI account as a truck driver, shipper or operations admin to find return loads.",
      },
      { property: "og:title", content: "Sign in — TruckLoad AI" },
      {
        property: "og:description",
        content: "Access return-load matching for drivers, shippers and operations teams.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("DRIVER");

  useEffect(() => {
    void supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.session.user.id)
          .maybeSingle();
        const userRole = (profile as any)?.role || "DRIVER";
        if (userRole === "SHIPPER") navigate({ to: "/shipper", replace: true });
        else if (userRole === "ADMIN") navigate({ to: "/admin", replace: true });
        else navigate({ to: "/driver", replace: true });
      }
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message || "Could not sign in. Please check your email and password.");
      return;
    }
    toast.success("Signed in successfully");
    
    // Check role to route properly
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    const userRole = (profile as any)?.role || "DRIVER";
    if (userRole === "SHIPPER") navigate({ to: "/shipper", replace: true });
    else if (userRole === "ADMIN") navigate({ to: "/admin", replace: true });
    else navigate({ to: "/driver", replace: true });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          name,
          phone,
          role,
          company_name: role === "SHIPPER" ? companyName : undefined,
          language: "hinglish",
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.includes("already")
          ? "This email is already registered. Please sign in."
          : error.message || "Something went wrong. Please try again.",
      );
      return;
    }
    if (data.session) {
      toast.success("Account created successfully!");
      if (role === "SHIPPER") navigate({ to: "/shipper", replace: true });
      else if (role === "ADMIN") navigate({ to: "/admin", replace: true });
      else navigate({ to: "/driver", replace: true });
    } else {
      toast.success("Check your email to confirm your account.");
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setResetting(false);
    if (error) {
      toast.error(error.message || "Failed to send password reset email.");
    } else {
      toast.success("Password reset link sent to your email!");
      setShowForgot(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Package className="size-4" />
          </span>
          TruckLoad <span className="text-primary">AI</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {showForgot ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <h2 className="text-lg font-semibold">Reset your password</h2>
              <p className="text-xs text-muted-foreground">
                Enter your registered email and we will send you a reset link.
              </p>
              <Field id="fp-email" label="Email" type="email" value={email} onChange={setEmail} />
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-1/2"
                  onClick={() => setShowForgot(false)}
                >
                  Back to Sign In
                </Button>
                <Button type="submit" className="w-1/2" disabled={resetting}>
                  {resetting ? <Loader2 className="size-4 animate-spin" /> : "Send link"}
                </Button>
              </div>
            </form>
          ) : (
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={signIn} className="mt-4 space-y-4">
                  <Field id="si-email" label="Email" type="email" value={email} onChange={setEmail} />
                  <Field
                    id="si-password"
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : null} Sign in
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={signUp} className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">I am a</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger id="role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRIVER">Driver / Truck owner</SelectItem>
                        <SelectItem value="SHIPPER">Shipper / Business</SelectItem>
                        <SelectItem value="ADMIN">Operations / Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Field id="su-name" label="Full name" value={name} onChange={setName} />
                  {role === "SHIPPER" && (
                    <Field
                      id="su-company"
                      label="Company / Business Name"
                      value={companyName}
                      onChange={setCompanyName}
                      required={true}
                    />
                  )}
                  <Field id="su-phone" label="Phone" value={phone} onChange={setPhone} required={false} />
                  <Field id="su-email" label="Email" type="email" value={email} onChange={setEmail} />
                  <Field
                    id="su-password"
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                  />
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : null} Create account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Demo mode data (Jabalpur pilot corridor) is visible to every account so you can walk the
          full return-load journey without a real truck.
        </p>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        required={required}
        autoComplete={type === "password" ? "current-password" : "on"}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
