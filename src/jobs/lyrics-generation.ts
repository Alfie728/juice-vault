import { eventTrigger, Job } from "@trigger.dev/sdk";
import { z } from "zod";
import { Effect } from "effect";
import { LyricsAIService } from "~/domain/ai/lyrics-service";
import { LyricsService } from "~/domain/lyrics/service";
import { EmbeddingsService } from "~/domain/ai/embeddings-service";
import { PrismaClientService } from "~/lib/prisma";
import { client } from "./client";

export const generateLyricsJob = client.defineJob({
  id: "generate-lyrics",
  name: "Generate Lyrics for Song",
  version: "1.0.0",
  trigger: eventTrigger({
    name: "song.lyrics.generate",
    schema: z.object({
      songId: z.string(),
      audioUrl: z.string(),
      songTitle: z.string(),
      artist: z.string(),
      duration: z.number().optional(),
    }),
  }),
  run: async (payload, io, ctx) => {
    const { songId, audioUrl, songTitle, artist, duration } = payload;

    await io.runTask("update-job-status-processing", async () => {
      await updateJobStatus(songId, "GENERATE_LYRICS", "PROCESSING", ctx.run.id);
    });

    try {
      const lyricsText = await io.runTask("generate-lyrics-ai", async () => {
        const program = Effect.gen(function* () {
          const lyricsAI = yield* LyricsAIService;
          return yield* lyricsAI.generateLyrics({
            audioUrl,
            songTitle,
            artist,
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
      });

      const syncedLines = await io.runTask("sync-lyrics-timestamps", async () => {
        const program = Effect.gen(function* () {
          const lyricsAI = yield* LyricsAIService;
          return yield* lyricsAI.syncLyricsWithTimestamps({
            audioUrl,
            fullLyrics: lyricsText,
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
      });

      const createdLyrics = await io.runTask("save-lyrics-to-db", async () => {
        const program = Effect.gen(function* () {
          const lyricsService = yield* LyricsService;
          return yield* lyricsService.createLyrics({
            songId,
            fullText: lyricsText,
            isGenerated: true,
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

      const embedding = await io.runTask("generate-lyrics-embedding", async () => {
        const program = Effect.gen(function* () {
          const embeddingsService = yield* EmbeddingsService;
          const embedding = yield* embeddingsService.generateEmbedding({
            text: lyricsText,
            type: "lyrics",
          });
          
          yield* embeddingsService.storeLyricsEmbedding(
            songId,
            createdLyrics.id,
            lyricsText,
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
      });

      await io.runTask("update-job-status-completed", async () => {
        await updateJobStatus(songId, "GENERATE_LYRICS", "COMPLETED", ctx.run.id);
      });

      return {
        success: true,
        lyricsId: createdLyrics.id,
        linesCount: syncedLines.length,
        hasEmbedding: !!embedding,
      };
    } catch (error) {
      await io.runTask("update-job-status-failed", async () => {
        await updateJobStatus(
          songId,
          "GENERATE_LYRICS",
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
  type: "GENERATE_LYRICS" | "SYNC_LYRICS" | "GENERATE_EMBEDDINGS",
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