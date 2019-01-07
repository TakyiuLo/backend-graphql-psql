# Backend GraphQL

#### Tech used

Prisma, PostgreSQL, GraphQL, Apollo Server, Docker Compose

#### How to run

- (local) Make sure Docker is running first
- run `docker-compose up -d` in `/config` directory
- set `PRISMA_URL` to your .env, usually it is `http://localhost:4742`
- set `PRISMA_SECRET` to your .env, anything is fine
- run `prisma deploy`
- run `docker-compose up -d` in `/config` directory
- (optional) add `PORT` to change default port(4741) for application
- (optional) change docker-compose for Prisma port(4742) if required
- run `npm run start` to start the app

#### Explanations (notes)

From my understanding, (unorder list)

- Using docker-compose to compose tasks (To host the db, prisma server locally)
- So the application have three major services, App(:4741), Prisma(:4742), and
  PSQL(:5432)
- Prisma stuff are Database connection and Model
- App stuff are logical Graphql, Prisma, Resolvers, Mutations, Query
- `prisma.yml` must be on the root directory same as `.graphqlconfig.yml` (don't know why)

```yml
# prisma.yml
# This here will look for schema from .graphqlconfig.yml to get
# prisma.schemaPath for targeted auto-generated path
# Then it will generate the Prisma Schema base on the datamodel.graphql
endpoint: ${env:PRISMA_URL}
secret: ${env:PRISMA_SECRET}
datamodel: config/datamodel.graphql
hooks:
  post-deploy:
    - graphql get-schema --project prisma
    - prisma generate
```

- by default Auth is disable for Prisma Playground if `disableAuth: true` in `prisma.yml` for local development

- The way to test/pass authorization in header is following

```js
{
	"Authorization": "Token token=c5361c8a00612f7c015b2dd287b0f156"
}
```

- To find the owner based on the relationship, you would need to pass the `info`
  to prisma as such:

```js
// INDEX
function getExamples(parent, args, ctx, info) {
  return ctx.prisma.query.examples({}, info)
}
```

- `info` contains information about the query and prisma will understand it. It is a query AST(Abstract Syntax Tree) as such: (basically fetch the response that you wanted)

```js
// only needed owner so fetch for exmaple's owner
prisma.query.example({ where: { id: args.id } }, `{ owner { email } }`)
```

- OK, this is crazy. I found a insane sensitive leak from Prisma. So when you
  make a relation between two model, if you make a query request, you can actually
  also request every information about the other model such as token,
  hashedPassword, etc. This is crazy but make sense. Prisma doesn't handle auth,
  so becareful what they auto-generated. I put a new type to limit the output
  response information for example. And limited the sensitive input.
  Take a look at generated `prisma.graphql` for `ExampleWhereInput`, it have user of `UserWhereInput`, which can query FULL information about user.

```js
// INDEX
function getExamples(parent, args, ctx, info) {
  // we can not use requireToken here because we want it to be openRead while
  // client can't retreive any sensitive information about owner of the example
  // such as token, hashedPassword, etc.
  const where = args.where
  const owner = where && args.where.owner
  const authorizedProperties = ['id', 'email']
  const authorizedArgs = onlyProperties(owner, authorizedProperties)

  if (!authorizedArgs) {
    throw new AuthenticationError()
  }

  return ctx.prisma.query.examples(args, info)
}
```

```GraphQL
type ExampleOwner {
  email: String
}

type SearchExamplePayload {
  id: ID
  title: String
  text: String
  owner: ExampleOwner
}

type Query {
  examples(
    where: ExampleWhereInput
    orderBy: ExampleOrderByInput
    skip: Int
    after: String
    before: String
    first: Int
    last: Int
  ): [SearchExamplePayload]!
  example(id: ID!): SearchExamplePayload!
}
```

- one can use `connect` to update `owner` when creating a new Example. `connect` can be use by whatever is @unique on User. For instance, in below #Model, user have id, email, and token marked as unique, so once can use these to connect to User.

```js
const data = {
  ...example,
  owner: {
    connect: {
      id: user.id
    }
  }
}
```

- one can query stuff like this

```GraphQL
{
  examples(
    where: {
      title: "Me23"
      owner: {
        email: "1@1"
      }
    },
    orderBy: text_ASC
  ) {
    id
    title
    text
    owner {
      email
    }
  }
}
```

- `lib/auth.js` is not in use, since its using `passport`.

- Caching is on for fun

#### Model

One(User) to Many(Examples)

```GraphQL
type User {
  id: ID! @unique
  email: String! @unique
  hashedPassword: String!
  token: String @unique
  examples: [Example!]! # relation to Examples
}

type Example {
  id: ID! @unique
  title: String!
  text: String!
  owner: User # relation to User
}
```

#### Plan

- Clone from backend-graphql from my other repo
- Need to setup Prisma configurations first
- Setup some Model for Prisma
- Implement Apollo server
- Build relation between Model
- Test Prisma and Apollo
- Make sure it does what it suppose to do
- Trail and errors, again and again
- Might import RedisDB as caching or just a regualar caching

#### How to deploy

Using Prisma Instant Deploy to heroku. The few main parts are this, database and Prisma server together, and then your backend application. Meaning you will need atleast two Heroku server.

1. Make an account of Prisma Cloud, and heroku
2. go to server and create one, name of your choice, heroku will show up with an almost same name
3. Once the server status said "Healthy", sometimes if you clicked on the server, it might say status is "booting"...etc(Prisma Cloud is still a very new service). But as long as the list of servers page said its "Healthy", its fine. BTW, for now Prisma Instant Deploy still only deploy with PSQL on Heroku.
4. Next, we'll set up the service. When you did the Prisma Server, Prisma auto setup their layer. Click new service and copy the prisma login command and run it in your terminal.
5. Now, in you .env file change PRISMA_URL from http://localhost:4742 to your heroku domain like this: `https://<app-name>.herokuapp.com/<service-name>/<stage>`. `<stage>` could be `production` or `development`. You don't have to give it a name or stage, but it will set it to `default` by default
6. Now since command `prisma deploy` required a .env file, run `prisma deploy --env-file .env`. (make sure you enable auth in `prisma.yml`) This is going to upload the generated schema to your server with auth.
7. Setup a `PRISMA_SECRET` on Heroku, and restart Heroku. You should test your playground on Heroku. When you go to your prisma endpoint playground, any unauthorized request should say something like "Your token is invalid."
8. Now setup you backend application like you would normally would. Set up `PRISMA_URL`, `PRISMA_SECRET`, `SECRET_KEY`, `CLIENT_ORIGIN` environemnt variables, and push to heroku.
9. If you need Apollo Engine too, turn on introspection, and engine in server.js. Then paste you Apollo API in .env as `ENGINE_API_KEY` and your heroku config var. Then run `npx apollo service:push --endpoint=<your-heroku-graphql-endpoint>`.
10. So in total you should have 5 or 4 environment variables on your app heroku, and another 5 environment variables on Prisma heroku. (Deploy Prisma should auto set 4 environment variables to heroku)
11. (OH BTW don't forget to remove/comment users query resolver on production)!!!
12. Have fun!!!
