"use client";

import type React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadCombinedCsvAction } from "@/app/actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Alliance {
  id: string;
  name: string;
  tag: string;
}

interface CombinedCsvUploadProps {
  eventId: string;
  phaseId: string;
  alliances: Alliance[];
}

export function CombinedCsvUploadForm({
  eventId,
  phaseId,
  alliances,
}: CombinedCsvUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [selectedAlliance, setSelectedAlliance] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedAlliance) {
      toast.error("Please select a file and alliance");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("eventId", eventId);
    formData.append("phaseId", phaseId);
    formData.append("allianceId", selectedAlliance);

    try {
      const result = await uploadCombinedCsvAction(formData);

      if (result.success) {
        toast.success(result.message);
        setFile(null);
        setSelectedAlliance("");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Player Data</CardTitle>
        <CardDescription>
          Upload CSV with player name, power, and alliance ranking. Format:
          playerName,power,allianceRanking
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="alliance">Alliance</Label>
            <Select
              value={selectedAlliance}
              onValueChange={setSelectedAlliance}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select alliance" />
              </SelectTrigger>
              <SelectContent>
                {alliances.map((alliance) => (
                  <SelectItem key={alliance.id} value={alliance.id}>
                    {alliance.name} ({alliance.tag})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="file">CSV File</Label>
            <Input
              id="file"
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <Button
            type="submit"
            disabled={isUploading || !file || !selectedAlliance}
          >
            {isUploading ? "Uploading..." : "Upload CSV"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
