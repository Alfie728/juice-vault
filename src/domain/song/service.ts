import { Schema } from "@effect/schema";
import { Effect, pipe } from "effect";

import { DatabaseError, NotFoundError, ValidationError } from "~/domain/errors";
import { PrismaClientService } from "~/lib/prisma";

import { PrismaSongToSong, PrismaSongWithUserToSongWithUser, PrismaSongWithLyricsToSongWithLyrics } from "./mapping";
import { SongWithUserQuery, SongWithLyricsQuery } from "./query";

export const CreateSongInput = Schema.Struct({
  title: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Song title cannot be empty" })
  ),
  artist: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Artist name cannot be empty" })
  ),
  audioUrl: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Audio URL cannot be empty" })
  ),
  duration: Schema.optional(Schema.Number),
  coverArtUrl: Schema.optional(Schema.String),
  releaseDate: Schema.optional(Schema.Date),
  isUnreleased: Schema.optional(Schema.Boolean),
  uploadedBy: Schema.Struct({
    id: Schema.String,
  }),
});

export type CreateSongInput = Schema.Schema.Type<typeof CreateSongInput>;

export const UpdateSongInput = Schema.Struct({
  id: Schema.String,
  title: Schema.optional(Schema.String),
  artist: Schema.optional(Schema.String),
  duration: Schema.optional(Schema.Number),
  coverArtUrl: Schema.optional(Schema.String),
  releaseDate: Schema.optional(Schema.Date),
  isUnreleased: Schema.optional(Schema.Boolean),
});

export type UpdateSongInput = Schema.Schema.Type<typeof UpdateSongInput>;

export class SongService extends Effect.Service<SongService>()("SongService", {
  dependencies: [PrismaClientService.Default],
  effect: Effect.gen(function* () {
    const db = yield* PrismaClientService;

    return {
      createSong: (input: CreateSongInput) =>
        pipe(
          Schema.decodeUnknown(CreateSongInput)(input),
          Effect.mapError(
            (error) =>
              new ValidationError({
                field: "createSongInput",
                reason: String(error),
              })
          ),
          Effect.flatMap((validInput) =>
            Effect.tryPromise({
              try: () =>
                db.song.create({
                  data: {
                    title: validInput.title,
                    artist: validInput.artist,
                    audioUrl: validInput.audioUrl,
                    duration: validInput.duration,
                    coverArtUrl: validInput.coverArtUrl,
                    releaseDate: validInput.releaseDate,
                    isUnreleased: validInput.isUnreleased ?? true,
                    titleEmbedding: [],
                    uploadedBy: { connect: { id: validInput.uploadedBy.id } },
                  },
                }),
              catch: (error) =>
                new DatabaseError({
                  operation: "createSong",
                  reason: String(error),
                }),
            })
          ),
          Effect.flatMap(PrismaSongToSong)
        ),

      updateSong: (input: UpdateSongInput) =>
        pipe(
          Schema.decodeUnknown(UpdateSongInput)(input),
          Effect.mapError(
            (error) =>
              new ValidationError({
                field: "updateSongInput",
                reason: String(error),
              })
          ),
          Effect.flatMap((validInput) =>
            Effect.tryPromise({
              try: () =>
                db.song.update({
                  where: { id: validInput.id },
                  data: {
                    ...(validInput.title && { title: validInput.title }),
                    ...(validInput.artist && { artist: validInput.artist }),
                    ...(validInput.duration !== undefined && { duration: validInput.duration }),
                    ...(validInput.coverArtUrl && { coverArtUrl: validInput.coverArtUrl }),
                    ...(validInput.releaseDate && { releaseDate: validInput.releaseDate }),
                    ...(validInput.isUnreleased !== undefined && { isUnreleased: validInput.isUnreleased }),
                  },
                }),
              catch: (error) =>
                new DatabaseError({
                  operation: "updateSong",
                  reason: String(error),
                }),
            })
          ),
          Effect.flatMap(PrismaSongToSong)
        ),

      getSong: (id: string) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              db.song.findUnique({
                where: { id },
                include: SongWithUserQuery.include,
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "getSong",
                reason: String(error),
              }),
          }),
          Effect.flatMap((song) =>
            song
              ? PrismaSongWithUserToSongWithUser(song)
              : Effect.fail<NotFoundError | ValidationError | DatabaseError>(
                  new NotFoundError({
                    resource: "Song",
                    id,
                  })
                )
          )
        ),

      getSongWithLyrics: (id: string) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              db.song.findUnique({
                where: { id },
                include: SongWithLyricsQuery.include,
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "getSongWithLyrics",
                reason: String(error),
              }),
          }),
          Effect.flatMap((song) =>
            song
              ? PrismaSongWithLyricsToSongWithLyrics(song)
              : Effect.fail<NotFoundError | ValidationError | DatabaseError>(
                  new NotFoundError({
                    resource: "Song",
                    id,
                  })
                )
          )
        ),

      getAllSongs: () =>
        pipe(
          Effect.tryPromise({
            try: () =>
              db.song.findMany({
                orderBy: { createdAt: "desc" },
                include: SongWithUserQuery.include,
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "getAllSongs",
                reason: String(error),
              }),
          }),
          Effect.flatMap((songs) => Effect.all(songs.map(PrismaSongWithUserToSongWithUser)))
        ),

      searchSongs: (query: string) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              db.song.findMany({
                where: {
                  OR: [
                    { title: { contains: query, mode: "insensitive" } },
                    { artist: { contains: query, mode: "insensitive" } },
                  ],
                },
                include: SongWithUserQuery.include,
                orderBy: { createdAt: "desc" },
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "searchSongs",
                reason: String(error),
              }),
          }),
          Effect.flatMap((songs) => Effect.all(songs.map(PrismaSongWithUserToSongWithUser)))
        ),

      incrementPlayCount: (id: string) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              db.song.update({
                where: { id },
                data: { playCount: { increment: 1 } },
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "incrementPlayCount",
                reason: String(error),
              }),
          }),
          Effect.flatMap(PrismaSongToSong)
        ),

      deleteSong: (id: string) =>
        Effect.tryPromise({
          try: () =>
            db.song.delete({
              where: { id },
            }),
          catch: (error) =>
            new DatabaseError({
              operation: "deleteSong",
              reason: String(error),
            }),
        }).pipe(Effect.map(() => ({ success: true }))),
    };
  }),
  accessors: true,
}) {}