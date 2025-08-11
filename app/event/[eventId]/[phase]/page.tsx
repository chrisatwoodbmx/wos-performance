import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/auth/actions";
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
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { UploadModal } from "@/components/upload-modal";
import { Suspense } from "react";

type DailyStat = {
  id: string;
  playerId: string;
  playerName: string;
  allianceId: string | null;
  allianceName: string | null;
  allianceTag: string | null;
  allianceRanking: number | null;
  power: number;
  playerRank: number | null;
  furnaceLevel: number | null;
  worldRankPlacement: number | null;
  points: number | null;
  recordedAt: Date;
  previousDayPower: number | null;
  prepDayPower: number | null;
};

async function getPhaseData(
  eventId: string,
  phaseName: string,
): Promise<{
  stats: DailyStat[];
  eventName: string;
  phaseName: string;
  phaseId: string;
  alliances: any[];
} | null> {
  const eventResult = await sql`SELECT name FROM events WHERE id = ${eventId}`;
  if (eventResult.length === 0) return null;
  const eventName = eventResult[0].name;

  const phaseResult = await sql`
    SELECT id, name, phase_order
    FROM event_phases
    WHERE event_id = ${eventId} AND LOWER(REGEXP_REPLACE(name, '\\s+', '-', 'g')) = ${phaseName.toLowerCase()}
  `;

  let phase: any;
  if (phaseResult.length === 0) {
    const fallbackResult = await sql`
      SELECT id, name, phase_order
      FROM event_phases
      WHERE event_id = ${eventId} AND LOWER(REPLACE(name, ' ', '-')) = ${phaseName.toLowerCase()}
    `;
    if (fallbackResult.length === 0) return null;
    phase = fallbackResult[0];
  } else {
    phase = phaseResult[0];
  }

  const phases = await sql`
    SELECT id, name, phase_order FROM event_phases WHERE event_id = ${eventId} ORDER BY phase_order
  `;

  const allStats = await sql`
    SELECT DISTINCT
      COALESCE(a1.main, a2.main, p.id) as player_id,
      p.current_name,
      dps.power,
      ep.phase_order,
      ep.name
    FROM daily_player_stats dps
    JOIN players p ON dps.player_id = p.id
    JOIN event_phases ep ON dps.event_phase_id = ep.id
    LEFT JOIN aliases a1 ON p.id = a1.alt
    LEFT JOIN aliases a2 ON p.id = a2.main
    LEFT JOIN player_name_history pnh ON p.id = pnh.player_id
    WHERE ep.event_id = ${eventId}
    ORDER BY p.current_name, ep.phase_order
  `;

  const mappedAllStats = allStats.map((stat) => ({
    playerId: stat.player_id,
    playerName: stat.current_name,
    power: stat.power,
    phaseOrder: stat.phase_order,
    phaseName: stat.name,
  }));

  const playerPowerMap = new Map<string, Map<number, number>>();
  for (const stat of mappedAllStats) {
    if (!playerPowerMap.has(stat.playerName)) {
      playerPowerMap.set(stat.playerName, new Map());
    }
    playerPowerMap.get(stat.playerName)?.set(stat.phaseOrder, stat.power);
  }

  const currentPhaseStats = await sql`
    SELECT DISTINCT
      dps.id,
      COALESCE(a1.main, a2.main, p.id) as player_id,
      p.current_name,
      p.alliance_id,
      a.name as alliance_name,
      a.tag as alliance_tag,
      dps.alliance_ranking,
      dps.power,
      dps.player_rank,
      dps.furnace_level,
      dps.world_rank_placement,
      dps.points,
      dps.recorded_at
    FROM daily_player_stats dps
    JOIN players p ON dps.player_id = p.id
    LEFT JOIN alliances a ON p.alliance_id = a.id
    LEFT JOIN aliases a1 ON p.id = a1.alt
    LEFT JOIN aliases a2 ON p.id = a2.main
    LEFT JOIN player_name_history pnh ON p.id = pnh.player_id
    WHERE dps.event_phase_id = ${phase.id}
    ORDER BY dps.power DESC
  `;

  const mappedCurrentPhaseStats = currentPhaseStats.map((stat) => ({
    id: stat.id,
    playerId: stat.player_id,
    playerName: stat.current_name,
    allianceId: stat.alliance_id,
    allianceName: stat.alliance_name,
    allianceTag: stat.alliance_tag,
    allianceRanking: stat.alliance_ranking,
    power: stat.power,
    playerRank: stat.player_rank,
    furnaceLevel: stat.furnace_level,
    worldRankPlacement: stat.world_rank_placement,
    points: stat.points,
    recordedAt: stat.recorded_at,
  }));

  const statsWithDeltas = mappedCurrentPhaseStats.map((stat) => {
    const playerPowers = playerPowerMap.get(stat.playerName);
    let previousDayPower: number | null = null;
    let prepDayPower: number | null = null;

    if (playerPowers) {
      const prevPhaseOrder = phase.phase_order - 1;
      if (prevPhaseOrder >= 0) {
        previousDayPower = playerPowers.get(prevPhaseOrder) || null;
      }
      prepDayPower = playerPowers.get(0) || null;
    }

    return {
      ...stat,
      previousDayPower,
      prepDayPower,
    };
  });

  const alliancesResult = await sql`
    SELECT a.id, a.name, a.tag
    FROM alliances a
    JOIN event_alliances ea ON a.id = ea.alliance_id
    WHERE ea.event_id = ${eventId}
  `;

  const alliances =
    alliancesResult.length > 0
      ? alliancesResult
      : await sql`SELECT id, name, tag FROM alliances`;

  return {
    stats: statsWithDeltas,
    eventName,
    phaseName: phase.name,
    phaseId: phase.id,
    alliances: alliances.map((a) => ({ id: a.id, name: a.name, tag: a.tag })),
  };
}

