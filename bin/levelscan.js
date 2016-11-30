#!/usr/bin/env node

const levelup = require('levelup');
const program = require('commander');
const durations = require('durations');

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
.option('-x, --exclude-keys', 'Exclude keys from the stream.')
.option('-X, --exclude-values', 'Exclude values from the stream.')
.parse(process.argv);

let isUnlimited = true;
let cfg = {};

if (!program.count) {
  if (program.keyEncoding) {
    cfg.keyEncoding = program.keyEncoding;
  }

  if (program.valueEncoding) {
    cfg.valueEncoding = program.valueEncoding;
  }

  cfg.keys = program.excludeKeys ? false : true;
  cfg.reverse = program.reverse ? true : false;
  cfg.values = program.excludeValues ? false : true;
} else {
  cfg.keys = true;
  cfg.values = false;
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

let dbPath = program.args[0];
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
  log(`Counting records in db: ${dbPath}`);
} else {
  log(`Streaming from db: ${dbPath}`);
}

log(`Read stream options:\n${JSON.stringify(cfg, null, 2)}`);

let count = 0;
let watch = durations.stopwatch().start();
let reportWatch = durations.stopwatch().start();
let reportCount = 0;

// Create the read stream
db.createReadStream(cfg)
.on('data', data => {
  count++;

  if (program.count) {
    reportCount++;

    if (reportWatch.duration().millis() >= 1000) {
      log(`${reportCount} records in the last ${reportWatch}` +
                  ` (${count} records in ${watch})`);
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
      console.log(`${record.key || ""} : ${record.value || ""}`);
    }
  }
})
.on('end', () => {
  if (program.count) {
    let limitString = isUnlimited ? "All records counted. " :
        "Limited count; may not include all records.";

    console.log(`Counted ${count} records in ${watch}. ${limitString}`);
  } else {
    log(`Read ${count} records in ${watch}`);
  }
})
.on('close', () => closeDb())
.on('error', error => {
  console.error(`Error streaming from database '${dbPath}':`, error);
  closeDb()
});

