import { notFound } from "next/navigation";
import { getEventById } from "@/lib/db/queries/events";
import { getBookmakerGrid } from "@/lib/db/queries/odds";
import { formatOdds } from "@/lib/utils/formatters";

export const metadata = { title: "Event — AshBets" };

export default async function FootballEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await getEventById(eventId);
  if (!event || event.sport !== "football") notFound();

  const grid = await getBookmakerGrid(eventId);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-xs uppercase tracking-wide text-gray-500">
          {event.sport}
          {event.league ? ` · ${event.league}` : null}
        </p>
        <h1 className="text-2xl font-bold">
          {event.homeTeam} vs {event.awayTeam}
        </h1>
        <p className="text-sm text-gray-500">
          Kickoff {event.startTime.toISOString().slice(0, 16).replace("T", " ")}
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900">
            <tr>
              <th className="px-3 py-2 font-medium">Book</th>
              <th className="px-3 py-2 font-medium">Market</th>
              <th className="px-3 py-2 font-medium">Outcome</th>
              <th className="px-3 py-2 font-medium">Odds</th>
              <th className="px-3 py-2 font-medium">Recorded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {grid.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-500">
                  No odds captured yet for this event.
                </td>
              </tr>
            ) : (
              grid.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">{row.bookmaker}</td>
                  <td className="px-3 py-2">{row.market}</td>
                  <td className="px-3 py-2">{row.outcome}</td>
                  <td className="px-3 py-2 font-mono">{formatOdds(Number(row.odds), "decimal")}</td>
                  <td className="px-3 py-2">{row.recordedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
