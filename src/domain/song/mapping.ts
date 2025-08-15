import { Schema } from "@effect/schema";
import { Effect } from "effect";
import type { Song as PrismaSong, User, Lyrics, LyricLine } from "@prisma/client";

import { ValidationError } from "~/domain/errors";
import { Song, SongWithUser, SongWithLyrics } from "./schema";

export const PrismaSongToSong = (
  song: PrismaSong
): Effect.Effect<Song, ValidationError> =>
  Effect.mapError(
    Schema.decodeUnknown(Song)(song),
    (error) =>
      new ValidationError({
        field: "song",
        reason: String(error),
      })
  );

export const PrismaSongWithUserToSongWithUser = (
  song: PrismaSong & { uploadedBy: User }
): Effect.Effect<SongWithUser, ValidationError> =>
  Effect.mapError(
    Schema.decodeUnknown(SongWithUser)(song),
    (error) =>
      new ValidationError({
        field: "songWithUser",
        reason: String(error),
      })
  );

export const PrismaSongWithLyricsToSongWithLyrics = (
  song: PrismaSong & { lyrics: (Lyrics & { lines: LyricLine[] }) | null }
): Effect.Effect<SongWithLyrics, ValidationError> =>
  Effect.mapError(
    Schema.decodeUnknown(SongWithLyrics)(song),
    (error) =>
      new ValidationError({
        field: "songWithLyrics",
        reason: String(error),
      })
  );