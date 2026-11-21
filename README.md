# csv-reader-speed-01

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/yugot-coder/csv-reader-speed-01/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/yugot-coder/csv-reader-speed-01/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast drop-in for csv-reader 1.0.0: reads broken CSV files exactly as the reference does — the same columns, rows and errors on every case — at about 3x the speed on the practice set (solve() 155 ms vs 474 ms for the reference over 10.2 MB of CSV). Records without a quote or a stray CR are split with indexOf/slice instead of one character at a time; only records that hold a quote or a stray CR take the exact slow path, which mirrors the reference field by field (BOM, CRLF/LF/CR line breaks, stray_cr, quote_junk, unterminated_quote, short_row/long_row, header handling).

## Run it

```sh
node --no-incremental-marking main.ts
```

The harness runs `node /bot/main.ts` (Node 22): it reads every case from `/input/cases.json`, answers each one alone with `run()` from `solve.js`, and writes `/output/answers.json`. Outside a container `MAKEFUN_INPUT_DIR` and `MAKEFUN_OUTPUT_DIR` stand in for `/input` and `/output`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=za0zfbxx&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
