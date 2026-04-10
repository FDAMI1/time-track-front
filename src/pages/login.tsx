import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Eye, EyeOff } from "lucide-react";

function getSavedBranding() {
  try { return JSON.parse(localStorage.getItem("app_theme") || "{}"); } catch { return {}; }
}

export default function LoginPage() {
  const { login } = useAuth();
  const [credential, setCredential] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const branding = getSavedBranding();
  const appName = branding.appName || "";
  const logoType = branding.logoType || "text";
  const logoText = branding.logoText || "";
  const logoUrl = branding.logoUrl || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!credential.trim()) {
      setError("Please enter a username or email");
      return;
    }
    setIsLoading(true);
    try {
      const isEmail = credential.includes("@");
      await login(credential.trim(), password, isEmail);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            {logoType === "image" && logoUrl
              ? <img src={logoUrl} alt="Logo" className="h-16 w-auto object-contain bg-transparent" style={{ background: "transparent" }} />
              : logoText
                ? <span className="text-2xl font-bold text-primary">{logoText}</span>
                : <Shield className="w-8 h-8 text-primary" />
            }
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{appName}</h1>
          <p className="text-muted-foreground mt-1">Academic & Workforce Management Platform</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>Enter your credentials to access the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md" data-testid="text-login-error">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="credential">Username or E-mail</Label>
                <Input
                  id="credential"
                  data-testid="input-credential"
                  placeholder="Enter your username or email"
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    data-testid="input-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
