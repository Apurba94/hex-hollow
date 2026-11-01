# Hex Hollow

A calm strategy game for phones. Over four seasons you place tiles on a hexagonal valley, and each tile scores from what stands beside it.
Every season doubles a different tile and changes what you draw, so a valley that looks perfect in spring may need rethinking by winter.

**[Play it now](https://apurba94.github.io/hex-hollow/)** in your phone's browser, then use "Add to Home Screen" to install it. After the
first visit it works offline.

* 8 tile types with their own scoring rules, and a live preview of what a placement would earn.
* 4 seasons of 8 tiles, 8 possible goals with 3 in each game, and limited redraws.
* A shared valley for each day, plus unlimited random ones.
* Rankings from Lonely Vale to Legendary Valley.

No ads, no accounts, no tracking and no network use after the first load.

## Run from source

```bash
npx serve .
npm test
```

Plain JavaScript with no dependencies. `src/logic.js` holds the rules, and `src/main.js` holds the screens.

## How it is tested

The tests pin down the scoring of every tile and the flow of a year. A greedy player then has to beat a random one by a clear margin, which
shows that decisions matter. It does not show how a thoughtful person will score.

## License

MIT
