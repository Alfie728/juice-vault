import { Suspense } from "react";

import { HydrateClient, prefetch, trpc } from "~/trpc/server";

import { JuiceVaultContent } from "./_components/JuiceVaultContent";

export default async function Home() {
  // Prefetch the songs list on the server
  prefetch(trpc.song.list.queryOptions());

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HydrateClient>
        <JuiceVaultContent />
      </HydrateClient>
    </Suspense>
  );
}
