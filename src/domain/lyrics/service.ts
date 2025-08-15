import { Schema } from "@effect/schema";
import { Effect, pipe } from "effect";

import { DatabaseError, NotFoundError, ValidationError } from "~/domain/errors";
import { PrismaClientService } from "~/lib/prisma";

export const CreateLyricsInput = Schema.Struct({
  songId: Schema.String,
  fullText: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Lyrics cannot be empty" })
  ),
  isGenerated: Schema.optional(Schema.Boolean),
  lines: Schema.optional(
    Schema.Array(
      Schema.Struct({
        text: Schema.String,
        startTime: Schema.Number,
        endTime: Schema.optional(Schema.Number),
        orderIndex: Schema.Number,
      })
    )
  ),
});

export type CreateLyricsInput = Schema.Schema.Type<typeof CreateLyricsInput>;

export const UpdateLyricsInput = Schema.Struct({
  id: Schema.String,
  fullText: Schema.optional(Schema.String),
  isVerified: Schema.optional(Schema.Boolean),
  lines: Schema.optional(
    Schema.Array(
      Schema.Struct({
        text: Schema.String,
        startTime: Schema.Number,
        endTime: Schema.optional(Schema.Number),
        orderIndex: Schema.Number,
      })
    )
  ),
});

export type UpdateLyricsInput = Schema.Schema.Type<typeof UpdateLyricsInput>;

export class LyricsService extends Effect.Service<LyricsService>()(
  "LyricsService",
  {
    dependencies: [PrismaClientService.Default],
    effect: Effect.gen(function* () {
      const db = yield* PrismaClientService;

      return {
        createLyrics: (input: CreateLyricsInput) =>
          pipe(
            Schema.decodeUnknown(CreateLyricsInput)(input),
            Effect.mapError(
              (error) =>
                new ValidationError({
                  field: "createLyricsInput",
                  reason: String(error),
                })
            ),
            Effect.flatMap((validInput) =>
              Effect.tryPromise({
                try: () =>
                  db.lyrics.create({
                    data: {
                      songId: validInput.songId,
                      fullText: validInput.fullText,
                      isGenerated: validInput.isGenerated ?? false,
                      embedding: [],
                      lines: validInput.lines
                        ? {
                            create: validInput.lines.map((line) => ({
                              text: line.text,
                              startTime: line.startTime,
                              endTime: line.endTime,
                              orderIndex: line.orderIndex,
                            })),
                          }
                        : undefined,
                    },
                    include: {
                      lines: {
                        orderBy: { orderIndex: "asc" },
                      },
                    },
                  }),
                catch: (error) =>
                  new DatabaseError({
                    operation: "createLyrics",
                    reason: String(error),
                  }),
              })
            )
          ),

        updateLyrics: (input: UpdateLyricsInput) =>
          pipe(
            Schema.decodeUnknown(UpdateLyricsInput)(input),
            Effect.mapError(
              (error) =>
                new ValidationError({
                  field: "updateLyricsInput",
                  reason: String(error),
                })
            ),
            Effect.flatMap((validInput) =>
              Effect.tryPromise({
                try: async () => {
                  if (validInput.lines) {
                    await db.lyricLine.deleteMany({
                      where: { lyricsId: validInput.id },
                    });
                  }

                  return db.lyrics.update({
                    where: { id: validInput.id },
                    data: {
                      ...(validInput.fullText && {
                        fullText: validInput.fullText,
                      }),
                      ...(validInput.isVerified !== undefined && {
                        isVerified: validInput.isVerified,
                      }),
                      ...(validInput.lines && {
                        lines: {
                          create: validInput.lines.map((line) => ({
                            text: line.text,
                            startTime: line.startTime,
                            endTime: line.endTime,
                            orderIndex: line.orderIndex,
                          })),
                        },
                      }),
                    },
                    include: {
                      lines: {
                        orderBy: { orderIndex: "asc" },
                      },
                    },
                  });
                },
                catch: (error) =>
                  new DatabaseError({
                    operation: "updateLyrics",
                    reason: String(error),
                  }),
              })
            )
          ),

        getLyricsBySongId: (songId: string) =>
          pipe(
            Effect.tryPromise({
              try: () =>
                db.lyrics.findUnique({
                  where: { songId },
                  include: {
                    lines: {
                      orderBy: { orderIndex: "asc" },
                    },
                  },
                }),
              catch: (error) =>
                new DatabaseError({
                  operation: "getLyricsBySongId",
                  reason: String(error),
                }),
            }),
            Effect.map((lyrics) => lyrics ?? null)
          ),

        deleteLyrics: (id: string) =>
          Effect.tryPromise({
            try: () =>
              db.lyrics.delete({
                where: { id },
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "deleteLyrics",
                reason: String(error),
              }),
          }).pipe(Effect.map(() => ({ success: true }))),

        syncLyricLines: (
          lyricsId: string,
          lines: Array<{ text: string; startTime: number; endTime?: number }>
        ) =>
          Effect.tryPromise({
            try: async () => {
              await db.lyricLine.deleteMany({
                where: { lyricsId },
              });

              const createdLines = await db.lyricLine.createMany({
                data: lines.map((line, index) => ({
                  lyricsId,
                  text: line.text,
                  startTime: line.startTime,
                  endTime: line.endTime,
                  orderIndex: index,
                })),
              });

              return { count: createdLines.count };
            },
            catch: (error) =>
              new DatabaseError({
                operation: "syncLyricLines",
                reason: String(error),
              }),
          }),
      };
    }),
    accessors: true,
  }
) {}
