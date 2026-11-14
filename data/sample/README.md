# Образец ответов API (синтетика)

Файлы здесь — **не настоящие данные**, а синтетические строки в формате ответов NYC Open Data и data.ny.gov, которые ждёт `data/fetch-places.mjs`. Они нужны, чтобы проверить весь конвейер без сети:

```bash
node data/fetch-places.mjs --sample --out /tmp/places-sample
node data/fetch-places.mjs --check --out /tmp/places-sample
```

Названия полей — моё допущение по документации наборов (Storefronts 92iy-9c3n, PLUTO 64uk-42ks, DOHMH 43nn-pn8j, DCWP w7w3-xahh, MTA wujg-7c2s). Скрипт ищет поля адреса, координат, вакантности и BBL по шаблонам, поэтому переименование колонок в наборе его не ломает. При первом сетевом запуске он печатает число строк каждого набора.
