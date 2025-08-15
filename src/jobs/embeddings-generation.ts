import { eventTrigger, Job } from "@trigger.dev/sdk";
import { z } from "zod";
import { Effect } from "effect";
import { EmbeddingsService } from "~/domain/ai/embeddings-service";
import { PrismaClientService } from "~/lib/prisma";
import { client } from "./client";

export const generateEmbeddingsJob = client.defineJob({
  id: "generate-embeddings",
  name: "Generate Embeddings for Song",
  version: "1.0.0",
  trigger: eventTrigger({
    name: "song.embeddings.generate",
    schema: z.object({
      songId: z.string(),
      songTitle: z.string(),
      lyricsId: z.string().optional(),
      lyricsText: z.string().optional(),
    }),
  }),
  run: async (payload, io, ctx) => {
    const { songId, songTitle, lyricsId, lyricsText } = payload;

    await io.runTask("update-job-status-processing", async () => {
      await updateJobStatus(songId, "GENERATE_EMBEDDINGS", "PROCESSING", ctx.run.id);
    });

    try {
      const titleEmbedding = await io.runTask("generate-title-embedding", async () => {
        const program = Effect.gen(function* () {
          const embeddingsService = yield* EmbeddingsService;
          const embedding = yield* embeddingsService.generateEmbedding({
            text: songTitle,
            type: "song_title",
          });
          
          yield* embeddingsService.storeSongEmbedding(songId, songTitle, embedding);
          
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

      let lyricsEmbedding = null;
      if (lyricsId && lyricsText) {
        lyricsEmbedding = await io.runTask("generate-lyrics-embedding", async () => {
          const program = Effect.gen(function* () {
            const embeddingsService = yield* EmbeddingsService;
            const embedding = yield* embeddingsService.generateEmbedding({
              text: lyricsText,
              type: "lyrics",
            });
            
            yield* embeddingsService.storeLyricsEmbedding(
              songId,
              lyricsId,
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
      }

      await io.runTask("update-job-status-completed", async () => {
        await updateJobStatus(songId, "GENERATE_EMBEDDINGS", "COMPLETED", ctx.run.id);
      });

      return {
        success: true,
        hasTitleEmbedding: !!titleEmbedding,
        hasLyricsEmbedding: !!lyricsEmbedding,
      };
    } catch (error) {
      await io.runTask("update-job-status-failed", async () => {
        await updateJobStatus(
          songId,
          "GENERATE_EMBEDDINGS",
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
  type: "GENERATE_EMBEDDINGS",
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