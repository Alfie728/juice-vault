import { Schema } from "@effect/schema";

export const Song = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  artist: Schema.String,
  duration: Schema.NullOr(Schema.Number),
  audioUrl: Schema.String,
  coverArtUrl: Schema.NullOr(Schema.String),
  releaseDate: Schema.NullOr(Schema.DateFromSelf),
  isUnreleased: Schema.Boolean,
  playCount: Schema.Number,
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
  uploadedById: Schema.String,
});

export type Song = Schema.Schema.Type<typeof Song>;

export const SongWithUser = Schema.Struct({
  ...Song.fields,
  uploadedBy: Schema.Struct({
    id: Schema.String,
    name: Schema.NullOr(Schema.String),
    email: Schema.NullOr(Schema.String),
    image: Schema.NullOr(Schema.String),
  }),
});

export type SongWithUser = Schema.Schema.Type<typeof SongWithUser>;

export const SongWithLyrics = Schema.Struct({
  ...Song.fields,
  lyrics: Schema.NullOr(Schema.Struct({
    id: Schema.String,
    fullText: Schema.String,
    isGenerated: Schema.Boolean,
    isVerified: Schema.Boolean,
    lines: Schema.Array(Schema.Struct({
      id: Schema.String,
      text: Schema.String,
      startTime: Schema.Number,
      endTime: Schema.NullOr(Schema.Number),
      orderIndex: Schema.Number,
    })),
  })),
});

export type SongWithLyrics = Schema.Schema.Type<typeof SongWithLyrics>;