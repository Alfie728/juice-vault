"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "~/trpc/react";

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UseS3UploadOptions {
  onSuccess?: (result: { key: string; publicUrl: string }) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: UploadProgress) => void;
}

export function useS3Upload(options?: UseS3UploadOptions) {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
  });
  const [isUploading, setIsUploading] = useState(false);
  const trpc = useTRPC();

  // Mutation to get presigned URL for audio upload
  const getAudioUploadUrl = useMutation(
    trpc.upload.getAudioUploadUrl.mutationOptions()
  );

  // Mutation to get presigned URL for cover upload
  const getCoverUploadUrl = useMutation(
    trpc.upload.getCoverUploadUrl.mutationOptions()
  );

  // Upload audio file
  const uploadAudio = async (file: File) => {
    setIsUploading(true);
    setUploadProgress({ loaded: 0, total: file.size, percentage: 0 });

    try {
      // Step 1: Get presigned URL from backend
      const { uploadUrl, key, publicUrl } = await getAudioUploadUrl.mutateAsync(
        {
          fileName: file.name,
          contentType: file.type || "audio/mpeg",
        }
      );

      // Step 2: Upload file directly to S3 using presigned URL
      await uploadFileToS3(file, uploadUrl);

      // Success
      const result = { key, publicUrl };
      options?.onSuccess?.(result);
      toast.success("Audio file uploaded successfully");
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Upload failed");
      options?.onError?.(err);
      toast.error(err.message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  // Upload cover art
  const uploadCover = async (file: File) => {
    setIsUploading(true);
    setUploadProgress({ loaded: 0, total: file.size, percentage: 0 });

    try {
      // Validate file type
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        throw new Error(
          "Invalid file type. Please upload a JPEG, PNG, or WebP image."
        );
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error("File size too large. Maximum size is 5MB.");
      }

      // Step 1: Get presigned URL from backend
      const { uploadUrl, key, publicUrl } = await getCoverUploadUrl.mutateAsync(
        {
          fileName: file.name,
          contentType: file.type as "image/jpeg" | "image/png" | "image/webp",
        }
      );

      // Step 2: Upload file directly to S3 using presigned URL
      await uploadFileToS3(file, uploadUrl);

      // Success
      const result = { key, publicUrl };
      options?.onSuccess?.(result);
      toast.success("Cover art uploaded successfully");
      return result;
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
  const uploadFileToS3 = async (file: File, uploadUrl: string) => {
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
          setUploadProgress(progress);
          options?.onProgress?.(progress);
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

  // Delete a file
  const deleteFile = useMutation({
    ...trpc.upload.deleteFile.mutationOptions(),
    onSuccess: () => {
      toast.success("File deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    uploadAudio,
    uploadCover,
    deleteFile: deleteFile.mutate,
    isUploading,
    uploadProgress,
    isGettingUrl: getAudioUploadUrl.isPending || getCoverUploadUrl.isPending,
  };
}
