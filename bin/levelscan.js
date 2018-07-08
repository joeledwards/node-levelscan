#!/usr/bin/env node

const path = require('path')
const levelup = require('levelup');
const program = require('commander');
const durations = require('durations');
const {blue, hex, green, orange, yellow} = require('@buzuli/color')

const defaultLimit = 100;

program
.arguments('<db-path>')
.option('-c, --count',
        'Just count the number of keys (bounds apply,' +
        ' implies --unlimited unless --limit is specified')
.option('-e, --key-encoding <encoding>', 'Encoding for keys.')
.option('-E, --value-encoding <encoding>', 'Encoding for values.')
.option('-j, --json', 'Format records as JSON.')
.option('--gt <key>', 'Exclusive lower bound for the stream.')
.option('--gte <key>', 'Inclusive lower bound for the stream.')
.option('--lt <key>', 'Exclusive upper bound for the stream.')
.option('--lte <key>', 'Inclusive upper bound for the stream.')
.option('-l, --limit <limit>',
        `Maximum number of records to stream (default ${defaultLimit}).`,
        parseInt)
.option('-L, --unlimited', 'Stream all records from the database (no limit).')
.option('-r, --reverse', 'Stream in descending instead of ascending order.')
.option('-q, --quiet', 'Only output records (or supress progress for count)')
.option('-K, --kx <key-expression', 'Only return records with a matching key')
.option('-V, --vx <value-expression', 'Only return records with a matching value')
.option('-x, --exclude-keys', 'Exclude keys from the stream.')
.option('-X, --exclude-values', 'Exclude values from the stream.')
.parse(process.argv);

let keyRegex = null;
let valueRegex = null;
let isUnlimited = true;
let cfg = {};

if (!program.count) {
  if (program.keyEncoding) {
    cfg.keyEncoding = program.keyEncoding;
  }

  if (program.valueEncoding) {
    cfg.valueEncoding = program.valueEncoding;
  }

  cfg.keys = (isNil(keyRegex) && program.excludeKeys) ? false : true;
  cfg.values = (isNil(valueRegex) && program.excludeValues) ? false : true;
  cfg.reverse = program.reverse ? true : false;
} else {
  cfg.keys = true;
  cfg.values = !isNil(valueRegex)
}

if (program.gt) {
  cfg.gt = program.gt;
  isUnlimited = false;
}

if (program.gte) {
  cfg.gte = program.gte;
  isUnlimited = false;
}

if (program.lt) {
  cfg.lt = program.lt;
  isUnlimited = false;
}

if (program.lte) {
  cfg.lte = program.lte;
  isUnlimited = false;
}

if (!program.unlimited) {
  if (program.limit) {
    cfg.limit = program.limit;
    isUnlimited = false;
  } else if (!program.count) {
    cfg.limit = defaultLimit;
    isUnlimited = false;
  }
}

if (program.kx) {
  try {
    keyRegex = new RegExp(program.kx)
  } catch (error) {
    console.warn(`Invalid key expression: ${program.kx}`)
    program.help()
  }
}

if (program.vx) {
  try {
    valueRegex = new RegExp(program.vx)
  } catch (error) {
    console.warn(`Invalid key expression: ${program.vx}`)
    program.help()
  }
}

// Log function which can be silenced via the --quiet option
function log(...args) {
  if (!program.quiet) {
    console.log(...args);
  }
}

// Exit, displaying help if a single database has not be identified.
if (program.args.length != 1) {
  program.help();
}

let dbPath = path.resolve(program.args[0]);
let db = levelup(dbPath);

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

if (program.count) {
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
      key = data.key
      value = data.value
    } else {
      key = data
    }
  } else if (cfg.values) {
    value = data
  }

  if (!program.excludeValues) {
    record.value = value;
  }

  if (!program.excludeKeys) {
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

  if (program.count) {
    reportCount++;

    if (reportWatch.duration().millis() >= 1000) {
      log(`${orange(reportCount)} records in the last ${green(reportWatch)}` +
          ` (${orange(count)} records in ${green(watch)}; ${filterCount} filtered)`);
      reportWatch.reset().start();
      reportCount = 0;
    }
  } else {
    let record = {};

    if (program.excludeKeys && !program.excludeValues) {
      record.value = data;
    } else if (!program.excludeKeys && program.excludeValues) {
      record.key = data;
    } else {
      record.key = data.key;
      record.value = data.value;
    }

    if (program.json) {
      console.log(JSON.stringify(record));
    } else if (program.excludeKeys) {
      if (!program.excludeValues) {
        console.log(record.value);
      }
    } else if (program.excludeValues) {
      console.log(record.key);
    } else {
      console.log(`${record.key || ""} ${yellow('=>')} ${record.value || ""}`);
    }
  }
})
.on('end', () => {
  if (program.count) {
    let limitString = isUnlimited ? "All records counted. " :
        "Limited count; may not include all records.";

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

