// we'll use this to intercept any errors that get thrown and send them
// back to the client with the appropriate status code
const handle = require('../../lib/error_handler')

// this is a collection of methods that help us detect situations when we need
// to throw a custom error
const customErrors = require('../../lib/custom_errors')

// we'll use this function to send 404 when non-existant document is requested
const { handle404 } = customErrors
// we'll use this function to send 401 when a user tries to modify a resource
// that's owned by someone else
const { requireOwnership } = customErrors
// we'lll use AuthenticationError from ApolloServer to handle unauthorized action
const { AuthenticationError } = require('apollo-server-express')

// requireToken also mean a resolver is 'Protected'
const {
  requireToken,
  removeEmptyStringProperties,
  arePropertiesAllowed
} = require('../custom-fn')

// INDEX
function getExamples (parent, args, ctx, info) {
  // we can not use requireToken here because we want it to be openRead while
  // client can't retreive any sensitive information about owner
  // such as token, hashedPassword, etc.
  const where = args.where
  const owner = where && args.where.owner
  const authorizedProperties = ['id', 'email']
  const isAuthorized = arePropertiesAllowed(owner, authorizedProperties)

  if (!isAuthorized) {
    throw new AuthenticationError()
  }

  return ctx.prisma.query.examples(args, info)
}

// SHOW
function getExample (parent, args, ctx, info) {
  const { prisma } = ctx
  const { where } = args

  return prisma.query
    .example({ where }, info)
    .then(handle404)
    .catch(handle)
}

// CREATE
function createExample (parent, args, ctx, info) {
  const { prisma, req } = ctx
  const { user } = req
  const { example } = args

  // set owner of new example to be current user
  const data = {
    ...example,
    owner: {
      connect: {
        id: user.id
      }
    }
  }

  return prisma.mutation.createExample({ data }, info).catch(handle)
}

// UPDATE
function updateExample (parent, args, ctx, info) {
  const { prisma, req } = ctx
  let { where, data } = args

  return prisma.query
    .example({ where }, info)
    .then(res => requireOwnership(req, res))
    .then(() => removeEmptyStringProperties(data, true)) // true for referencing
    .then(() => prisma.mutation.updateExample({ where, data }, info))
    .catch(handle)
}

// DESTROY
function deleteExample (parent, args, ctx, info) {
  const { prisma, req } = ctx
  const { where } = args

  // passing a custom query is important because if you pass `info`, prisma won't
  // do it because its looking for a different type, Response, that defined in
  // our schema
  return prisma.query
    .example({ where }, `{ owner { id } }`) // get the owner of an example
    .then(handle404)
    .then(res => requireOwnership(req, res))
    .then(() => prisma.mutation.deleteExample({ where }, info))
    .then(() => ({
      status: '204',
      message: 'Successfully Deleted'
    }))
    .catch(handle)
}

const examplesResolver = {
  Query: {
    examples: getExamples,
    example: getExample
  },
  Mutation: {
    createExample: (...args) => requireToken(createExample, args),
    updateExample: (...args) => requireToken(updateExample, args),
    deleteExample: (...args) => requireToken(deleteExample, args)
  }
}

module.exports = examplesResolver
