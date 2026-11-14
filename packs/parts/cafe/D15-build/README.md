# D15 build scripts

How `D15-calibration-premises.json` and `.md` were produced.

1. Put the `packs/parts/cafe/` files of all branches into `parts/cafe/` next to this folder's parent (the scripts read `parts/cafe/D*.json`).
2. `python3 select.py` (run from the parent of `parts/`, it writes `selected.json`): the original records of the events of the theme.
3. `python3 fragment_extra.py`: levers, mechanics, corrections, verified facts, comparisons -> `fragment_extra.json`.
4. `python3 build.py <out.json>`: merges `selected.json` with the calibrations in `cal_*.py` (numbers, months, durations, moves and their prices) and the sources in `common.py`.
5. `python3 report.py <out.json> <out.md>`: the report, with the event table generated from the data.

The numbers live in `cal_*.py`; each entry carries its source key and a note with the arithmetic.
