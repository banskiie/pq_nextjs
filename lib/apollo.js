import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';

const httpLink = new HttpLink({
  uri: '/api/graphql',
});

const splitLink = httpLink;

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
