# RUGD

The 10-player shitcoin trading game where the dev always wins. Eventually.

Set in a cartoon degen office: a black-bezel trading monitor, a WAGMI neon sign (it flips to NGMI when the coin gets rugged), a whiteboard leaderboard, the coin's fake Telegram group on a phone, and two chunky BUY / SELL keys.

Everybody gets $1,000 of fake money and a freshly launched shitcoin. The chart rips and dumps in fast-forward. **BUY** puts your whole stack in, **SELL** dumps the whole bag. Three 30-second rounds, most total profit wins.

Some rounds the dev pulls the rug. Anyone holding when it happens loses the entire bag and the round ends on the spot.

## Rug odds

Decided secretly by the host at the start of each 3-round game:

| Rugs in a game | Chance |
|---|---|
| 0 | 45% |
| 1 | 51% |
| 2 | 4% |
| 3 | never |

So any single round has roughly a 1-in-5 chance of being rugged. A rug lands between 7 s and 28.5 s into the round. About two-thirds of the time the dev waits for a juicy pump (peak hopium) before pulling; the rest of the time it's a completely random moment. Bots don't know when it's coming either.

## Rules

- Every round resets everyone to $1,000. Round profit = what you end the round with minus $1,000.
- Every buy and sell pays a 0.69% dev tax.
- If the round ends without a rug, any open bag is auto-sold at the closing price.
- Trading stops the moment the round ends or the rug is pulled.
- Round profits add up across all three rounds. Highest total is the Gigachad of the Trenches; lowest is Certified Exit Liquidity.

## Controls

| Action | Keys | Touch |
|---|---|---|
| Buy (all in) | B, W, ↑ | BUY button |
| Sell (everything) | S, ↓ | SELL button |
| Trollbox | Enter | — |
| Mute | M | 🔊 button |
| Fullscreen | F | ⛶ button (iPhone: Share → Add to Home Screen) |

## Modes

- **Play vs 9 bots**: solo playtest mode. Bots have six personalities (momentum chaser, dip buyer, diamond hands, paper hands, pure degen, scared money).
  Add `?rug=101` to the URL to force which rounds get rugged while testing (solo only; each digit is a round).
- **Host online room**: gives a 4-character code. Up to 10 humans; the host can fill the empty seats with bots.
- **Join**: type the code.

## How it works

- `public/index.html`: the whole game (HTML, CSS, script). The pure rules live between the `ENGINE START` / `ENGINE END` markers.
- The host's browser runs the match: chart seed, secret rug plan, trades, bots, scores. Everyone else renders the host's snapshots ~20 times a second; only the seed travels, so every screen draws the same chart. The rug time stays on the host until it happens.
- `server.js`: no-dependency Node server. It serves the page and relays rooms over a WebSocket at `/ws`. Inside Claude the game uses the artifact room feature instead.

## Run locally

```
node server.js          # http://localhost:3000
node tools/sim.js       # engine checks: rug odds, chart stats, bot tournament
python3 tools/browser_test.py solo     # needs Playwright + Chrome; screenshots to /tmp/rugd_shots
python3 tools/browser_test.py online   # host + guest in two browsers
```

## Deploy on Render

New → Blueprint → pick this repo → Apply. `render.yaml` sets up a free web service. Free services sleep after 15 minutes idle, so the first visit takes about a minute to wake up.
