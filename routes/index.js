import express from 'express';
import { ensureLoggedIn as ensureLogIn } from 'connect-ensure-login';
import db from '../db.js';

const ensureLoggedIn = ensureLogIn();

const fetchVraagAanbod = (req, res, next) => {
  db.all('SELECT * FROM vraagaanbod WHERE user_id = ?', [
    req.user.id
  ], (err, rows) => {
    if (err) { return next(err); }
    
    const features = rows.map(row => ({
      id: row.id,
      supply: row.supply,
      publish: row.publish,
      title: row.title,
      description: row.description,
      category: row.category,
      cubic_meters: row.cubic_meters,
      latitude: row.latitude,
      longitude: row.longitude,
      entrydate: row.entrydate,
      startdate: row.startdate,
      enddate: row.enddate,
      url: '/' + row.id
    }));
    res.locals.vraagaanbod = features;
    res.locals.activeCount = features.filter(todo => !todo.completed).length;
    res.locals.completedCount = features.length - res.locals.activeCount;
    next();
  });
}

const router = express.Router();

/* GET home page. */
router.get('/', (req, res, next) => {
  if (!req.user) { return res.render('home'); }
  next();
}, fetchVraagAanbod, (req, res, next) => {
  res.locals.filter = null;
  res.render('index', { user: req.user });
});

/* GET /login
 *
 * This route prompts the user to log in.
 *
 * The 'login' view renders an HTML page, which contains buttons prompting the
 * user to sign in with an identity provider.  When the user clicks button, a request
 * will be sent to the corresponding provider route (e.g. `GET /login/federated/accounts.google.com`).
 */
router.get('/login', (req, res, next) => {
  res.render('login');
});

router.post('/', ensureLoggedIn, (req, res, next) => {
  req.body.title = req.body.title.trim();
  next();
}, (req, res, next) => {
  if (req.body.title !== '') { return next(); }
  return res.redirect('/' + (req.body.filter || ''));
}, (req, res, next) => {
  db.run('INSERT INTO vraagaanbod (user_id,supply,publish,title,description,category,cubic_meters,latitude,longitude,entrydate,startdate,enddate)\
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
    req.user.id,
    req.body.supply,
    req.body.publish,
    req.body.title,
    req.body.description,
    req.body.category,
    req.body.cubic_meters,
    req.body.latitude,
    req.body.longitude,
    req.body.entrydate,
    req.body.startdate,
    req.body.enddate
  ], function(err) {
    if (err) { return next(err); }
    return res.json({ id: this.lastID });
  });
});

router.post('/:id(\\d+)', ensureLoggedIn, (req, res, next) => {
  req.body.title = req.body.title.trim();
  next();
}, (req, res, next) => {
  db.run('UPDATE vraagaanbod \
            SET supply = ?, \
                publish = ?, \
                title = ?, \
                description = ?, \
                category = ?, \
                cubic_meters = ?, \
                latitude = ?, \
                longitude = ?, \
                entrydate = ?, \
                startdate = ?, \
                enddate = ? \
        WHERE id = ? AND user_id = ?', [
    req.body.supply,
    req.body.publish,
    req.body.title,
    req.body.description,
    req.body.category,
    req.body.cubic_meters,
    req.body.latitude,
    req.body.longitude,
    req.body.entrydate,
    req.body.startdate,
    req.body.enddate,
    req.params.id,
    req.user.id
  ], function(err) {
    if (err) { return next(err); }
    return res.json({ id: req.params.id });
  });
});

router.post('/:id(\\d+)/delete', ensureLoggedIn, (req, res, next) => {
  db.run('DELETE FROM vraagaanbod WHERE id = ? AND user_id = ?', [
    req.params.id,
    req.user.id
  ], function(err) {
    if (err) { return next(err); }
    return res.json({ id: req.params.id });
  });
});

export default router;