// Apollo server with the entire schema
const { ApolloServer } = require('apollo-server-express')
const { Prisma } = require('prisma-binding')
const schema = require('./app/schema')

// require necessary NPM packages
const express = require('express')
const cors = require('cors')

// require route files
// Not used

// load secret keys for signing tokens from .env
const dotenv = require('dotenv')
dotenv.config()

// Set the key based on the current environemnt
// Set to secret key base test if in test
if (process.env.TESTENV) {
  process.env.KEY = process.env.SECRET_KEY_BASE_TEST
  // Set to secret key base development if not test and no key present
  // process.env.KEY is present in production and set through heroku
} else if (!process.env.KEY) {
  process.env.KEY = process.env.SECRET_KEY_BASE_DEVELOPMENT
}

// instantiate express application object
const app = express()

// set CORS headers on response from this API using the `cors` NPM package
// `CLIENT_ORIGIN` is an environment variable that will be set on Heroku
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:7165' }))

// define port for API to run on
const port = process.env.PORT || 4741

// this middleware makes it so the client can use the Rails convention
// of `Authorization: Token token=<token>` OR the Express convention of
// `Authorization: Bearer <token>`
app.use((req, res, next) => {
  if (req.headers.authorization) {
    const auth = req.headers.authorization
    // if we find the Rails pattern in the header, replace it with the Express
    // one before `passport` gets a look at the headers
    req.headers.authorization = auth.replace('Token token=', 'Bearer ')
  }
  next()
})

// Prisma
const prisma = new Prisma({
  // where to generate
  typeDefs: 'app/generated/prisma.graphql',
  // Prisma endpoint
  endpoint: process.env.PRISMA_URL
  // secret: process.env.PRISMA_SECRET
  // debug: false
})

// APOLLO SERVER HERE
// this will auto make a route to /graphql
// context: it can be api_keys, secrets, database, authentication
const server = new ApolloServer({
  // enable playground and introspection if necessary (production)
  // playground: true,
  introspection: true,
  engine: {
    apiKey: process.env.ENGINE_API_KEY
  },
  tracing: true,
  // cacheControl: {
  //   defaultMaxAge: 60 // seconds
  // },
  // stop backtracing at responses on production
  debug: !process.env.TESTENV,
  // below are necessary properties
  schema,
  context: req => ({
    // - If you use passport, you will need to use another route to authenticate
    // user and pass the user to /graphql
    ...req,
    // Prisma Server, Prisma will connect to database
    prisma
  }),
  // having this will disable the warning when npm run server
  path: '/graphql'
})

// apply ApolloServer as middleware
server.applyMiddleware({ app })

// run API on designated port (4741 in this case)
app.listen(port, () => {
  console.log('listening on port ' + port)
})

// needed for testing
module.exports = app
