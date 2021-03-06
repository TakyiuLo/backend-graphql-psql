// Since GraphQL is pretty new, there are many tools from different library
const path = require('path')
const { makeExecutableSchema, mergeSchemas } = require('graphql-tools')
const { importSchema } = require('graphql-import')

// make executable schema
function makeSchema (typeDefName, resolverName) {
  const typeDefs = importSchema(path.join(__dirname, `typeDefs/${typeDefName}`))
  const resolvers = require(`./resolvers/${resolverName}`)
  // Use this to remove warning about type 'Node'
  // 'Node' is a type that got auto generated by Prisma
  // Also using schema instead of typeDefs and resolvers directly will remove
  // the warning
  const resolverValidationOptions = { requireResolversForResolveType: false }
  return makeExecutableSchema({
    typeDefs,
    resolvers,
    resolverValidationOptions
  })
}

// list of schemas that wanted to merge
const userSchema = makeSchema('users.graphql', 'users-resolver')
const exampleSchema = makeSchema('examples.graphql', 'examples-resolver')

// merge schemas
const schema = mergeSchemas({
  schemas: [userSchema, exampleSchema]
})

// pass schema directly to apollo-server
module.exports = schema
