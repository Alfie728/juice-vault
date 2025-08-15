export const SongWithUserQuery = {
  include: {
    uploadedBy: true,
  },
} as const;

export const SongWithLyricsQuery = {
  include: {
    lyrics: {
      include: {
        lines: {
          orderBy: {
            orderIndex: 'asc' as const,
          },
        },
      },
    },
  },
} as const;

export const SongWithFullDetailsQuery = {
  include: {
    uploadedBy: true,
    lyrics: {
      include: {
        lines: {
          orderBy: {
            orderIndex: 'asc' as const,
          },
        },
      },
    },
    likedBy: true,
    processingJobs: true,
  },
} as const;