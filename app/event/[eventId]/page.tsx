import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/auth/actions";
import { sql } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type EventPhase = {
  id: string;
  name: string;
  phaseOrder: number;
  playerCount: number;
  totalPower: number;
};

type EventDetails = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date | null;
  phases: EventPhase[];
};

async function getEventDetails(eventId: string): Promise<EventDetails | null> {
  const eventResult = await sql`
    SELECT id, name, start_date, end_date
    FROM events
    WHERE id = ${eventId}
  `;

  if (eventResult.length === 0) {
    return null;
  }

  const event = eventResult[0];

  const phases = await sql`
    SELECT
      ep.id,
      ep.name,
      ep.phase_order,
      COUNT(DISTINCT dps.player_id) as player_count,
      COALESCE(SUM(dps.power), 0) as total_power
    FROM event_phases ep
    LEFT JOIN daily_player_stats dps ON ep.id = dps.event_phase_id
    WHERE ep.event_id = ${eventId}
    GROUP BY ep.id, ep.name, ep.phase_order
    ORDER BY ep.phase_order
  `;

  return {
    id: event.id,
    name: event.name,
    startDate: event.start_date,
    endDate: event.end_date,
    phases: phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      phaseOrder: phase.phase_order,
      playerCount: Number.parseInt(phase.player_count) || 0,
      totalPower: Number.parseInt(phase.total_power) || 0,
    })),
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: { eventId: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const eventDetails = await getEventDetails(params.eventId);

  if (!eventDetails) {
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
              <h3 className="text-lg font-semibold mb-2">Event Not Found</h3>
              <p className="text-muted-foreground">
                The requested event could not be found.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">{eventDetails.name}</h1>
          <p className="text-muted-foreground mt-1">
            Started: {new Date(eventDetails.startDate).toLocaleDateString()}
            {eventDetails.endDate && (
              <>
                {" "}
                • Ended: {new Date(eventDetails.endDate).toLocaleDateString()}
              </>
            )}
          </p>
        </div>
        <Badge variant="outline">{eventDetails.phases.length} Phases</Badge>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Event Phases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {eventDetails.phases.map((phase) => (
                <Link
                  key={phase.id}
                  href={`/event/${eventDetails.id}/${phase.name
                    .toLowerCase()
                    .replace(/\s+/g, "-")}`}
                >
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center justify-between">
                        {phase.name}
                        <Badge variant="secondary">#{phase.phaseOrder}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Players:
                          </span>
                          <span>{phase.playerCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Total Power:
                          </span>
                          <span>{phase.totalPower.toLocaleString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
        {eventDetails.phases.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">No Phases Found</h3>
                <p className="text-muted-foreground">
                  This event doesn't have any phases configured yet.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
