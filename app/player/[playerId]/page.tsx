import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type PlayerEventData = {
  eventId: string;
  eventName: string;
  phases: {
    phaseId: string;
    phaseName: string;
    phaseOrder: number;
    power: number | null;
    allianceRanking: number | null;
    playerRank: number | null;
    furnaceLevel: number | null;
    worldRankPlacement: number | null;
  }[];
};

type PlayerNameHistory = {
  name: string;
  changedAt: Date;
};

async function getPlayerData(playerId: string) {
  // Get player basic info
  const playerResult = await sql`
    SELECT id, current_name FROM players WHERE id = ${playerId}
  `;

  if (playerResult.length === 0) {
    return null;
  }

  const player = playerResult[0];

  // Get player name history
  const nameHistoryResult = await sql`
    SELECT name, changed_at
    FROM player_name_history
    WHERE player_id = ${playerId}
    ORDER BY changed_at DESC
  `;

  const nameHistory: PlayerNameHistory[] = nameHistoryResult.map(
    (row: any) => ({
      name: row.name,
      changedAt: row.changed_at,
    }),
  );

  // Get all events and phases the player participated in
  const eventData = await sql`
  SELECT DISTINCT
    e.id as event_id,
    e.name as event_name,
    e.start_date

FROM events e
JOIN event_phases ep ON e.id = ep.event_id
JOIN daily_player_stats dps ON ep.id = dps.event_phase_id
WHERE dps.player_id =  ${playerId}
   OR dps.player_id IN (
       SELECT alt FROM aliases WHERE main =  ${playerId}
       UNION
       SELECT main FROM aliases WHERE alt =  ${playerId}
   )
ORDER BY e.start_date DESC
  `;

  // For each event, get all phase data
  const playerEventData: PlayerEventData[] = [];

  for (const event of eventData) {
    console.log(`Fetching phases for event: ${event.event_id}`);
    const phases = await sql`
      SELECT
        ep.id as phase_id,
        ep.name as phase_name,
        ep.phase_order,
        dps.power,
        dps.alliance_ranking,
        dps.player_rank,
        dps.furnace_level,
        dps.world_rank_placement
      FROM event_phases ep
      LEFT JOIN daily_player_stats dps ON ep.id = dps.event_phase_id
      AND (dps.player_id = ${playerId}
           OR dps.player_id IN (
               SELECT alt FROM aliases WHERE main =${playerId}
               UNION
               SELECT main FROM aliases WHERE alt = ${playerId}
           ))
      WHERE ep.event_id = ${event.event_id}
      ORDER BY ep.phase_order
    `;

    console.log(`Found ${phases.length} phases for event: ${event.event_id}`);

    playerEventData.push({
      eventId: event.event_id,
      eventName: event.event_name,
      phases: phases.map((phase) => ({
        phaseId: phase.phase_id,
        phaseName: phase.phase_name,
        phaseOrder: phase.phase_order,
        power: phase.power,
        allianceRanking: phase.alliance_ranking,
        playerRank: phase.player_rank,
        furnaceLevel: phase.furnace_level,
        worldRankPlacement: phase.world_rank_placement,
      })),
    });
  }

  return {
    player,
    nameHistory,
    eventData: playerEventData,
  };
}

export default async function PlayerProfilePage({
  params,
}: {
  params: { playerId: string };
}) {
  const id = await params.playerId;
  const data = await getPlayerData(id);

  if (!data) {
    notFound();
  }

  const { player, nameHistory, eventData } = data;

  const calculatePercentage = (current: number, reference: number | null) => {
    if (reference === null || reference === 0) return "";
    const diff = current - reference;
    return `(${((diff / reference) * 100).toFixed(1)}%)`;
  };

  const formatPowerWithChange = (
    currentPower: number | null,
    referencePower: number | null,
  ) => {
    if (currentPower === null) return "N/A";

    const powerStr = currentPower.toLocaleString();
    if (referencePower === null || referencePower === 0) return powerStr;

    const diff = currentPower - referencePower;
    const percentage = calculatePercentage(currentPower, referencePower);
    const changeColor = diff >= 0 ? "text-green-600" : "text-red-600";

    return (
      <span>
        {powerStr} <span className={changeColor}>{percentage}</span>
      </span>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">{player.current_name} Profile</h1>
      </div>

      {/* Name History */}
      {nameHistory.length > 1 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Name History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {nameHistory.map((name, index) => (
                <Badge
                  key={index}
                  variant={index === 0 ? "default" : "secondary"}
                >
                  {name.name} {index === 0 && "(Current)"}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event Participation Table */}
      <Card>
        <CardHeader>
          <CardTitle>Event Participation</CardTitle>
        </CardHeader>
        <CardContent>
          {eventData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Event</TableHead>
                    <TableHead>Prep Day</TableHead>
                    <TableHead>Day 1</TableHead>
                    <TableHead>Day 2</TableHead>
                    <TableHead>Day 3</TableHead>
                    <TableHead>Day 4</TableHead>
                    <TableHead>Day 5</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventData.map((event) => {
                    // Create a map for easy phase lookup
                    const phaseMap = new Map(
                      event.phases.map((phase) => [phase.phaseOrder, phase]),
                    );

                    // Get prep day power for percentage calculations
                    const prepDayPower = phaseMap.get(0)?.power || null;

                    return (
                      <TableRow key={event.eventId}>
                        <TableCell className="font-medium">
                          {event.eventName}
                        </TableCell>
                        {[0, 1, 2, 3, 4, 5].map((phaseOrder) => {
                          const phase = phaseMap.get(phaseOrder);
                          const power = phase?.power || null;

                          // For prep day, show just power. For other days, show power with % change from prep
                          const displayPower =
                            phaseOrder === 0
                              ? power
                                ? Intl.NumberFormat().format(power)
                                : "N/A"
                              : formatPowerWithChange(power, prepDayPower);

                          return (
                            <TableCell key={phaseOrder}>
                              <div className="text-sm">
                                {displayPower}
                                {phase?.worldRankPlacement && (
                                  <div className="mt-1">
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      #{phase.worldRankPlacement}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No event data found for this player.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Detailed Stats for Latest Event */}
      {eventData.map((event) => (
        <Card className="mt-6" key={event.eventId}>
          <CardHeader>
            <CardTitle>{event.eventName}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phase</TableHead>
                    <TableHead>Power</TableHead>
                    <TableHead>Alliance Rank</TableHead>
                    <TableHead>Player Rank</TableHead>
                    <TableHead>Furnace Level</TableHead>
                    <TableHead>World Rank</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {event.phases.map((phase) => (
                    <TableRow key={phase.phaseId}>
                      <TableCell className="font-medium">
                        {phase.phaseName}
                      </TableCell>
                      <TableCell>
                        {phase.power
                          ? Intl.NumberFormat().format(phase.power)
                          : "N/A"}
                      </TableCell>
                      <TableCell>{phase.allianceRanking || "N/A"}</TableCell>
                      <TableCell>{phase.playerRank || "N/A"}</TableCell>
                      <TableCell>{phase.furnaceLevel || "N/A"}</TableCell>
                      <TableCell>
                        {phase.worldRankPlacement ? (
                          <Badge variant="secondary">
                            #{phase.worldRankPlacement}
                          </Badge>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
