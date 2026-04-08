import { ApolloClient, from, HttpLink, InMemoryCache } from '@apollo/client';
import { onError } from '@apollo/client/link/error';

const httpLink = new HttpLink({
  uri: '/api/graphql',
});

const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors?.length) {
    graphQLErrors.forEach((error) => {
      console.error(`[Apollo][${operation.operationName || 'anonymous'}] GraphQL error:`, error.message);
    });
  }

  if (networkError) {
    console.error(`[Apollo][${operation.operationName || 'anonymous'}] Network error:`, networkError);
  }
});

const splitLink = from([errorLink, httpLink]);

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
