'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-page">
      <h1>Something needs a fresh start.</h1>
      <p>Your saved data is still in your workspace.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
