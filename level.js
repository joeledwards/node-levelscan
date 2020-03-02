const {
  v1: uuid1,
  v4: uuid4 
} = require('uuid')
const level = require('level')

let db = level('db-level')
let key = process.argv[2] || uuid1()
let value = process.argv[3] || uuid4()

db.put(key, value, error => {
  if (error) {
    console.log("Error", error)
  } else {
    console.log(`Wrote record ${key}: ${value}`)
  }
})

