// custom errors and handler
const handle = require('../../lib/error_handler')
const { BadParamsError } = require('../../lib/custom_errors')

// jsonwebtoken docs: https://github.com/auth0/node-jsonwebtoken
const crypto = require('crypto')
// bcrypt docs: https://github.com/kelektiv/node.bcrypt.js
const bcrypt = require('bcrypt')

// see above for explanation of "salting", 10 rounds is recommended
const bcryptSaltRounds = 10

// custom functions
const { requireToken, response, thrower } = require('../custom-fn')

// SIGN UP
async function signUp (parent, args, ctx, info) {
  const { prisma } = ctx
  const { credentials } = args
  let { email, password, password_confirmation } = credentials
  // check if passwords are same
  // eslint-disable-next-line
  if (password !== password_confirmation) thrower(BadParamsError)
  // turn all emails to lowercase
  email = email.toLowerCase()
  // generate a hash from the provided password, returning a promise
  const hashedPassword = await bcrypt.hash(password, bcryptSaltRounds)
  // match object data structure
  const data = { email, hashedPassword }
  // create user with provided email and hashed password
  return prisma.mutation.createUser({ data }).catch(handle)
}

// SIGN IN
async function signIn (parent, args, ctx, info) {
  const { prisma } = ctx
  const { credentials } = args
  let { email, password } = credentials
  email = email.toLowerCase()
  const where = { email } // used email to verify user, beacuse email is unique
  const throwBadParams = () => thrower(BadParamsError)

  // check if for user exist, and retreive user
  const user = await prisma.query.user({ where }).catch(throwBadParams)
  // `bcrypt.compare` will return true if the result of hashing `password`
  // is exactly equal to the hashed password stored in the DB
  const correctPassword = await bcrypt.compare(password, user.hashedPassword)
  if (!correctPassword) throwBadParams()
  // the token will be a 16 byte random hex string
  const token = crypto.randomBytes(16).toString('hex')
  const data = { token }
  // save the token to the DB as a property on user
  return prisma.mutation.updateUser({ where, data }).catch(handle)
}

async function changePassword (parent, args, ctx, info) {
  const { prisma, req } = ctx
  const { passwords } = args
  const { user } = req
  const { id } = user
  const where = { id }
  const throwBadParams = () => thrower(BadParamsError)
  const pwd = passwords

  // `bcrypt.compare` will return true if the result of hashing `password`
  // is exactly equal to the hashed password stored in the DB
  const correctPassword = await bcrypt.compare(pwd.old, user.hashedPassword)
  // throw an error if the
  // the old password was wrong
  // or passwords are same,
  // or new password is missing(an empty string),
  if (!correctPassword || pwd.new === pwd.old || !pwd.new) throwBadParams()
  // generate a hash from the provided password, returning a promise
  const hashedPassword = await bcrypt.hash(pwd.new, bcryptSaltRounds)
  const data = { hashedPassword }
  prisma.mutation.updateUser({ where, data }).catch(handle)
  return response('204', 'Successfully Changed Password')
}

async function signOut (parent, args, ctx, info) {
  const { prisma, req } = ctx
  const { user } = req
  const { id } = user
  const where = { id }

  // create a new random token for the user, invalidating the current one
  const token = crypto.randomBytes(16).toString()
  const data = { token }
  // save the token and respond with 204
  prisma.mutation.updateUser({ where, data }).catch(handle)
  return response('204', 'Successfully Signed Out')
}

const usersResolver = {
  Query: {
    // remove this query when in production
    // users: (parent, args, ctx, info) => ctx.prisma.query.users(args, info)
  },
  Mutation: {
    signUp,
    signIn,
    changePassword: (...args) => requireToken(changePassword, args),
    signOut: (...args) => requireToken(signOut, args)
  }
}

module.exports = usersResolver
