# Backend GraphQL

##### Tech used

Prisma, PostgreSQL, GraphQL, Apollo Server, Docker Compose

##### How to build

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

##### Plan

- Clone from backend-graphql from my other repo
- Need to setup Prisma configurations first
- Setup some Model for Prisma
- Implement Apollo server
