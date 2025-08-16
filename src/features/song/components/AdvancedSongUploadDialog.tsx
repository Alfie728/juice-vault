"use client";

import type { Song } from "~/domain/song/schema";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Image as ImageIcon, Loader2, Music, Upload, X } from "lucide-react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "~/features/shared/components/ui/button";
import { Checkbox } from "~/features/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/features/shared/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/features/shared/components/ui/form";
import { Input } from "~/features/shared/components/ui/input";
import { Progress } from "~/features/shared/components/ui/progress";
import { useSongUpload } from "~/features/shared/hooks/use-song-upload";
import { useTRPC } from "~/trpc/react";

const uploadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  artist: z.string(),
  audioFile: z.instanceof(File).optional(),
  coverFile: z.instanceof(File).optional(),
  duration: z.number().optional(),
  isUnreleased: z.boolean(),
  generateLyrics: z.boolean(),
});

type UploadFormData = z.infer<typeof uploadSchema>;

export function AdvancedSongUploadDialog() {
  const [open, setOpen] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { uploadSong, isUploading, uploadProgress } = useSongUpload();

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      title: "",
      artist: "Juice WRLD",
      isUnreleased: true,
      generateLyrics: false,
    },
  });

  // We'll handle lyrics generation after successful upload
  const handleUploadSuccess = async (song: Song) => {
    if (form.getValues("generateLyrics")) {
      // Trigger lyrics generation in background
      await generateLyrics.mutateAsync({
        songId: song.id,
        audioUrl: song.audioUrl,
        songTitle: song.title,
        artist: song.artist,
        duration: song.duration ?? undefined,
      });
    }

    // Invalidate queries
    await queryClient.invalidateQueries({
      queryKey: trpc.song.list.queryOptions().queryKey,
    });

    // Reset form and close dialog
    setOpen(false);
    form.reset();
    setAudioFile(null);
    setCoverFile(null);
    setAudioPreview(null);
    setCoverPreview(null);
  };

  const generateLyrics = useMutation(
    trpc.lyrics.generateLyrics.mutationOptions({
      onSuccess: () => {
        toast.info("Lyrics generation started in background");
      },
    })
  );

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("audio/")) {
        toast.error("Please select an audio file");
        return;
      }
      setAudioFile(file);
      setAudioPreview(URL.createObjectURL(file));

      // Extract duration from audio file
      const audio = new Audio(URL.createObjectURL(file));
      audio.addEventListener("loadedmetadata", () => {
        form.setValue("duration", Math.round(audio.duration));
      });
    }
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: UploadFormData) => {
    try {
      if (!audioFile) {
        toast.error("Please select an audio file");
        return;
      }

      // Upload song using the consolidated upload flow
      const song = await uploadSong({
        audioFile,
        coverFile: coverFile ?? undefined,
        metadata: {
          title: data.title,
          artist: data.artist,
          duration: data.duration,
          isUnreleased: data.isUnreleased,
        },
      });

      // Handle success (lyrics generation, etc.)
      await handleUploadSuccess(song);
    } catch (error) {
      console.error("Upload error:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="h-4 w-4" />
          Upload Song
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload New Song</DialogTitle>
          <DialogDescription>
            Upload an unreleased Juice WRLD track with audio file and cover art
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Title Field */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Song Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter song title..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Artist Field */}
            <FormField
              control={form.control}
              name="artist"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Artist</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>Default is Juice WRLD</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Audio File Upload */}
            <FormItem>
              <FormLabel>Audio File</FormLabel>
              <FormControl>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioFileChange}
                      className="hidden"
                      id="audio-upload"
                    />
                    <label
                      htmlFor="audio-upload"
                      className="border-input bg-background ring-offset-background hover:bg-accent hover:text-accent-foreground flex h-10 w-full cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm"
                    >
                      <Music className="mr-2 h-4 w-4" />
                      {audioFile ? audioFile.name : "Choose audio file"}
                    </label>
                    {audioFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setAudioFile(null);
                          setAudioPreview(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {audioPreview && (
                    <audio controls className="w-full">
                      <source src={audioPreview} />
                    </audio>
                  )}
                </div>
              </FormControl>
              <FormDescription>
                Upload MP3, WAV, or other audio formats
              </FormDescription>
            </FormItem>

            {/* Cover Art Upload */}
            <FormItem>
              <FormLabel>Cover Art (Optional)</FormLabel>
              <FormControl>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverFileChange}
                      className="hidden"
                      id="cover-upload"
                    />
                    <label
                      htmlFor="cover-upload"
                      className="border-input bg-background ring-offset-background hover:bg-accent hover:text-accent-foreground flex h-10 w-full cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm"
                    >
                      <ImageIcon className="mr-2 h-4 w-4" />
                      {coverFile ? coverFile.name : "Choose cover image"}
                    </label>
                    {coverFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setCoverFile(null);
                          setCoverPreview(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {coverPreview && (
                    <Image
                      src={coverPreview}
                      alt="Cover preview"
                      className="h-32 w-32 rounded-md object-cover"
                    />
                  )}
                </div>
              </FormControl>
              <FormDescription>
                Upload JPEG, PNG, or WebP (max 5MB)
              </FormDescription>
            </FormItem>

            {/* Checkboxes */}
            <FormField
              control={form.control}
              name="isUnreleased"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-y-0 space-x-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Unreleased Track</FormLabel>
                    <FormDescription>
                      Mark this as an unreleased song
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="generateLyrics"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-y-0 space-x-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Generate Lyrics with AI</FormLabel>
                    <FormDescription>
                      Automatically transcribe and sync lyrics
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress.percentage}%</span>
                </div>
                <Progress value={uploadProgress.percentage} />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUploading || !audioFile}>
                {isUploading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isUploading ? "Uploading..." : "Create Song"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
