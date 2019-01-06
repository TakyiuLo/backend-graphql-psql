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
const { requireToken } = require('../custom-fn')

// SIGN UP
async function signUp (parent, args, ctx, info) {
  const { prisma } = ctx
  const { credentials } = args
  const { email, password, password_confirmation } = credentials
  const checkPassword = () => {
    // eslint-disable-next-line
    if (password !== password_confirmation) {
      throw new BadParamsError()
    }
  }
  // start a promise chain, so that any errors will pass to `handle`
  return (
    Promise.resolve(credentials)
      // check if passwords are same
      .then(checkPassword)
      // generate a hash from the provided password, returning a promise
      .then(() => bcrypt.hash(password, bcryptSaltRounds))
      // match object data structure
      .then(hashedPassword => ({
        data: {
          email,
          hashedPassword
        }
      }))
      // create user with provided email and hashed password
      .then(data => prisma.mutation.createUser(data))
      // pass any errors along to the error handler
      .catch(handle)
  )
}

// SIGN IN
async function signIn (parent, args, ctx, info) {
  const { prisma } = ctx
  const { credentials } = args
  const { email, password } = credentials
  const where = { email } // used email to verify user, beacuse email is unique

  return prisma.query
    .user({ where })
    .then(user => {
      if (!user) {
        throw new BadParamsError()
      }
      // `bcrypt.compare` will return true if the result of hashing `password`
      // is exactly equal to the hashed password stored in the DB
      return bcrypt.compare(password, user.hashedPassword)
    })
    .then(correctPassword => {
      // if the passwords matched
      if (!correctPassword) {
        // throw an error to trigger the error handler and end the promise chain
        // this will send back 422 and a message about sending wrong parameters
        throw new BadParamsError()
      }
    })
    .then(() => {
      // the token will be a 16 byte random hex string
      const token = crypto.randomBytes(16).toString('hex')
      const data = { token }
      // save the token to the DB as a property on user
      return prisma.mutation.updateUser({ where, data })
    })
    .catch(handle)
}

async function changePassword (parent, args, ctx, info) {
  const { prisma, req } = ctx
  const { passwords } = args
  const { user } = req
  const { id } = user
  const where = { id }

  return (
    Promise.resolve(user)
      .then(() => bcrypt.compare(passwords.old, user.hashedPassword))
      .then(correctPassword => {
        // throw an error if the
        // the old password was wrong
        // or passwords are same,
        // or new password is missing(an empty string),
        if (
          !correctPassword ||
          passwords.new === passwords.old ||
          !passwords.new
        ) {
          throw new BadParamsError()
        }
      })
      // hash the new password
      .then(() => bcrypt.hash(passwords.new, bcryptSaltRounds))
      .then(hashedPassword => ({ hashedPassword }))
      .then(data => prisma.mutation.updateUser({ where, data }))
      .then(() => ({
        status: '204',
        message: 'Successfully Changed Password'
      }))
      .catch(handle)
  )
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
  return prisma.mutation
    .updateUser({ where, data })
    .then(() => ({
      status: '204',
      message: 'Successfully Signed Out'
    }))
    .catch(handle)
}

const usersResolver = {
  Query: {
    // remove this query when in production
    users: (parent, args, ctx, info) => ctx.prisma.query.users(args, info)
  },
  Mutation: {
    signUp,
    signIn,
    changePassword: (...args) => requireToken(changePassword, args),
    signOut: (...args) => requireToken(signOut, args)
  }
}

module.exports = usersResolver
