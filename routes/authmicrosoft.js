import express from 'express';
import passport from 'passport';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import db from '../db.js';

// Configure the Microsoft strategy for use by Passport.
passport.use(new MicrosoftStrategy({
  clientID: process.env['MICROSOFT_CLIENT_ID'],
  clientSecret: process.env['MICROSOFT_CLIENT_SECRET'],
  callbackURL: '/auth/microsoft/callback',
  scope: ['User.Read'],
  tenant: 'common',
  state: true
},
(accessToken, refreshToken, profile, cb) => {
  db.get('SELECT * FROM federated_credentials WHERE provider = ? AND subject = ?', [
    'https://microsoft.com',
    profile.id
  ], function(err, row) {
    if (err) { return cb(err); }
    if (!row) {
      db.run('INSERT INTO users (name) VALUES (?)', [
        profile.displayName
      ], function(err) {
        if (err) { return cb(err); }
        const id = this.lastID;
        db.run('INSERT INTO federated_credentials (user_id, provider, subject) VALUES (?, ?, ?)', [
          id,
          'https://microsoft.com',
          profile.id
        ], function(err) {
          if (err) { return cb(err); }
          const user = {
            id: id,
            name: profile.displayName
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

router.get('/login/federated/microsoft', passport.authenticate('microsoft'));

router.get('/auth/microsoft/callback', passport.authenticate('microsoft', {
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