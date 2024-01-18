import express from 'express';
import { ensureLoggedIn as ensureLogIn } from 'connect-ensure-login';
import db from '../db.js';

const ensureLoggedIn = ensureLogIn();

const fetchTodos = (req, res, next) => {
  db.all('SELECT rowid AS id, * FROM todos WHERE owner_id = ?', [
    req.user.id
  ], (err, rows) => {
    if (err) { return next(err); }
    
    const todos = rows.map(row => ({
      id: row.id,
      title: row.title,
      completed: row.completed == 1 ? true : false,
      url: '/' + row.id
    }));
    res.locals.todos = todos;
    res.locals.activeCount = todos.filter(todo => !todo.completed).length;
    res.locals.completedCount = todos.length - res.locals.activeCount;
    next();
  });
}

const router = express.Router();

/* GET home page. */
router.get('/', (req, res, next) => {
  if (!req.user) { return res.render('home'); }
  next();
}, fetchTodos, (req, res, next) => {
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

router.get('/active', ensureLoggedIn, fetchTodos, (req, res, next) => {
  res.locals.todos = res.locals.todos.filter(todo => !todo.completed);
  res.locals.filter = 'active';
  res.render('index', { user: req.user });
});

router.get('/completed', ensureLoggedIn, fetchTodos, (req, res, next) => {
  res.locals.todos = res.locals.todos.filter(todo => todo.completed);
  res.locals.filter = 'completed';
  res.render('index', { user: req.user });
});

router.post('/', ensureLoggedIn, (req, res, next) => {
  req.body.title = req.body.title.trim();
  next();
}, (req, res, next) => {
  if (req.body.title !== '') { return next(); }
  return res.redirect('/' + (req.body.filter || ''));
}, (req, res, next) => {
  db.run('INSERT INTO todos (owner_id, title, completed) VALUES (?, ?, ?)', [
    req.user.id,
    req.body.title,
    req.body.completed == true ? 1 : null
  ], function(err) {
    if (err) { return next(err); }
    return res.redirect('/' + (req.body.filter || ''));
  });
});

router.post('/:id(\\d+)', ensureLoggedIn, (req, res, next) => {
  req.body.title = req.body.title.trim();
  next();
}, (req, res, next) => {
  if (req.body.title !== '') { return next(); }
  db.run('DELETE FROM todos WHERE rowid = ? AND owner_id = ?', [
    req.params.id,
    req.user.id
  ], function(err) {
    if (err) { return next(err); }
    return res.redirect('/' + (req.body.filter || ''));
  });
}, (req, res, next) => {
  db.run('UPDATE todos SET title = ?, completed = ? WHERE rowid = ? AND owner_id = ?', [
    req.body.title,
    req.body.completed !== undefined ? 1 : null,
    req.params.id,
    req.user.id
  ], function(err) {
    if (err) { return next(err); }
    return res.redirect('/' + (req.body.filter || ''));
  });
});

router.post('/:id(\\d+)/delete', ensureLoggedIn, (req, res, next) => {
  db.run('DELETE FROM todos WHERE rowid = ? AND owner_id = ?', [
    req.params.id,
    req.user.id
  ], function(err) {
    if (err) { return next(err); }
    return res.redirect('/' + (req.body.filter || ''));
  });
});

router.post('/toggle-all', ensureLoggedIn, (req, res, next) => {
  db.run('UPDATE todos SET completed = ? WHERE owner_id = ?', [
    req.body.completed !== undefined ? 1 : null,
    req.user.id
  ], function(err) {
    if (err) { return next(err); }
    return res.redirect('/' + (req.body.filter || ''));
  });
});

router.post('/clear-completed', ensureLoggedIn, (req, res, next) => {
  db.run('DELETE FROM todos WHERE owner_id = ? AND completed = ?', [
    req.user.id,
    1
  ], function(err) {
    if (err) { return next(err); }
    return res.redirect('/' + (req.body.filter || ''));
  });
});

export default router;