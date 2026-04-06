import { ApolloClient, HttpLink, InMemoryCache, split } from "@apollo/client";
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

const browserHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const browserProtocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
const wsProtocol = browserProtocol === 'https:' ? 'wss' : 'ws';
const backendPort = process.env.NEXT_PUBLIC_BACKEND_PORT || '4000';
const defaultHttpUri = `${browserProtocol}//${browserHost}:${backendPort}/graphql`;
const defaultWsUri = `${wsProtocol}://${browserHost}:${backendPort}/subscriptions`;

const httpUri = process.env.NEXT_PUBLIC_GRAPHQL_URL || defaultHttpUri;
const wsUri = process.env.NEXT_PUBLIC_WS_URL || defaultWsUri;
const enableWsDebug = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_WS === 'true';

const httpLink = new HttpLink({
  uri: httpUri,
});

const wsClient = typeof window !== 'undefined'
  ? createClient({
      url: wsUri,
      lazy: true,
      lazyCloseTimeout: 30_000,
      keepAlive: 10000,
      retryAttempts: 100000,
      retryWait: async (retries) => {
        const backoffMs = Math.min(1000 * 2 ** retries, 15000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      },
      shouldRetry: (event) => {
        if (event?.code === 1000 || event?.code === 4401 || event?.code === 4403) {
          return false;
        }
        return true;
      },
      connectionParams: async () => ({}),
      on: {
        connected: () => {
          if (enableWsDebug) console.info('[ws] connected');
        },
        closed: (event) => {
          if (enableWsDebug && event?.code !== 1000) {
            console.warn('[ws] closed', event.code, event.reason || 'no-reason');
          }
        },
        error: (error) => {
          if (enableWsDebug) console.warn('[ws] error', error);
        },
      },
    })
  : null;

const wsLink = wsClient ? new GraphQLWsLink(wsClient) : null;

const splitLink = wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      httpLink,
    )
  : httpLink;

const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Session: {
        fields: {
          players: {
            merge(_existing, incoming) {
              return incoming;
            },
          },
        },
      },
      Query: {
        fields: {
          ongoingMatches: {
            merge(_existing, incoming) {
              return incoming;
            },
          },
          players: {
            merge(_existing, incoming) {
              return incoming;
            },
          },
          courts: {
            merge(_existing, incoming) {
              return incoming;
            },
          },
          sessions: {
            merge(_existing, incoming) {
              return incoming;
            },
          },
        },
      },
    },
  }),
});

export default client;
