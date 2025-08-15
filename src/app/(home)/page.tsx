import { Suspense } from "react";
import { LoadingSpinner } from "~/features/shared/components/LoadingSpinner";
import { JuiceVaultContent } from "./_components/JuiceVaultContent";

export default function Home() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <JuiceVaultContent />
    </Suspense>
  );
}
