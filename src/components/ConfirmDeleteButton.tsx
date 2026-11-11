import { type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  title: string;
  description: ReactNode;
  onConfirm: () => void;
  disabled?: boolean;
  label?: string;
  testId: string;
}

// An admin's Delete button that asks first, inside the page.
export default function ConfirmDeleteButton({ title, description, onConfirm, disabled, label = "Delete", testId }: Props) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" disabled={disabled} aria-label={label} data-testid={testId}>
          <Trash2 className="w-3.5 h-3.5 mr-1" />{label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid={`${testId}-confirm`}>{label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
