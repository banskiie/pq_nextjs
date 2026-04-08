'use client';

import { useAppData } from '@/lib/AppDataContext';
import RecordsPage from '@/components/pages/RecordsPage';

export default function RecordsRoute() {
  const { handleViewSession } = useAppData();
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-6 pb-14 pt-20 lg:pt-4">
      <RecordsPage onViewSession={handleViewSession} />
    </main>
  );
}
