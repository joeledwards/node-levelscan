const uuid = require('uuid');
const levelup = require('level-hyper');

let db = levelup('db-hyper');
let key = uuid.v1();
let value = uuid.v4();

db.put(key, value, error => {
  if (error) {
    console.log("Error", error);
  } else {
    console.log(`Wrote record ${key}: ${value}`);
  }
});

