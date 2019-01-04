# Backend GraphQL

##### Tech used

Prisma, PostgreSQL, GraphQL, Apollo Server, Docker Compose

##### How to run

- (local) Make sure Docker is running first
- run `docker-compose up -d` to setup the database in docker (make sure you are
  in the `/config` directory)
- run `prisma deploy` on root to "deploy"(generate) the schema we need for our
  app
- run `npm run start` to start the app

##### Explanations (notes)

From my understanding, (unorder list)

- Using docker-compose to compose tasks (To host the prisma server)
- So the application have three major services, App(:4741), Prisma(:4742), and
  PSQL(:5432)
- Prisma stuff are database configurations, connection, model, typedefs
- App stuff logical graphql, prisma, resolvers, mutations, query
- prisma.yml must be on the root directory same as .graphqlconfig.yml (don't know why)

```yml
# prisma.yml
# This here will look for schema from .graphqlconfig.yml to get
# prisma.schemaPath for targeted auto-generated path
# Then it will generate the Prisma Schema base on the datamodel.graphql
endpoint: ${env:PRISMA_URL}
datamodel: config/datamodel.graphql
hooks:
  post-deploy:
    - graphql get-schema --project prisma
    - prisma generate
```

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

- `info` contains information about the query and prisma will understand it. It is a query AST(Abstract Syntax Tree) as such: (basically the result that you wanted)

```js
prisma.query.example({ where: { id: args.id } }, `{ owner { email } }`)
```

- OK, this is crazy. I found a insane sensitive leak from Prisma. So when you
  make a relation between two model, if you make a query request, you can actually
  also request every information about the other model such as token,
  hashedPassword, etc. This is crazy but make sense. Prisma doesn't handle auth,
  so becareful what they auto-generated. I put a new type to limit the output
  response information for example. And limited the sensitive input.

- one can use `connect` to update `owner` when creating a new Example. `connect` can be use by whatever is @unique on User. For instance, in below #Model, user have id, email, and token marked as unique, so once can use these to connect to User.

##### Model

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

##### Plan

- Clone from backend-graphql from my other repo
- Need to setup Prisma configurations first
- Setup some Model for Prisma
- Implement Apollo server
- Build relation between Model
- Test Prisma and Apollo
- Make sure it does what it suppose to do
- Trail and errors, again and again

##### How to deploy

Using Prisma Instant Deploy to heroku. The few main parts are this, database and Prisma server together, and your backend application. Meaning you will need atleast two Heroku server.

1. Make an account of Prisma Cloud, and heroku
2. go to server and create one, name of your choice, heroku will show up with an almost same name
3. Once the server status said "Healthy", sometimes if you clicked on the server, it might say status is "booting"...etc(Prisma Cloud is still a very new service). But as long as the list of servers page said its "Healthy", its fine. BTW, for now Prisma Instant Deploy still only deploy with PSQL on Heroku.
4. Next, we'll set up the service. When you did the Prisma Server, Prisma auto setup their layer. Click new service and copy the prisma login command and run it in your terminal.
5. Now, in you .env file change PRISMA_URL from http://localhost:4742 to your heroku domain like this: `https://<app-name>.herokuapp.com/<service-name>/<stage>`. `<stage>` could be `production` or `development`. You don't have to give it a name or stage, but it will set it to `default` by default
6. Now since command `prisma deploy` required a .env file, run `prisma deploy --env-file .env`. This is going to upload the generated schema to your server.
7. Now setup you backend application like you would normally would. Set up `PRISMA_URL`, `SECRET_KEY`, `CLIENT_ORIGIN` environemnt variables, and push to heroku.
8. If you need Apollo Engine too, turn on introspection, and engine in server.js. Then paste you Apollo API in .env as `ENGINE_API_KEY` and your heroku config var. Then run `npx apollo service:push --endpoint=<your-heroku-graphql-endpoint>`
9. (OH BTW don't forget to remove/comment users query resolver on production)!!!
10. Have fun!!!
