import { openai } from "@ai-sdk/openai";
import { Schema } from "@effect/schema";
import { Index } from "@upstash/vector";
import { embed } from "ai";
import { Effect, pipe } from "effect";

import { ValidationError } from "~/domain/errors";
import { PrismaClientService } from "~/lib/prisma";

// Type definitions for vector metadata
interface SongMetadata {
  type: "song_title";
  songId: string;
  title: string;
}

interface LyricsMetadata {
  type: "lyrics";
  songId: string;
  lyricsId: string;
  preview: string;
}

type VectorMetadata = SongMetadata | LyricsMetadata;

export const EmbeddingInput = Schema.Struct({
  text: Schema.String,
  type: Schema.Literal("song_title", "lyrics"),
});

export type EmbeddingInput = Schema.Schema.Type<typeof EmbeddingInput>;

export const SearchInput = Schema.Struct({
  query: Schema.String,
  limit: Schema.optional(Schema.Number),
  includeMetadata: Schema.optional(Schema.Boolean),
});

export type SearchInput = Schema.Schema.Type<typeof SearchInput>;

export class EmbeddingsService extends Effect.Service<EmbeddingsService>()(
  "EmbeddingsService",
  {
    dependencies: [PrismaClientService.Default],
    effect: Effect.gen(function* () {
      const db = yield* PrismaClientService;
      const model = openai.embedding("text-embedding-3-small");

      const vectorIndex = new Index({
        url: process.env.UPSTASH_VECTOR_REST_URL!,
        token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
      });

      return {
        generateEmbedding: (input: EmbeddingInput) =>
          pipe(
            Schema.decodeUnknown(EmbeddingInput)(input),
            Effect.mapError(
              (error) =>
                new ValidationError({
                  field: "embeddingInput",
                  reason: String(error),
                })
            ),
            Effect.flatMap((validInput) =>
              Effect.tryPromise({
                try: async () => {
                  const { embedding } = await embed({
                    model,
                    value: validInput.text,
                  });

                  return embedding;
                },
                catch: (error) =>
                  new ValidationError({
                    field: "generateEmbedding",
                    reason: `Failed to generate embedding: ${String(error)}`,
                  }),
              })
            )
          ),

        storeSongEmbedding: (
          songId: string,
          title: string,
          embedding: number[]
        ) =>
          Effect.tryPromise({
            try: async () => {
              await vectorIndex.upsert({
                id: `song_${songId}`,
                vector: embedding,
                metadata: {
                  type: "song_title",
                  songId,
                  title,
                },
              });

              await db.song.update({
                where: { id: songId },
                data: { titleEmbedding: embedding },
              });

              return { success: true };
            },
            catch: (error) =>
              new ValidationError({
                field: "storeSongEmbedding",
                reason: String(error),
              }),
          }),

        storeLyricsEmbedding: (
          songId: string,
          lyricsId: string,
          lyrics: string,
          embedding: number[]
        ) =>
          Effect.tryPromise({
            try: async () => {
              await vectorIndex.upsert({
                id: `lyrics_${lyricsId}`,
                vector: embedding,
                metadata: {
                  type: "lyrics",
                  songId,
                  lyricsId,
                  preview: lyrics.substring(0, 200),
                },
              });

              await db.lyrics.update({
                where: { id: lyricsId },
                data: { embedding },
              });

              return { success: true };
            },
            catch: (error) =>
              new ValidationError({
                field: "storeLyricsEmbedding",
                reason: String(error),
              }),
          }),

        semanticSearch: (input: SearchInput) =>
          pipe(
            Schema.decodeUnknown(SearchInput)(input),
            Effect.mapError(
              (error) =>
                new ValidationError({
                  field: "searchInput",
                  reason: String(error),
                })
            ),
            Effect.flatMap((validInput) =>
              Effect.tryPromise({
                try: async () => {
                  const { embedding } = await embed({
                    model,
                    value: validInput.query,
                  });

                  const results = await vectorIndex.query({
                    vector: embedding,
                    topK: validInput.limit ?? 10,
                    includeMetadata: validInput.includeMetadata ?? true,
                  });

                  const songIds = results
                    .filter((r) => r.metadata)
                    .map((r) => {
                      const metadata = r.metadata as unknown as VectorMetadata;
                      return metadata.songId;
                    });

                  const uniqueSongIds = [...new Set(songIds)];

                  const songs = await db.song.findMany({
                    where: {
                      id: { in: uniqueSongIds },
                    },
                    include: {
                      uploadedBy: true,
                      lyrics: true,
                    },
                  });

                  return {
                    results: results.map((r) => ({
                      score: r.score,
                      metadata: r.metadata,
                    })),
                    songs,
                  };
                },
                catch: (error) =>
                  new ValidationError({
                    field: "semanticSearch",
                    reason: `Search failed: ${String(error)}`,
                  }),
              })
            )
          ),

        hybridSearch: (query: string, limit?: number) =>
          Effect.gen(function* () {
            const [semanticResults, textResults] = yield* Effect.all([
              Effect.tryPromise({
                try: async () => {
                  const { embedding } = await embed({
                    model,
                    value: query,
                  });

                  const results = await vectorIndex.query({
                    vector: embedding,
                    topK: limit ?? 20,
                    includeMetadata: true,
                  });

                  return results;
                },
                catch: () => [],
              }),
              Effect.tryPromise({
                try: () =>
                  db.song.findMany({
                    where: {
                      OR: [
                        { title: { contains: query, mode: "insensitive" } },
                        { artist: { contains: query, mode: "insensitive" } },
                        {
                          lyrics: {
                            fullText: { contains: query, mode: "insensitive" },
                          },
                        },
                      ],
                    },
                    include: {
                      uploadedBy: true,
                      lyrics: true,
                    },
                    take: limit ?? 20,
                  }),
                catch: () => [],
              }),
            ]);

            const semanticSongIds = semanticResults
              .filter((r) => r.metadata)
              .map((r) => {
                const metadata = r.metadata as unknown as VectorMetadata;
                return metadata.songId;
              });

            const combinedSongIds = [
              ...new Set([...semanticSongIds, ...textResults.map((s) => s.id)]),
            ];

            const songs = yield* Effect.tryPromise({
              try: () =>
                db.song.findMany({
                  where: {
                    id: { in: combinedSongIds },
                  },
                  include: {
                    uploadedBy: true,
                    lyrics: {
                      include: {
                        lines: {
                          orderBy: { orderIndex: "asc" },
                        },
                      },
                    },
                  },
                }),
              catch: (error) =>
                new ValidationError({
                  field: "hybridSearch",
                  reason: String(error),
                }),
            });

            const scoreMap = new Map(
              semanticResults
                .filter((r) => r.metadata)
                .map((r) => {
                  const metadata = r.metadata as unknown as VectorMetadata;
                  return [metadata.songId, r.score];
                })
            );

            return songs
              .map((song) => ({
                ...song,
                relevanceScore: scoreMap.get(song.id) ?? 0.5,
              }))
              .sort((a, b) => b.relevanceScore - a.relevanceScore)
              .slice(0, limit ?? 10);
          }),
      };
    }),
    accessors: true,
  }
) {}
