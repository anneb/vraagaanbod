import './config.js';

const BASE_URL = process.env['BASE_URL'] || '/';

// setup __dirname and __filename
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import createError from 'http-errors';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import csrf from 'csurf';
import passport from 'passport';
import logger from 'morgan';
import connectSqlite3 from 'connect-sqlite3';
import pluralize from 'pluralize';

import indexRouter from './routes/index.js';
import googleAuthRouter from './routes/authgoogleoauth2.js';
import githubAuthRouter from './routes/authgithub.js';
import microsoftAuthRouter from './routes/authmicrosoft.js';

const SQLiteStore = connectSqlite3(session);

const app = express();

app.set('trust proxy', ['127.0.0.1', '::1']);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.locals.pluralize = pluralize;

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(BASE_URL, express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env['SESSION_SECRET'],
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore({ db: 'sessions.db', dir: 'var/db' })
}));
app.use(csrf());
app.use(passport.authenticate('session'));
app.use((req, res, next) => {
  const msgs = req.session.messages || [];
  res.locals.messages = msgs;
  res.locals.hasMessages = !!msgs.length;
  req.session.messages = [];
  next();
});
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use(BASE_URL, indexRouter);
app.use(BASE_URL, googleAuthRouter);
app.use(BASE_URL, githubAuthRouter);
app.use(BASE_URL, microsoftAuthRouter);

app.use((req, res, next) => {
  next(createError(404));
});

app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

export default app;