export default async function PhaseDetailPage({
  params,
}: {
  params: { eventId: string; phase: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const phaseData = await getPhaseData(params.eventId, params.phase);

  if (!phaseData) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Phase Not Found</h3>
              <p className="text-muted-foreground">
                The requested phase could not be found.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { stats, eventName, phaseName, phaseId, alliances } = phaseData;

  const calculatePercentage = (current: number, reference: number | null) => {
    if (reference === null || reference === 0) return "N/A";
    const diff = current - reference;
    return `${((diff / reference) * 100).toFixed(2)}%`;
  };
  const totalPower = stats.reduce((sum, s) => sum + parseInt(s.power, 10), 0);
  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/event/${params.eventId}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {eventName}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {eventName} - {phaseName}
          </h1>
          <p className="text-muted-foreground mt-1">
            {stats.length} players tracked in this phase
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Power</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Intl.NumberFormat().format(totalPower)}
              </div>
              <p className="text-xs text-muted-foreground">
                Sum of all player power
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Average Power
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.length > 0
                  ? Intl.NumberFormat().format(totalPower / stats.length)
                  : "0"}
              </div>
              <p className="text-xs text-muted-foreground">
                Average player power in this phase
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Players Tracked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.length}</div>
              <p className="text-xs text-muted-foreground">
                Total players with data in this phase
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              Daily Player Stats
              <div className="flex flex-wrap gap-2">
                <Suspense fallback={<div>Loading Upload...</div>}>
                  <UploadModal
                    eventId={params.eventId}
                    phaseId={phaseId}
                    alliances={alliances}
                  />
                </Suspense>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player Name</TableHead>
                  <TableHead>Alliance</TableHead>
                  <TableHead>Alliance Ranking</TableHead>
                  <TableHead>Power</TableHead>
                  <TableHead>Power Change (Day-over-Day)</TableHead>
                  <TableHead>Power Change (from Prep)</TableHead>
                  <TableHead>Player Rank</TableHead>
                  <TableHead>Furnace Level</TableHead>
                  <TableHead>World Ranking</TableHead>
                  <TableHead>Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.length > 0 ? (
                  stats.map((stat) => (
                    <TableRow key={stat.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/player/${stat.playerId}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {stat.playerName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {stat.allianceName ? (
                          <Badge variant="outline">
                            {stat.allianceTag || stat.allianceName}
                          </Badge>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                      <TableCell>{stat.allianceRanking || "N/A"}</TableCell>
                      <TableCell>
                        {Intl.NumberFormat().format(stat.power)}
                      </TableCell>
                      <TableCell>
                        {stat.previousDayPower !== null ? (
                          <>
                            <span
                              className={
                                stat.power >= stat.previousDayPower
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {Intl.NumberFormat().format(
                                stat.power - stat.previousDayPower,
                              )}
                            </span>{" "}
                            (
                            {calculatePercentage(
                              stat.power,
                              stat.previousDayPower,
                            )}
                            )
                          </>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                      <TableCell>
                        {stat.prepDayPower !== null ? (
                          <>
                            <span
                              className={
                                stat.power >= stat.prepDayPower
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {Intl.NumberFormat().format(
                                stat.power - stat.prepDayPower,
                              )}
                            </span>{" "}
                            (
                            {calculatePercentage(stat.power, stat.prepDayPower)}
                            )
                          </>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                      <TableCell>{stat.playerRank || "N/A"}</TableCell>
                      <TableCell>{stat.furnaceLevel || "N/A"}</TableCell>
                      <TableCell>
                        {stat.worldRankPlacement ? (
                          <Badge variant="secondary">
                            #{stat.worldRankPlacement}
                          </Badge>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                      <TableCell>
                        {stat.points
                          ? Intl.NumberFormat().format(stat.points)
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">
                      No data for this phase. Upload a CSV to get started!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
