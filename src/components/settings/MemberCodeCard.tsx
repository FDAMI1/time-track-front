import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hash } from "lucide-react";

interface Settings { memberCodePrefix: string; memberCodeDigits: number }
const KEY = ["/api/policy/org-settings"];

// New members get the next User ID after this prefix, e.g. STU-0001. Existing IDs never change.
export default function MemberCodeCard() {
  const api = useMcqApi();
  const { toast } = useToast();
  const { data } = useQuery({ queryKey: KEY, queryFn: () => api.get<Settings>("/api/policy/org-settings") });
  const [prefix, setPrefix] = useState("");
  const [digits, setDigits] = useState(4);
  useEffect(() => {
    if (data) { setPrefix(data.memberCodePrefix ?? "ID-"); setDigits(data.memberCodeDigits || 4); }
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put<Settings>("/api/policy/org-settings", { memberCodePrefix: prefix, memberCodeDigits: digits }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
      toast({ title: "User ID format saved", description: "It applies to members added from now on." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const clean = prefix.trim().toUpperCase();
  const valid = /^[A-Z0-9][A-Z0-9/_-]{0,11}$/.test(clean) && digits >= 1 && digits <= 8;
  const dirty = !!data && (clean !== data.memberCodePrefix || digits !== data.memberCodeDigits);

  return (
    <Card data-testid="card-member-codes">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Hash className="w-5 h-5" />User IDs</CardTitle>
        <CardDescription>Every new member gets the next number automatically. Existing User IDs never change.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
          <div>
            <Label htmlFor="member-code-prefix">Prefix</Label>
            <Input id="member-code-prefix" value={prefix} maxLength={12} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="STU-" data-testid="input-member-code-prefix" aria-invalid={!valid} />
          </div>
          <div>
            <Label htmlFor="member-code-digits">Digits</Label>
            <Input id="member-code-digits" type="number" min={1} max={8} value={digits} onChange={(e) => setDigits(Number(e.target.value))} data-testid="input-member-code-digits" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground" data-testid="text-member-code-example">
          {valid ? <>Next IDs look like <span className="font-mono text-foreground">{clean}{"1".padStart(digits, "0")}</span></> : "Use 1-12 letters, digits, - / or _ (starting with a letter or digit) and 1-8 digits."}
        </p>
        <Button size="sm" disabled={!valid || !dirty || save.isPending} onClick={() => save.mutate()} data-testid="button-save-member-codes">{save.isPending ? "Saving..." : "Save"}</Button>
      </CardContent>
    </Card>
  );
}
