# csv-reader-speed

A faster drop-in replacement for csv-reader 1.0.0: `run(input)` returns byte-identical `{columns, rows, errors}` for every input, including BOM handling, quoted fields, stray CRs, quote junk, unterminated quotes and ragged rows. It is a dependency-free single-pass scanner that builds fields with `slice()` over segments between special characters and splits clean records in native code, avoiding per-character string concatenation.

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/navaz7/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/navaz7/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
