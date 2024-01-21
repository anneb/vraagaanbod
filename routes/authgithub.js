import express from 'express';
import passport from 'passport';
import GithubStrategy from 'passport-github';
import db from '../db.js';

// Configure the Facebook strategy for use by Passport.
//
// OAuth 2.0-based strategies require a `verify` function which receives the
// credential (`accessToken`) for accessing the Facebook API on the user's
// behalf, along with the user's profile.  The function must invoke `cb`
// with a user object, which will be set at `req.user` in route handlers after
// authentication.
passport.use(new GithubStrategy({
  clientID: process.env['GITHUB_CLIENT_ID'],
  clientSecret: process.env['GITHUB_CLIENT_SECRET'],
  callbackURL: '/auth/github/callback',
  scope: [ 'profile','user:email' ],
  state: true
},
(accessToken, refreshToken, profile, cb) => {
  db.get('SELECT * FROM federated_credentials WHERE provider = ? AND subject = ?', [
    'https://github.com',
    profile.id
  ], (err, row) => {
    if (err) { return cb(err); }
    if (!row) {
      db.run('INSERT INTO users (name, emails) VALUES (?, ?)', [
        profile.displayName, JSON.stringify(profile.emails)
      ], function(err) {
        if (err) { return cb(err); }
        const id = this.lastID;
        db.run('INSERT INTO federated_credentials (user_id, provider, subject) VALUES (?, ?, ?)', [
          id,
          'https://github.com',
          profile.id
        ], function(err) {
          if (err) { return cb(err); }
          const user = {
            id: id,
            name: profile.displayName,
            emails: profile.emails
          };
          return cb(null, user);
        });
      });
    } else {
      db.get('SELECT rowid AS id, * FROM users WHERE rowid = ?', [ row.user_id ], function(err, row) {
        if (err) { return cb(err); }
        if (!row) { return cb(null, false); }
        return cb(null, row);
      });
    }
  });
}));

// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  In a
// production-quality application, this would typically be as simple as
// supplying the user ID when serializing, and querying the user record by ID
// from the database when deserializing.  However, due to the fact that this
// example does not have a database, the complete Facebook profile is serialized
// and deserialized.
passport.serializeUser((user, cb) => {
  process.nextTick(() => {
    cb(null, { id: user.id, username: user.username, name: user.name });
  });
});

passport.deserializeUser((user, cb) => {
  process.nextTick(() => {
    return cb(null, user);
  });
});

const router = express.Router();

/* GET /login/federated/accounts.google.com
 *
 * This route redirects the user to Google, where they will authenticate.
 *
 * Signing in with Google is implemented using OAuth 2.0.  This route initiates
 * an OAuth 2.0 flow by redirecting the user to Google's identity server at
 * 'https://accounts.google.com'.  Once there, Google will authenticate the user
 * and obtain their consent to release identity information to this app.
 *
 * Once Google has completed their interaction with the user, the user will be
 * redirected back to the app at `GET /oauth2/redirect/accounts.google.com`.
 */
router.get('/login/federated/github', passport.authenticate('github'));

/*
    This route completes the authentication sequence when Google redirects the
    user back to the application.  When a new user signs in, a user account is
    automatically created and their Google account is linked.  When an existing
    user returns, they are signed in to their linked account.
*/
router.get('/auth/github/callback', passport.authenticate('github', {
  successReturnToOrRedirect: '/',
  failureRedirect: '/login'
}));

/* POST /logout
 *
 * This route logs the user out (passport versions >= 0.6)
 */
router.post('/logout', (req, res, next) => {
  req.logout(req.user, err=> {
    if (err) { return next(err); }
    return res.redirect('/');
  });
});

export default router;