import sqlite3 from 'sqlite3';
import mkdirp from 'mkdirp';

mkdirp.sync('var/db');

const db = new sqlite3.Database('var/db/vraagaanbod.db');

db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users ( \
    username TEXT UNIQUE, \
    hashed_password BLOB, \
    salt BLOB, \
    name TEXT, \
    emails TEXT, \
    contactmail TEXT \
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

  // create a table for the vraag en aanbod with the following fields:
  // user_id, supply, title, description, category, cubic_meters, latitude, longtitude, date
  db.run("CREATE TABLE IF NOT EXISTS vraagaanbod ( \
    id INTEGER PRIMARY KEY AUTOINCREMENT, \
    user_id INTEGER NOT NULL, \
    supply BOOLEAN NOT NULL, \
    publish BOOLEAN NOT NULL, \
    title TEXT, \
    description TEXT, \
    category TEXT, \
    cubic_meters INTEGER, \
    latitude REAL, \
    longitude REAL, \
    entrydate TEXT, \
    startdate TEXT, \
    FOREIGN KEY(user_id) REFERENCES users(id) \
  )");
});

export default db;