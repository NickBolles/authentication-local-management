
const errors = require('@feathersjs/errors');
const makeDebug = require('debug');
const ensureObjPropsValid = require('./helpers/ensure-obj-props-valid');
const ensureValuesAreStrings = require('./helpers/ensure-values-are-strings');
const getUserData = require('./helpers/get-user-data');
const notifier = require('./helpers/notifier');

const debug = makeDebug('authLocalMgnt:verifySignup');

module.exports = {
  verifySignupWithLongToken,
  verifySignupWithShortToken,
};

async function verifySignupWithLongToken(options, verifyToken, authUser, provider) {
  ensureValuesAreStrings(verifyToken);

  return await verifySignup(options, { verifyToken }, { verifyToken }, authUser, provider);
}

async function verifySignupWithShortToken(options, verifyShortToken, identifyUser, authUser, provider) {
  ensureValuesAreStrings(verifyShortToken);
  ensureObjPropsValid(identifyUser, options.identifyUserProps);

  return await verifySignup(options, identifyUser, { verifyShortToken }, authUser, provider);
}

async function verifySignup (options, query, tokens, authUser, provider) {
  debug('verifySignup', query, tokens);
  const usersService = options.app.service(options.service);
  const usersServiceIdName = usersService.id;

  const users = await options.customizeCalls.verifySignup
    .find(usersService, { query });
  const user1 = getUserData(users, ['isNotVerifiedOrHasVerifyChanges', 'verifyNotExpired']);

  if (!Object.keys(tokens).every(key => tokens[key] === user1[key])) {
    await eraseVerifyProps(user1, user1.isVerified);

    throw new errors.BadRequest('Invalid token. Get for a new one. (authLocalMgnt)',
      { errors: { $className: 'badParam' } }
    );
  }

  const user2 = await eraseVerifyProps(user1, user1.verifyExpires > Date.now(), user1.verifyChanges || {});
  const user3 = await notifier(options, 'verifySignup', user2)
  return options.sanitizeUserForClient(user3, options.passwordField);

  async function eraseVerifyProps (user, isVerified, verifyChanges) {
    const patchToUser = Object.assign({}, verifyChanges || {}, {
      isVerified,
      verifyToken: null,
      verifyShortToken: null,
      verifyExpires: null,
      verifyChanges: {}
    });

    return await options.customizeCalls.verifySignup
      .patch(usersService, user[usersServiceIdName], patchToUser);
  }
}
