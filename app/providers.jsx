'use client';

import { ApolloProvider } from '@apollo/client/react';
import client from '@/lib/apollo';
import { AppDataProvider } from '@/lib/AppDataContext';
import GlobalModals from '@/components/GlobalModals';

export default function Providers({ children }) {
  return (
    <ApolloProvider client={client}>
      <AppDataProvider>
        {children}
        <GlobalModals />
      </AppDataProvider>
    </ApolloProvider>
  );
}
