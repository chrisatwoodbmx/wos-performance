"use server";

import { sql } from "@/lib/db";
import Papa from "papaparse";

type CsvRow = { [key: string]: string | undefined };

// Helper function to find or create a player and update name history
async function findOrCreatePlayer(
  playerName: string,
  allianceId?: string,
): Promise<string> {
  let playerId: string | null = null;

  // Try to find player by current name
  const existingPlayers =
    await sql`SELECT id FROM players WHERE current_name = ${playerName}`;
  if (existingPlayers.length > 0) {
    playerId = existingPlayers[0].id;
    if (allianceId) {
      await sql`UPDATE players SET alliance_id = ${allianceId}, updated_at = NOW() WHERE id = ${playerId}`;
    }
  } else {
    // Try to find player by name history
    const historyPlayers = await sql`
      SELECT p.id
      FROM players p
      JOIN player_name_history pnh ON p.id = pnh.player_id
      WHERE pnh.name = ${playerName}
    `;
    if (historyPlayers.length > 0) {
      playerId = historyPlayers[0].id;
      // Update current name and alliance if player found via history
      await sql`UPDATE players SET current_name = ${playerName}, alliance_id = ${
        allianceId || null
      }, updated_at = NOW() WHERE id = ${playerId}`;
    }
  }

  // If player still not found, create a new one with the actual player name
  if (!playerId) {
    const newPlayerResult = await sql`
      INSERT INTO players (current_name, alliance_id) VALUES (${playerName}, ${
      allianceId || null
    }) RETURNING id
    `;
    playerId = newPlayerResult[0].id;
    // Add the provided name to name history for the new player
    await sql`
      INSERT INTO player_name_history (player_id, name) VALUES (${playerId}, ${playerName})
    `;
  } else {
    // Ensure the current name is in history if it's new
    const nameInHistory = await sql`
      SELECT id FROM player_name_history WHERE player_id = ${playerId} AND name = ${playerName}
    `;
    if (nameInHistory.length === 0) {
      await sql`
        INSERT INTO player_name_history (player_id, name) VALUES (${playerId}, ${playerName})
      `;
    }
  }
  return playerId;
}

// Helper function to parse numbers with comma separators
function parseNumberWithCommas(value: string | undefined): number {
  if (!value) return 0;
  // Remove commas and any whitespace, then parse
  const cleanValue = value.replace(/,/g, "").trim();
  return Number.parseInt(cleanValue, 10);
}

async function processCsvUpload(
  csvFile: File,
  eventId: string,
  phaseId: string,
  processRow: (
    playerId: string,
    eventId: string,
    phaseId: string,
    row: CsvRow,
  ) => Promise<void>,
  allianceId?: string,
): Promise<{ success: boolean; message: string }> {
  if (!csvFile || csvFile.size === 0) {
    return { success: false, message: "No CSV file provided." };
  }

  if (!eventId || !phaseId) {
    return { success: false, message: "Event ID or Phase ID is missing." };
  }

  const csvText = await csvFile.text();

  return new Promise((resolve) => {
    // First, try parsing with headers
    Papa.parse<CsvRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.toLowerCase().replace(/\s/g, ""),
      complete: async (results) => {
        if (results.errors.length > 0) {
          console.error("CSV Parsing Errors:", results.errors);
          resolve({
            success: false,
            message: `CSV parsing errors: ${results.errors[0]?.message}`,
          });
          return;
        }

        const data = results.data;

        // Check if we have valid data with headers
        const hasValidHeaders =
          data.length > 0 &&
          Object.keys(data[0]).some((key) =>
            [
              "playername",
              "power",
              "allianceranking",
              "playerrank",
              "furnacelevel",
              "worldrankplacement",
              "worldrank",
              "points",
            ].includes(key),
          );

        // If no valid headers detected, try parsing without headers
        if (!hasValidHeaders || data.length === 0) {
          Papa.parse(csvText, {
            header: false,
            skipEmptyLines: true,
            complete: async (noHeaderResults) => {
              if (noHeaderResults.errors.length > 0) {
                resolve({
                  success: false,
                  message: `CSV parsing errors: ${noHeaderResults.errors[0]?.message}`,
                });
                return;
              }

              const rawData = noHeaderResults.data as string[][];
              if (rawData.length === 0) {
                resolve({
                  success: false,
                  message: "CSV file is empty or has no valid data rows.",
                });
                return;
              }

              // Convert raw data to objects based on expected format
              // For power CSV, assume format: playerName, power
              const convertedData: CsvRow[] = rawData.map((row) => ({
                playername: row[0]?.trim(),
                power: row[1]?.trim(),
              }));

              await processDataRows(
                convertedData,
                eventId,
                phaseId,
                processRow,
                resolve,
              );
            },
          });
          return;
        }

        await processDataRows(data, eventId, phaseId, processRow, resolve);
      },
      error: (error) => {
        console.error("PapaParse Error:", error);
        resolve({
          success: false,
          message: `CSV parsing failed: ${error.message}`,
        });
      },
    });
  });
}

