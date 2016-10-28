const uuid = require('uuid');
const async = require('async');
const levelup = require('levelup');

let db = levelup('db-level');
let key = uuid.v1();
let value = uuid.v4();

db.put(key, value, error => {
  if (error) {
    console.log("Error", error);
  } else {
    console.log(`Wrote record ${key}: ${value}`);
  }
});

