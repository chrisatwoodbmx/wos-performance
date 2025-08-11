"use client";

import type React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload } from "lucide-react";
import {
  uploadCombinedCsvAction,
  uploadWorldRankingCsvAction,
} from "@/app/actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Alliance {
  id: string;
  name: string;
  tag: string;
}

interface UploadModalProps {
  eventId: string;
  phaseId: string;
  alliances: Alliance[];
}

export function UploadModal({ eventId, phaseId, alliances }: UploadModalProps) {
  const [open, setOpen] = useState(false);
  const [playerFile, setPlayerFile] = useState<File | null>(null);
  const [worldFile, setWorldFile] = useState<File | null>(null);
  const [selectedAlliance, setSelectedAlliance] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  const handlePlayerDataSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerFile || !selectedAlliance) {
      toast.error("Please select a file and alliance");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", playerFile);
    formData.append("eventId", eventId);
    formData.append("phaseId", phaseId);
    formData.append("allianceId", selectedAlliance);

    try {
      const result = await uploadCombinedCsvAction(formData);

      if (result.success) {
        toast.success(result.message);
        setPlayerFile(null);
        setSelectedAlliance("");
        router.refresh();
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleWorldRankingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!worldFile) {
      toast.error("Please select a file");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", worldFile);
    formData.append("eventId", eventId);
    formData.append("phaseId", phaseId);

    try {
      const result = await uploadWorldRankingCsvAction(formData);

      if (result.success) {
        toast.success(result.message);
        setWorldFile(null);
        router.refresh();
        setOpen(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload Data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Player Data</DialogTitle>
          <DialogDescription>
            Choose the type of data you want to upload for this phase.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="player-data" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="player-data">Player Data</TabsTrigger>
            <TabsTrigger value="world-ranking">World Ranking</TabsTrigger>
          </TabsList>

          <TabsContent value="player-data">
            <Card>
              <CardHeader>
                <CardTitle>Player Data Upload</CardTitle>
                <CardDescription>
                  Upload CSV with player name, power, and alliance ranking.
                  <br />
                  Format: <code>playerName,power,allianceRanking</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePlayerDataSubmit} className="space-y-4">
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
                    <Label htmlFor="player-file">CSV File</Label>
                    <Input
                      id="player-file"
                      type="file"
                      accept=".csv"
                      onChange={(e) =>
                        setPlayerFile(e.target.files?.[0] || null)
                      }
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isUploading || !playerFile || !selectedAlliance}
                  >
                    {isUploading ? "Uploading..." : "Upload Player Data"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="world-ranking">
            <Card>
              <CardHeader>
                <CardTitle>World Ranking Upload</CardTitle>
                <CardDescription>
                  Upload CSV with player name, world rank, points, and alliance.
                  <br />
                  Format: <code>playerName,worldRank,points,alliance</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleWorldRankingSubmit} className="space-y-4">
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
                    <Label htmlFor="world-file">CSV File</Label>
                    <Input
                      id="world-file"
                      type="file"
                      accept=".csv"
                      onChange={(e) =>
                        setWorldFile(e.target.files?.[0] || null)
                      }
                    />
                  </div>

                  <Button type="submit" disabled={isUploading || !worldFile}>
                    {isUploading ? "Uploading..." : "Upload World Ranking"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