async function processDataRows(
  data: CsvRow[],
  eventId: string,
  phaseId: string,
  processRow: (
    playerId: string,
    eventId: string,
    phaseId: string,
    row: CsvRow,
  ) => Promise<void>,
  resolve: (value: { success: boolean; message: string }) => void,
) {
  if (data.length === 0) {
    resolve({
      success: false,
      message: "CSV file is empty or has no valid data rows.",
    });
    return;
  }

  try {
    let processedCount = 0;
    for (const row of data) {
      const playerName = row.playername;
      if (!playerName) {
        console.warn(
          `Skipping row due to missing player name: ${JSON.stringify(row)}`,
        );
        continue;
      }
      const playerId = await findOrCreatePlayer(playerName);
      await processRow(playerId, eventId, phaseId, row);
      processedCount++;
    }

    resolve({
      success: true,
      message: `CSV data uploaded successfully! Processed ${processedCount} players.`,
    });
  } catch (error: any) {
    console.error("Database operation failed:", error);
    resolve({ success: false, message: `Database error: ${error.message}` });
  }
}

// Action for Power CSV (playerName, power)
export async function uploadPowerCsvAction(prevState: any, formData: FormData) {
  const csvFile = formData.get("csvFile") as File;
  const eventId = formData.get("eventId") as string;
  const phaseId = formData.get("phaseId") as string;

  return processCsvUpload(
    csvFile,
    eventId,
    phaseId,
    async (playerId, eventId, phaseId, row) => {
      const power = parseNumberWithCommas(row.power);
      if (isNaN(power)) {
        console.warn(
          `Invalid power value for player ${row.playername}: ${row.power}`,
        );
        return;
      }

      await sql`
      INSERT INTO daily_player_stats (player_id, event_phase_id, power)
      VALUES (${playerId}, ${phaseId}, ${power})
      ON CONFLICT (player_id, event_phase_id) DO UPDATE SET
        power = EXCLUDED.power,
        recorded_at = NOW()
    `;
    },
  );
}

// Action for Player Details CSV (playerName, allianceRanking, playerRank, furnaceLevel)
export async function uploadPlayerDetailsCsvAction(
  prevState: any,
  formData: FormData,
) {
  const csvFile = formData.get("csvFile") as File;
  const eventId = formData.get("eventId") as string;
  const phaseId = formData.get("phaseId") as string;

  return processCsvUpload(
    csvFile,
    eventId,
    phaseId,
    async (playerId, eventId, phaseId, row) => {
      const allianceRanking = row.allianceranking
        ? parseNumberWithCommas(row.allianceranking)
        : null;
      const playerRank = row.playerrank
        ? parseNumberWithCommas(row.playerrank)
        : null;
      const furnaceLevel = row.furnacelevel
        ? parseNumberWithCommas(row.furnacelevel)
        : null;

      await sql`
      INSERT INTO daily_player_stats (player_id, event_phase_id, alliance_ranking, player_rank, furnace_level)
      VALUES (${playerId}, ${phaseId}, ${allianceRanking}, ${playerRank}, ${furnaceLevel})
      ON CONFLICT (player_id, event_phase_id) DO UPDATE SET
        alliance_ranking = EXCLUDED.alliance_ranking,
        player_rank = EXCLUDED.player_rank,
        furnace_level = EXCLUDED.furnace_level,
        recorded_at = NOW()
    `;
    },
  );
}

