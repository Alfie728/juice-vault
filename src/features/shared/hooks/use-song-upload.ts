"use client";

import type { Song } from "~/domain/song/schema";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "~/trpc/react";

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UseSongUploadOptions {
  onSuccess?: (song: Song) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: UploadProgress) => void;
}

export function useSongUpload(options?: UseSongUploadOptions) {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
  });
  const [isUploading, setIsUploading] = useState(false);

  const trpc = useTRPC();
  const uploadMutation = useMutation(trpc.song.upload.mutationOptions());
  const completeUploadMutation = useMutation(
    trpc.song.completeUpload.mutationOptions()
  );

  const uploadSong = async ({
    audioFile,
    coverFile,
    metadata,
  }: {
    audioFile: File;
    coverFile?: File;
    metadata: {
      title: string;
      artist?: string;
      duration?: number;
      releaseDate?: Date;
      isUnreleased?: boolean;
    };
  }) => {
    setIsUploading(true);
    const totalSize = audioFile.size + (coverFile?.size ?? 0);
    setUploadProgress({ loaded: 0, total: totalSize, percentage: 0 });

    try {
      // Step 1: Get presigned URLs from the song.upload endpoint
      const uploadData = await uploadMutation.mutateAsync({
        title: metadata.title,
        artist: metadata.artist ?? "Juice WRLD",
        duration: metadata.duration,
        releaseDate: metadata.releaseDate,
        isUnreleased: metadata.isUnreleased ?? true,
        audioFile: {
          fileName: audioFile.name,
          contentType: audioFile.type || "audio/mpeg",
        },
        coverFile: coverFile
          ? {
              fileName: coverFile.name,
              contentType: coverFile.type as
                | "image/jpeg"
                | "image/png"
                | "image/webp",
            }
          : undefined,
      });

      // Step 2: Upload files to S3 using presigned URLs
      const uploadPromises: Promise<void>[] = [];

      // Upload audio file
      uploadPromises.push(
        uploadFileToS3(
          audioFile,
          uploadData.uploadUrls.audio.uploadUrl,
          (progress) => {
            const totalProgress = {
              loaded: progress.loaded + (coverFile ? 0 : 0),
              total: totalSize,
              percentage: Math.round(
                ((progress.loaded + (coverFile ? 0 : 0)) / totalSize) * 100
              ),
            };
            setUploadProgress(totalProgress);
            options?.onProgress?.(totalProgress);
          }
        )
      );

      // Upload cover file if provided
      if (coverFile && uploadData.uploadUrls.cover) {
        let audioLoaded = 0;
        uploadPromises.push(
          uploadFileToS3(
            coverFile,
            uploadData.uploadUrls.cover.uploadUrl,
            (progress) => {
              const totalProgress = {
                loaded: audioLoaded + progress.loaded,
                total: totalSize,
                percentage: Math.round(
                  ((audioLoaded + progress.loaded) / totalSize) * 100
                ),
              };
              setUploadProgress(totalProgress);
              options?.onProgress?.(totalProgress);
            }
          ).then(() => {
            audioLoaded = audioFile.size;
          })
        );
      }

      // Wait for all uploads to complete
      await Promise.all(uploadPromises);

      // Step 3: Complete the upload by creating the song in the database
      const song = await completeUploadMutation.mutateAsync({
        title: metadata.title,
        artist: metadata.artist ?? "Juice WRLD",
        audioUrl: uploadData.uploadUrls.audio.publicUrl,
        duration: metadata.duration,
        coverArtUrl: uploadData.uploadUrls.cover?.publicUrl,
        releaseDate: metadata.releaseDate,
        isUnreleased: metadata.isUnreleased ?? true,
        audioKey: uploadData.uploadUrls.audio.key,
        coverKey: uploadData.uploadUrls.cover?.key ?? undefined,
      });

      // Success
      options?.onSuccess?.(song);
      toast.success("Song uploaded successfully");
      return song;
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Upload failed");
      options?.onError?.(err);
      toast.error(err.message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  // Helper function to upload file to S3
  const uploadFileToS3 = async (
    file: File,
    uploadUrl: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = {
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
          };
          onProgress?.(progress);
        }
      });

      // Handle completion
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      // Handle errors
      xhr.addEventListener("error", () => {
        reject(new Error("Network error during upload"));
      });

      // Open connection and send
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });
  };

  return {
    uploadSong,
    isUploading,
    uploadProgress,
  };
}
