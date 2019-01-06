/*
 * replaceID
 *   #function: replace id to _id or _id to id
 *   @params: args
 *   @returns: a new object with replaced <id>
 */
function replaceID (args) {
  let query = { ...args }

  if (args.id) {
    query._id = args.id
    delete query.id
  } else if (args._id) {
    query.id = args._id
    delete query._id
  }
  return query
}

/*
 * getFiles
 *   #function: synchronously get all files with extension under a directory
 *   @params: directory_path, extension
 *   @returns: a list of file names
 */
const fs = require('fs')
const path = require('path')

function getFiles (pathDir, ext) {
  const dirPath = path.resolve(pathDir)

  return fs
    .readdirSync(dirPath)
    .filter(file => path.extname(file).toLowerCase() === ext)
}

/*
 * wrapPopProperty
 *   #function: remove the property from an object and wrap the result with
 *              the removed property
 *   @params: object, property, referenceType(default: false)
 *   @returns: a new object wrapped with the removed property or nothing
 */
function wrapPopProperty (object, property, referenceType) {
  const temp = {
    [property]: object[property],
    data: { ...object }
  }
  referenceType && Object.assign(object, temp)

  delete temp.data[property]

  return !referenceType && temp
}

/*
 * removeEmptyStringProperties
 *   #function: remove the property from an object that are empty strings
 *   @params: object, referenceType(default: false)
 *   @returns: a new object with removed properties if user want it to be
 *             a shallow clone object
 */
function removeEmptyStringProperties (object, referenceType = false) {
  // the client will often send empty strings for parameters that it does
  // not want to update. We delete any key/value pair where the value is
  // an empty string before updating
  const temp = referenceType ? object : { ...object }

  Object.keys(temp).forEach(key => {
    if (temp[key] === '') {
      delete temp[key]
    }
  })

  return !referenceType && temp
}

/*
 * pLog
 *   #function: print out obj, use in the `.then` chain
 *   @params: obj
 *   @returns: obj
 */
function plog (obj) {
  console.log(obj)
  return obj
}

/*
 * isPropertyAllow
 *   #function: Test if every properties are allow. By default, it will do a
 *   weak compare. exact=false means a weak compare
 *   For instance, given
 *     const object = { "id_not": "0" }
 *     const authorizedProperties = ["id"]
 *   , it will return true
 *
 *   @params: object, authorizedProperties(Array of Strings), exact(default: false)
 *   @returns: obj
 */
function isPropertyAllow (object, authorizedProperties, exact = false) {
  return Object.keys(object).every(property => {
    for (let i = 0; i < authorizedProperties.length; i++) {
      let test = exact
        ? property === authorizedProperties[i]
        : property.includes(authorizedProperties[i])
      if (test) {
        return true
      }
    }
    return false
  })
}

/*
 * requireToken
 *   #function: get User, and pass user into context
 *   @params: resolver, context
 *   @returns: return whatever the resolver returns
 */
const handle = require('../lib/error_handler')
const { handleUser, BadParamsError } = require('../lib/custom_errors')

function requireToken (resolver, [parent, args, ctx, info]) {
  const { req, prisma } = ctx
  const auth = req.headers.authorization
  // check if authorization exists
  if (!auth) {
    throw new BadParamsError()
  }
  const [authType, token] = auth.split(' ')

  console.log(`Using AuthType: ${authType} with resolver: ${resolver.name}`)

  // not using info for nested user's relationships
  return prisma.query
    .user({
      where: {
        token
      }
    })
    .then(handleUser)
    .then(user => (ctx.req.user = user))
    .then(() => resolver(parent, args, ctx, info))
    .catch(handle)
}

module.exports = {
  replaceID,
  getFiles,
  wrapPopProperty,
  removeEmptyStringProperties,
  isPropertyAllow,
  plog,
  requireToken
}
