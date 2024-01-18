import sqlite3 from 'sqlite3';
import mkdirp from 'mkdirp';

mkdirp.sync('var/db');

const db = new sqlite3.Database('var/db/todos.db');

db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users ( \
    username TEXT UNIQUE, \
    hashed_password BLOB, \
    salt BLOB, \
    name TEXT \
  )");
  
  db.run("CREATE TABLE IF NOT EXISTS federated_credentials ( \
    user_id INTEGER NOT NULL, \
    provider TEXT NOT NULL, \
    subject TEXT NOT NULL, \
    PRIMARY KEY (provider, subject) \
  )");
  
  db.run("CREATE TABLE IF NOT EXISTS todos ( \
    owner_id INTEGER NOT NULL, \
    title TEXT NOT NULL, \
    completed INTEGER \
  )");
});

export default db;