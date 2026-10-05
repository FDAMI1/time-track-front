import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { downloadFile } from "./api";

// Tracks which report is currently downloading so buttons can disable themselves.
export function useDownload() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = async (url: string, key: string) => {
    setDownloading(key);
    try {
      await downloadFile(url, token);
      toast({ title: "Report downloaded successfully" });
    } catch (err) {
      toast({ title: "Download failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  return { downloading, download };
}
