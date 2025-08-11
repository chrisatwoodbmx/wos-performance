import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/auth/actions";
import { sql } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Event = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date | null;
  phaseCount: number;
  playerCount: number;
};

async function getEvents(): Promise<Event[]> {
  const events = await sql`
    SELECT
      e.id,
      e.name,
      e.start_date,
      e.end_date,
      COUNT(DISTINCT ep.id) as phase_count,
      COUNT(DISTINCT dps.player_id) as player_count
    FROM events e
    LEFT JOIN event_phases ep ON e.id = ep.event_id
    LEFT JOIN daily_player_stats dps ON ep.id = dps.event_phase_id
    GROUP BY e.id, e.name, e.start_date, e.end_date
    ORDER BY e.start_date DESC
  `;

  return events.map((event) => ({
    id: event.id,
    name: event.name,
    startDate: event.start_date,
    endDate: event.end_date,
    phaseCount: Number.parseInt(event.phase_count) || 0,
    playerCount: Number.parseInt(event.player_count) || 0,
  }));
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const events = await getEvents();

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <h1 className="text-3xl font-bold">Event Dashboard</h1>
        <Badge variant="outline">{events.length} Events</Badge>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">No Events Found</h3>
              <p className="text-muted-foreground">
                Please create an event using the database initialization script
                or manually.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link key={event.id} href={`/event/${event.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {event.name}
                    <Badge variant="secondary">{event.phaseCount} Phases</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Start Date:</span>
                      <span>
                        {new Date(event.startDate).toLocaleDateString()}
                      </span>
                    </div>
                    {event.endDate && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">End Date:</span>
                        <span>
                          {new Date(event.endDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Players:</span>
                      <span>{event.playerCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
