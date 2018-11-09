#!/usr/bin/env node

const path = require('path')
const yargs = require('yargs')
const levelup = require('levelup');
const leveldown = require('leveldown');
const durations = require('durations');
const {blue, hex, green, orange, yellow} = require('@buzuli/color')

const defaultLimit = 100;

const args = yargs
  .command('$0 <db-path>', 'Inspect the contents of a LevelDB', yargs => {
    yargs.positional('db-path', {
      type: 'string',
      desc: 'path to the LevelDB to inspect'
    })
  })
  .option('count', {
    type: 'boolean',
    desc: 'just count the number of keys (bounds apply, implies --unlimited unless --limit is specified)',
    default: false,
    alias: 'c'
  })
  .option('key-encoding', {
    type: 'string',
    desc: 'encoding for keys',
    alias: 'e'
  })
  .option('value-encoding', {
    type: 'string',
    desc: 'encoding for values',
    alias: 'E'
  })
  .option('json', {
    type: 'boolean',
    desc: 'format records as JSON',
    default: false,
    alias: 'j'
  })
  .option('gt', {
    type: 'string',
    desc: 'exclusive lower bound for the stream'
  })
  .option('gte', {
    type: 'string',
    desc: 'inclusive lower bound for the stream'
  })
  .option('lt', {
    type: 'string',
    desc: 'exclusive upper bound for the stream'
  })
  .option('lte', {
    type: 'string',
    desc: 'inclusive upper bound for the stream'
  })
  .option('limit', {
    desc: `maximum number of records to stream`,
    coerce: parseInt,
    alias: 'l'
  })
  .option('unlimited', {
    type: 'boolean',
    desc: 'stream all records from the database (no limit)',
    default: false,
    alias: 'L'
  })
  .option('reverse', {
    type: 'boolean',
    desc: 'stream in descending instead of ascending order',
    default: false,
    alias: 'r'
  })
  .option('quiet', {
    type: 'boolean',
    desc: 'only output records (or supress progress for count)',
    default: false,
    alias: 'q'
  })
  .option('kx', {
    type: 'string',
    desc: 'only return records with a key matching the regex',
    alias: 'K'
  })
  .option('vx', {
    type: 'string',
    desc: 'only return records with a value matching the regex',
    alias: 'V'
  })
  .option('exclude-keys', {
    type: 'boolean',
    desc: 'exclude keys from the stream',
    default: false,
    alias: 'x'
  })
  .option('exclude-values', {
    type: 'boolean',
    desc: 'exclude values from the stream',
    default: false,
    alias: 'X'
  })
  .argv

let keyRegex = null;
let valueRegex = null;
let isUnlimited = true;
let cfg = {quiet: args.quiet};

if (!args.count) {
  if (args.keyEncoding) {
    cfg.keyEncoding = args.keyEncoding;
  }

  if (args.valueEncoding) {
    cfg.valueEncoding = args.valueEncoding;
  }

  cfg.keys = (isNil(keyRegex) && args.excludeKeys) ? false : true;
  cfg.values = (isNil(valueRegex) && args.excludeValues) ? false : true;
  cfg.reverse = args.reverse ? true : false;
} else {
  cfg.keys = true;
  cfg.values = !isNil(valueRegex)
}

if (args.gt) {
  cfg.gt = args.gt;
  isUnlimited = false;
}

if (args.gte) {
  cfg.gte = args.gte;
  isUnlimited = false;
}

if (args.lt) {
  cfg.lt = args.lt;
  isUnlimited = false;
}

if (args.lte) {
  cfg.lte = args.lte;
  isUnlimited = false;
}

if (!args.unlimited) {
  if (args.limit) {
    cfg.limit = args.limit;
    isUnlimited = false;
  } else if (!args.count) {
    cfg.limit = defaultLimit;
    isUnlimited = false;
  }
}

if (args.kx) {
  try {
    keyRegex = new RegExp(args.kx)
  } catch (error) {
    console.warn(`Invalid key expression: ${args.kx}`)
    args.help()
  }
}

if (args.vx) {
  try {
    valueRegex = new RegExp(args.vx)
  } catch (error) {
    console.warn(`Invalid key expression: ${args.vx}`)
    args.help()
  }
}

// Log function which can be silenced via the --quiet option
function log(...args) {
  if (!cfg.quiet) {
    console.log(...args);
  }
}

let dbPath = args.dbPath
let db = levelup(leveldown(dbPath));

// Function which closes the database, reporting any errors to stdout.
function closeDb() {
  db.close(error => {
    if (error) {
      console.error('Error closing the database:', error);
    } else {
      log('Database closed.');
    }
  });
}

if (args.count) {
  log(`Counting records in db: ${blue(dbPath)}`);
} else {
  log(`Streaming from db: ${blue(dbPath)}`);
}

log(`Read stream options:\n${hex('c4c')(JSON.stringify(cfg, null, 2))}`);

let count = 0;
let watch = durations.stopwatch().start();
let reportWatch = durations.stopwatch().start();
let reportCount = 0;
let filterCount = 0;

// Create the read stream
db.createReadStream(cfg)
.on('data', data => {
  let key;
  let value;
  let record = {};

  if (cfg.keys) {
    if (cfg.values) {
      key = `${data.key}`
      value = `${data.value}`
    } else {
      key = `${data}`
    }
  } else if (cfg.values) {
    value = `${data}`
  }

  if (!args.excludeValues) {
    record.value = value;
  }

  if (!args.excludeKeys) {
    record.key = key;
  }

  if (!isNil(key) && !isNil(keyRegex) && isNil(key.match(keyRegex))) {
    filterCount++;
    return;
  }

  if (!isNil(value) && !isNil(valueRegex) && isNil(value.match(valueRegex))) {
    filterCount++;
    return;
  }

  count++;

  if (args.count) {
    reportCount++;

    if (reportWatch.duration().millis() >= 1000) {
      log(`${orange(reportCount)} records in the last ${green(reportWatch)}` +
          ` (${orange(count)} records in ${green(watch)}; ${filterCount} filtered)`);
      reportWatch.reset().start();
      reportCount = 0;
    }
  } else {
    let record = {};

    if (args.excludeKeys && !args.excludeValues) {
      record.value = data;
    } else if (!args.excludeKeys && args.excludeValues) {
      record.key = data;
    } else {
      record.key = data.key;
      record.value = data.value;
    }

    if (args.json) {
      console.log(JSON.stringify({
        key: record.key,
        value: record.value
      }));
    } else if (args.excludeKeys) {
      if (!args.excludeValues) {
        console.log(record.value);
      }
    } else if (args.excludeValues) {
      console.log(record.key);
    } else {
      console.log(`${record.key || ""} ${yellow('=>')} ${record.value || ""}`);
    }
  }
})
.on('end', () => {
  if (args.count) {
    let limitString = (isUnlimited || count < args.limit)
      ? "All records counted. "
      : "Limited count; may not include all records.";

    console.log(`Counted ${orange(count)} records in ${green(watch)}. ${limitString}`);
  } else {
    log(`Read ${orange(count)} records in ${green(watch)}`);
  }
})
.on('close', () => closeDb())
.on('error', error => {
  console.error(`Error streaming from database '${dbPath}':`, error);
  closeDb()
});

function isNil (value) {
  return value === null || value === undefined;
}

