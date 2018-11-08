const v1uuid = require('uuid/v1');
const v4uuid = require('uuid/v4');
const async = require('async');
const levelup = require('levelup');
const leveldown = require('leveldown');

let db = levelup(leveldown('db-level'));
let key = process.argv[2] || v1uuid();
let value = process.argv[3] || v4uuid();

db.put(key, value, error => {
  if (error) {
    console.log("Error", error);
  } else {
    console.log(`Wrote record ${key}: ${value}`);
  }
});