// Action for World Ranking CSV (playerName, worldRank, points)
export async function uploadWorldRankingCsvAction(formData: FormData) {
  const csvFile = formData.get("file") as File;
  const eventId = formData.get("eventId") as string;
  const phaseId = formData.get("phaseId") as string;
  const allianceId = formData.get("allianceId") as string;

  return processCsvUpload(
    csvFile,
    eventId,
    phaseId,
    async (playerId, eventId, phaseId, row) => {
      const worldRank = row.worldrank
        ? parseNumberWithCommas(row.worldrank)
        : row.worldrankplacement
        ? parseNumberWithCommas(row.worldrankplacement)
        : null;
      const points = row.points ? parseNumberWithCommas(row.points) : null;

      if (allianceId) {
        // Update player's alliance assignment
        await sql`UPDATE players SET alliance_id = ${allianceId}, updated_at = NOW() WHERE id = ${playerId}`;
      }

      await sql`
        INSERT INTO daily_player_stats (player_id, event_phase_id, world_rank_placement, points)
        VALUES (${playerId}, ${phaseId}, ${worldRank}, ${points})
        ON CONFLICT (player_id, event_phase_id) DO UPDATE SET
          world_rank_placement = EXCLUDED.world_rank_placement,
          points = EXCLUDED.points,
          recorded_at = NOW()
      `;
    },
    allianceId,
  );
}

// Action for Combined CSV upload for power and alliance ranking
export async function uploadCombinedCsvAction(formData: FormData) {
  const csvFile = formData.get("file") as File;
  const eventId = formData.get("eventId") as string;
  const phaseId = formData.get("phaseId") as string;
  const allianceId = formData.get("allianceId") as string;

  return processCsvUpload(
    csvFile,
    eventId,
    phaseId,
    async (playerId, eventId, phaseId, row) => {
      const power = parseNumberWithCommas(row.power);
      const allianceRanking = row.allianceranking
        ? parseNumberWithCommas(row.allianceranking)
        : null;

      if (isNaN(power)) {
        console.warn(
          `Invalid power value for player ${row.playername}: ${row.power}`,
        );
        return;
      }

      await sql`
      INSERT INTO daily_player_stats (player_id, event_phase_id, power, alliance_ranking)
      VALUES (${playerId}, ${phaseId}, ${power}, ${allianceRanking})
      ON CONFLICT (player_id, event_phase_id) DO UPDATE SET
        power = EXCLUDED.power,
        alliance_ranking = EXCLUDED.alliance_ranking,
        recorded_at = NOW()
    `;
    },
    allianceId,
  );
}

export async function checkExistingDataAction(
  eventId: string,
  phaseId: string,
  allianceId: string,
) {
  try {
    const existingData = await sql`
      SELECT COUNT(*) as count
      FROM daily_player_stats dps
      JOIN players p ON dps.player_id = p.id
      WHERE dps.event_phase_id = ${phaseId}
      AND p.alliance_id = ${allianceId}
    `;

    const count = Number(existingData[0].count);
    return {
      success: true,
      hasData: count > 0,
      count: count,
      message:
        count > 0
          ? `Found ${count} existing records for this alliance and phase.`
          : "No existing data found.",
    };
  } catch (error: any) {
    console.error("Error checking existing data:", error);
    return {
      success: false,
      hasData: false,
      count: 0,
      message: `Error checking existing data: ${error.message}`,
    };
  }
}
