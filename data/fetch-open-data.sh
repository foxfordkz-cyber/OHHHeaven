#!/usr/bin/env bash
# Downloads the open-data snapshots that data/build-footfall.mjs turns into numbers for every place on the map.
# Sources: NYC Open Data (data.cityofnewyork.us) and New York State Open Data (data.ny.gov). No key needed.
# Run from the repo root on a machine with network access:  bash data/fetch-open-data.sh
set -euo pipefail
OUT="$(dirname "$0")/open"
mkdir -p "$OUT"
NYC="https://data.cityofnewyork.us/resource"
NYS="https://data.ny.gov/resource"
# East Village plus the nearest counted corridors (Delancey, E 8th St, E 14th St, Forsyth St)
BOX="latitude > 40.711 AND latitude < 40.741 AND longitude > -74.008 AND longitude < -73.968"

echo "1/4 DOT bi-annual pedestrian counts (114 screenline locations)"
curl -sS -m 120 "$NYC/cqsj-cfgu.json?\$limit=500" -o "$OUT/dot-pedestrian-counts.raw.json"

echo "2/4 MTA subway hourly ridership, two October weeks, summed per station complex and day"
curl -sS -m 300 -G "$NYS/5wq4-mkjj.json" \
  --data-urlencode "\$select=station_complex_id,station_complex,date_trunc_ymd(transit_timestamp) as d,sum(ridership) as rides,avg(latitude) as lat,avg(longitude) as lng" \
  --data-urlencode "\$where=transit_timestamp >= '2026-10-05T00:00:00' AND transit_timestamp < '2026-10-19T00:00:00' AND $BOX" \
  --data-urlencode "\$group=station_complex_id,station_complex,d" --data-urlencode "\$limit=10000" \
  -o "$OUT/mta-ridership.raw.json"

echo "3/4 DOHMH restaurant inspection results: one row per establishment"
curl -sS -m 300 -G "$NYC/43nn-pn8j.json" \
  --data-urlencode "\$select=camis,dba,building,street,zipcode,cuisine_description,latitude,longitude,max(inspection_date) as last_inspection" \
  --data-urlencode "\$where=$BOX" \
  --data-urlencode "\$group=camis,dba,building,street,zipcode,cuisine_description,latitude,longitude" --data-urlencode "\$limit=20000" \
  -o "$OUT/dohmh-restaurants.raw.json"

echo "4/4 City Planning Facilities Database: colleges, schools, parks, hospitals, libraries, museums"
curl -sS -m 300 -G "$NYC/ji82-xba5.json" \
  --data-urlencode "\$select=facname,address,latitude,longitude,facgroup,facsubgrp,factype,capacity" \
  --data-urlencode "\$where=latitude > 40.7185 AND latitude < 40.7355 AND longitude > -73.9945 AND longitude < -73.9705 AND facsubgrp in ('COLLEGES OR UNIVERSITIES','PUBLIC K-12 SCHOOLS','NON-PUBLIC K-12 SCHOOLS','PARKS','HOSPITALS AND CLINICS','PUBLIC LIBRARIES','MUSEUMS','STREETSCAPES, PLAZAS, AND MALLS')" \
  --data-urlencode "\$limit=5000" \
  -o "$OUT/facilities.raw.json"

date -u +%Y-%m-%d > "$OUT/FETCHED"
ls -la "$OUT"
