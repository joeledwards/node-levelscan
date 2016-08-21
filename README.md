# node-levelscan
LevelDB command line database scan utility.

Install levelscan globally.
```bash
$ npm install -g levelscan
```

Installing globally exposes the levelscan command.

To scan the first 100 records from the database with all the default options,
simply provide the path to the database.
```bash
$ levelscan path/to/my-leveldb
Streaming from db: path/to/my-leveldb
Read stream options:
{
  "limit": 100,
  "keys": true,
  "reverse": false,
  "values": true
}

2016-08-20T15:28:00.000Z : {"timestamp":"2016-08-20T15:28:00.000Z","sample":4,"upper":4,"lower":4}
2016-08-20T15:29:00.000Z : {"timestamp":"2016-08-20T15:29:00.000Z","sample":4,"upper":4,"lower":4}

... SNIP ...

2016-08-20T17:06:00.000Z : {"timestamp":"2016-08-20T17:06:00.000Z","sample":4,"upper":4,"lower":4}
2016-08-20T17:07:00.000Z : {"timestamp":"2016-08-20T17:07:00.000Z","sample":4,"upper":4,"lower":4}
Read 0 records in 16.712 ms
Database closed.
```

Display help to see all options.
```bash
$ levelscan --help

  Usage: levelscan [options] <db-path>

  Options:

    -h, --help                       output usage information
    -e, --key-encoding <encoding>    Encoding for keys.
    -E, --value-encoding <encoding>  Encoding for values.
    -j, --json                       Format records as JSON.
    --gt <key>                       Exclusive lower bound for the stream.
    --gte <key>                      Inclusive lower bound for the stream.
    --lt <key>                       Exclusive upper bound for the stream.
    --lte <key>                      Inclusive upper bound for the stream.
    -l, --limit <limit>              Maximum number of records to stream (default 100).
    -L, --unlimited                  Stream all records from the database (no limit).
    -r, --reverse                    Stream in descending instead of ascending order.
    -q, --quiet                      Only output records
    -x, --exclude-keys               Exclude keys from the stream.
    -X, --exclude-values             Exclude values from the stream.

```

