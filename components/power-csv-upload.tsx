"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useActionState, useEffect } from "react";
import { uploadPowerCsvAction } from "@/app/actions";
import { useRouter } from "next/navigation";

export function PowerCsvUploadForm({
  eventId,
  phaseId,
}: {
  eventId: string;
  phaseId: string;
}) {
  const router = useRouter();
  const [state, action, isPending] = useActionState(uploadPowerCsvAction, {
    success: false,
    message: "",
  });

  useEffect(() => {
    if (state?.success && state.message) {
      toast.success(state.message);
      router.refresh(); // Refresh the page to show updated data
    } else if (state?.message && !state.success) {
      toast.error(state.message);
    }
  }, [state?.success, state?.message, router]);

  return (
    <form action={action} className="flex items-center gap-2">
      <Input
        type="file"
        name="csvFile"
        accept=".csv"
        required
        className="max-w-xs"
        disabled={isPending}
      />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="phaseId" value={phaseId} />
      <Button type="submit" size="sm" disabled={isPending}>
        <Upload className="mr-2 h-4 w-4" />
        {isPending ? "Uploading Power..." : "Upload Power CSV"}
      </Button>
    </form>
  );
}
