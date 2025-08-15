"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload } from "lucide-react";
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
import { useTRPC } from "~/trpc/react";

const uploadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  artist: z.string(),
  audioUrl: z.string().url("Must be a valid URL"),
  coverArtUrl: z.string().url().optional().or(z.literal("")),
  duration: z.number().optional(),
  isUnreleased: z.boolean(),
  generateLyrics: z.boolean(),
});

type UploadFormData = z.infer<typeof uploadSchema>;

export function SongUploadDialog() {
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      title: "",
      artist: "Juice WRLD",
      audioUrl: "",
      coverArtUrl: "",
      isUnreleased: true,
      generateLyrics: false,
    },
  });

  const createSong = useMutation({
    ...trpc.song.create.mutationOptions(),
    onSuccess: async (song) => {
      toast.success("Song uploaded successfully!");

      if (form.getValues("generateLyrics")) {
        await generateLyrics.mutateAsync({
          songId: song.id,
          audioUrl: song.audioUrl,
          songTitle: song.title,
          artist: song.artist,
          duration: song.duration ?? undefined,
        });
      }

      // Invalidate the song list query
      await queryClient.invalidateQueries({
        queryKey: trpc.song.list.queryOptions().queryKey,
      });

      setOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to upload song");
    },
  });

  const generateLyrics = useMutation({
    ...trpc.lyrics.generateLyrics.mutationOptions(),
    onSuccess: () => {
      toast.info("Lyrics generation started in background");
    },
  });

  const onSubmit = (data: UploadFormData) => {
    const { generateLyrics: _shouldGenerateLyrics, ...songData } = data;
    createSong.mutate({
      ...songData,
      coverArtUrl: songData.coverArtUrl ?? undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="h-4 w-4" />
          Upload Song
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Upload New Song</DialogTitle>
          <DialogDescription>
            Add an unreleased Juice WRLD track to the vault
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            <FormField
              control={form.control}
              name="audioUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Audio URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com/song.mp3"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Direct link to the audio file
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="coverArtUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cover Art URL (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com/cover.jpg"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (seconds)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="180"
                      {...field}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      Automatically generate and sync lyrics
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createSong.isPending}>
                {createSong.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Upload
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
