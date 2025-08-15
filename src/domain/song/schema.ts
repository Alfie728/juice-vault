import { Schema } from "@effect/schema";

export const Song = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  artist: Schema.String,
  duration: Schema.optional(Schema.Number),
  audioUrl: Schema.String,
  coverArtUrl: Schema.optional(Schema.String),
  releaseDate: Schema.optional(Schema.Date),
  isUnreleased: Schema.Boolean,
  playCount: Schema.Number,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  uploadedById: Schema.String,
});

export type Song = Schema.Schema.Type<typeof Song>;

export const SongWithUser = Schema.Struct({
  ...Song.fields,
  uploadedBy: Schema.Struct({
    id: Schema.String,
    name: Schema.optional(Schema.String),
    email: Schema.optional(Schema.String),
    image: Schema.optional(Schema.String),
  }),
});

export type SongWithUser = Schema.Schema.Type<typeof SongWithUser>;

export const SongWithLyrics = Schema.Struct({
  ...Song.fields,
  lyrics: Schema.optional(Schema.Struct({
    id: Schema.String,
    fullText: Schema.String,
    isGenerated: Schema.Boolean,
    isVerified: Schema.Boolean,
    lines: Schema.Array(Schema.Struct({
      id: Schema.String,
      text: Schema.String,
      startTime: Schema.Number,
      endTime: Schema.optional(Schema.Number),
      orderIndex: Schema.Number,
    })),
  })),
});

export type SongWithLyrics = Schema.Schema.Type<typeof SongWithLyrics>;