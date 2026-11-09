import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMcqApi } from "@/mcq/lib/api";
import { Button } from "@/components/ui/button";
import { RemoteImage } from "@/components/remote-image";
import { ImageIcon } from "lucide-react";
import type { Course } from "@/academy/lib/academy";

// A course's cover image, stored on the organization's image storage (Cloudinary).
export default function CourseImage({ course }: { course: Course }) {
  const api = useMcqApi();
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const done = () => queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
  const failed = (err: Error) => toast({ title: "Image not saved", description: err.message, variant: "destructive" });
  const upload = useMutation({
    mutationFn: (file: File) => { const form = new FormData(); form.append("image", file); return api.post(`/api/courses/${course._id}/image`, form); },
    onSuccess: () => { done(); toast({ title: "Course image saved" }); },
    onError: failed,
  });
  const remove = useMutation({ mutationFn: () => api.delete(`/api/courses/${course._id}/image`), onSuccess: done, onError: failed });
  const busy = upload.isPending || remove.isPending;

  return (
    <div className="flex items-center gap-3" data-testid="course-image">
      <div className="w-24 h-16 rounded-md border bg-muted overflow-hidden flex items-center justify-center shrink-0">
        <RemoteImage src={course.imageUrl || ""} alt={`${course.title} cover`} className="w-full h-full object-cover" fallback={<ImageIcon className="w-5 h-5 text-muted-foreground" aria-hidden />} />
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} data-testid="input-course-image" />
      <div className="flex gap-1 flex-wrap">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()} data-testid="button-course-image">{upload.isPending ? "Uploading..." : course.imageUrl ? "Replace Image" : "Add Image"}</Button>
        {course.imageUrl && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => remove.mutate()}>Remove</Button>}
      </div>
    </div>
  );
}
