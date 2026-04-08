import { ApolloServer } from '@apollo/server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import typeDefs from '@/lib/graphql/typeDefs';
import resolvers from '@/lib/graphql/resolvers';

const schema = makeExecutableSchema({ typeDefs, resolvers });
const server = new ApolloServer({ schema });
const startPromise = server.start();

async function handleRequest(req) {
  await startPromise;

  let body = {};
  if (req.method === 'POST') {
    try {
      body = await req.json();
    } catch {
      // empty or non-JSON body
    }
  }

  const url = new URL(req.url);
  const result = await server.executeHTTPGraphQLRequest({
    httpGraphQLRequest: {
      method: req.method,
      headers: { get: (key) => req.headers.get(key) },
      search: url.search,
      body,
    },
    context: async () => ({ req }),
  });

  const responseHeaders = {};
  result.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  if (result.body.kind === 'complete') {
    return new Response(result.body.string, {
      status: result.status ?? 200,
      headers: responseHeaders,
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of result.body.asyncIterator) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: result.status ?? 200,
    headers: responseHeaders,
  });
}

export async function GET(req) {
  return handleRequest(req);
}

export async function POST(req) {
  return handleRequest(req);
}
