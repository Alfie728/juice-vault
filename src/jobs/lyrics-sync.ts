import { eventTrigger } from "@trigger.dev/sdk";
import { Effect } from "effect";
import { z } from "zod";

import { EmbeddingsService } from "~/domain/ai/embeddings-service";
import { LyricsAIService } from "~/domain/ai/lyrics-service";
import { LyricsService } from "~/domain/lyrics/service";
import { PrismaClientService } from "~/lib/prisma";

import { client } from "./client";

export const syncLyricsJob = client.defineJob({
  id: "sync-lyrics",
  name: "Sync Lyrics with Timestamps",
  version: "1.0.0",
  trigger: eventTrigger({
    name: "song.lyrics.sync",
    schema: z.object({
      songId: z.string(),
      lyricsId: z.string().optional(),
      audioUrl: z.string(),
      fullLyrics: z.string(),
      duration: z.number().optional(),
    }),
  }),
  run: async (payload, io, ctx) => {
    const { songId, lyricsId, audioUrl, fullLyrics, duration } = payload;

    await io.runTask("update-job-status-processing", async () => {
      await updateJobStatus(songId, "SYNC_LYRICS", "PROCESSING", ctx.run.id);
    });

    try {
      const syncedLines = await io.runTask(
        "sync-lyrics-with-audio",
        async () => {
          const program = Effect.gen(function* () {
            const lyricsAI = yield* LyricsAIService;
            return yield* lyricsAI.syncLyricsWithTimestamps({
              audioUrl,
              fullLyrics,
              duration,
            });
          });

          const result = await Effect.runPromise(
            program.pipe(
              Effect.provide(LyricsAIService.Default),
              Effect.provide(PrismaClientService.Default)
            )
          );

          return result;
        }
      );

      let finalLyricsId = lyricsId;

      if (lyricsId) {
        await io.runTask("update-existing-lyrics", async () => {
          const program = Effect.gen(function* () {
            const lyricsService = yield* LyricsService;
            return yield* lyricsService.updateLyrics({
              id: lyricsId,
              lines: syncedLines.map((line, index) => ({
                text: line.text,
                startTime: line.startTime,
                endTime: line.endTime,
                orderIndex: index,
              })),
            });
          });

          const result = await Effect.runPromise(
            program.pipe(
              Effect.provide(LyricsService.Default),
              Effect.provide(PrismaClientService.Default)
            )
          );

          return result;
        });
      } else {
        await io.runTask(
          "create-new-lyrics",
          async () => {
            const program = Effect.gen(function* () {
              const lyricsService = yield* LyricsService;
              return yield* lyricsService.createLyrics({
                songId,
                fullText: fullLyrics,
                isGenerated: false,
                lines: syncedLines.map((line, index) => ({
                  text: line.text,
                  startTime: line.startTime,
                  endTime: line.endTime,
                  orderIndex: index,
                })),
              });
            });

            const result = await Effect.runPromise(
              program.pipe(
                Effect.provide(LyricsService.Default),
                Effect.provide(PrismaClientService.Default)
              )
            );

            finalLyricsId = result.id;
            return result;
          }
        );
      }

      const embedding = await io.runTask(
        "update-lyrics-embedding",
        async () => {
          const program = Effect.gen(function* () {
            const embeddingsService = yield* EmbeddingsService;
            const embedding = yield* embeddingsService.generateEmbedding({
              text: fullLyrics,
              type: "lyrics",
            });

            yield* embeddingsService.storeLyricsEmbedding(
              songId,
              finalLyricsId!,
              fullLyrics,
              embedding
            );

            return embedding;
          });

          const result = await Effect.runPromise(
            program.pipe(
              Effect.provide(EmbeddingsService.Default),
              Effect.provide(PrismaClientService.Default)
            )
          );

          return result;
        }
      );

      await io.runTask("update-job-status-completed", async () => {
        await updateJobStatus(songId, "SYNC_LYRICS", "COMPLETED", ctx.run.id);
      });

      return {
        success: true,
        lyricsId: finalLyricsId,
        linesCount: syncedLines.length,
        hasEmbedding: !!embedding,
      };
    } catch (error) {
      await io.runTask("update-job-status-failed", async () => {
        await updateJobStatus(
          songId,
          "SYNC_LYRICS",
          "FAILED",
          ctx.run.id,
          String(error)
        );
      });

      throw error;
    }
  },
});

async function updateJobStatus(
  songId: string,
  type: "SYNC_LYRICS",
  status: "PROCESSING" | "COMPLETED" | "FAILED",
  triggerId: string,
  error?: string
) {
  const program = Effect.gen(function* () {
    const db = yield* PrismaClientService;

    const existingJob = yield* Effect.tryPromise(() =>
      db.processingJob.findFirst({
        where: { songId, type, triggerId },
      })
    );

    if (existingJob) {
      return yield* Effect.tryPromise(() =>
        db.processingJob.update({
          where: { id: existingJob.id },
          data: {
            status,
            error,
            ...(status === "PROCESSING" && { startedAt: new Date() }),
            ...(status === "COMPLETED" && { completedAt: new Date() }),
            ...(status === "FAILED" && { completedAt: new Date() }),
          },
        })
      );
    } else {
      return yield* Effect.tryPromise(() =>
        db.processingJob.create({
          data: {
            songId,
            type,
            status,
            triggerId,
            error,
            ...(status === "PROCESSING" && { startedAt: new Date() }),
            ...(status === "COMPLETED" && { completedAt: new Date() }),
            ...(status === "FAILED" && { completedAt: new Date() }),
          },
        })
      );
    }
  });

  return Effect.runPromise(
    program.pipe(Effect.provide(PrismaClientService.Default))
  );
}
