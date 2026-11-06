# Airport Code Trainer

Study app for airport codes (all 30 course sets, 484 airports, including the **50 Busiest Airports** split into six regional maps): Flight School lessons, Recall, Quick Fire, Match, Map Run, Mock Test, **Air Defender** and **Tower Control** (both also playable as the **50 Busiest Challenge**: one region or all 50), local-time clocks for every set, color modes that repaint the whole page, and a **world leaderboard** on Supabase.

Every one of the 484 cities has its own picture in Air Defender, based on what it's known for (the Space Needle, Carhenge, Cheyenne's bucking horse, Bubblegum Alley...). The same facts show up on the cheat sheet, in Flight School and on a City Spotlight card after each game.

- No email, no password. Players pick a name like `cortes` or `mango`.
- You can play as a guest. When a run ends with a score, you're offered a spot on the world board.
- The home screen shows the **world top 3 for both games**, and the game screens show a top 5. When anyone posts a score that makes the top 5, every open copy updates within a couple of seconds (Supabase Realtime broadcast, with a 20-second refresh as backup). During a game, a chase line shows who you're about to pass.
- When someone passes your score, you get a notice the next time you open the app, for example: *"cortes, your high score was beaten by mango… You're now #4."*

## 1. Run it in VS Code

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

Open the link it prints (usually http://localhost:5173). On your phone, use the **Network** link it prints while on the same Wi-Fi.

Everything except the world leaderboard works right away.

## 2. Turn on the leaderboard (Supabase)

1. Create a project at [supabase.com](https://supabase.com) (the free tier is fine).
2. In the dashboard, open **SQL Editor → New query**. Paste all of `supabase/schema.sql` and press **Run**.
3. Copy `.env.example` to a new file called `.env.local`, then fill in:
   - `VITE_SUPABASE_URL`: your Project URL
   - `VITE_SUPABASE_ANON_KEY`: the **anon / publishable** key (never the `service_role` key)

   Both are under **Project Settings → API**, or the **Connect** button.
4. Stop the dev server (Ctrl+C) and run `npm run dev` again.

**Already ran `schema.sql` before?** Run it again after updating. It's safe to re-run: it keeps every player and score and only updates the functions.

The account bar at the top will show **Leaderboard** and **Sign in** buttons.

## How accounts work

- Typing a new name claims it. The database makes a random 12-character **account code** and stores only a hash of it. Your browser remembers the name and code, so you're never asked again on that device.
- Typing a name that's taken asks for its account code. That's what stops someone from posting as you.
- To use your name on another phone or browser, open **Account → Show my code** on the first device.
- The tables are named `act_players`, `act_scores`, `act_notices` and `act_runs`, so they never clash with other apps' tables in the same Supabase project. They're locked (row level security, no direct access). The browser can only call the functions in `schema.sql`, which check the name and code before saving anything.

**Limits worth knowing**
- Scores come from the browser, so they can't be made fully cheat-proof. What the database does check: every game asks for a round ticket when it starts, a score needs a ticket that hasn't been used, the round has to have lasted long enough for the wave or shift it claims (5 seconds a wave at least), and the score can't be higher than a perfect game could reach by then. One post every 3 seconds per player. Faking a big score would mean writing code and waiting it out, and you can still delete it in the Table Editor.
- Names go through a word filter (in the browser and again in the database), so swears and slurs can't be claimed. A name that got in before the filter is hidden from the board and can't post.
- Lose the code and sign out (or clear browser data) and that name can't be recovered from the app.

## Using it with a class

- **Run the newest `supabase/schema.sql` once** (SQL Editor → paste → Run). It turns on the name filter, the round tickets and the score check, and keeps every player and score. Until you run it, the site keeps posting scores the old way.
- **Remove a name or a score:** Supabase → **Table Editor** → `act_players` (deleting a player also deletes their scores and notices) or `act_scores` for just one score.
- **50+ players at once is fine** on Supabase's free tier: the live boards only ping everyone when a score reaches the top 5, each copy waits a random second or two before refreshing, and the boards also re-check every 20 seconds.
- Progress (levels, XP, local high scores, color mode) lives in each student's own browser. Only names and world scores go to the database.

## Project layout

```
src/
  data/sets.json         The airport database (codes → airports) and course sets
  data/geo.json          Map shapes for every state
  App.jsx                React shell: account, dialogs, notices, toasts
  leaderboard.js         Supabase calls + account storage
  supabase.js            Supabase client (off when keys are missing)
  components/            AccountBar, SignInDialog, SubmitDialog, LeaderboardDialog,
                         AccountDialog, Notices, NameForm, CodeBox, Modal, Trainer
  trainer/engine.js      The study app and both games (plain JS, mounted by React)
  trainer/art.js         Game art: city landmarks, bombs, launchers, airliners
  trainer/motifs.js      The 240 hand-drawn landmark shapes
  data/landmarks.json    What each city is known for, and which picture it gets
  names.js               The name filter
  themes.js              The color modes
  trainer/styles.css     All the app's styles and color tokens
supabase/schema.sql      Tables, security and functions for the leaderboard
```

The games still run on the original engine, mounted inside the `Trainer` React component. React talks to it through a small bridge:

- `bridge.onGameOver(result)` fires when Air Defender or Tower Control ends.
- `bridge.openLeaderboard(game, level)` opens the board.
- `bridge.user()` gives the signed-in name.

Screens can be moved into React one at a time later without breaking the games.

## The airport database (`src/data/sets.json`)

The app runs off this one file. Nothing about the airports is hard-coded.

- **`airports`**: key = the IATA code, value = the airport:
  ```json
  "CPR": { "city": "Casper", "place": "Casper, WY", "st": "WY", "lat": 42.908, "lon": -106.464,
           "tip": "optional memory trick", "clue": "optional short hint", "label": "optional short map name" }
  ```
- **`sets`**: the course sets in order. Each set has one **panel** per state (a split-screen map), and each panel lists its codes:
  ```json
  { "id": "hi_id", "name": "Hawaii & Idaho", "region": "West",
    "panels": [ { "st": "HI", "name": "Hawaii", "codes": ["HNL", "OGG", "..."] },
                { "st": "ID", "name": "Idaho",  "codes": ["BOI", "SUN", "..."] } ] }
  ```

**To add an airport:**
1. Add it under `airports`. Take `lat`/`lon` from Google Maps: right-click the airport, then click the numbers.
2. List its code in the right panel.

The map dot, the lessons, the games and the pattern (Easy Three / Hidden Letters / Story Codes) all update automatically. Without a `tip`, a memory trick is generated for you.

Optional settings, used by the 50 Busiest set:
- `"sectors": true` on a set: the study map shows every panel in a grid, and the games fly one region at a time (Air Defender rotates region each wave; Tower Control lets you pick a region).
- `"grid"` on a set: custom rows of columns for the panels.
- `"inset": {"in": 0, "box": [lon0, lat0, lon1, lat1]}` on a panel: draws it inside panel 0, over that stretch of ocean (Hawaii, Puerto Rico).
- `"dense": true` on a panel: labels shrink to just the code, and the games name only the cities in play.

The same code can appear in more than one set (CVG, DCA, IAD, TRI, HTS, PKB, TTN), and progress on it is shared.

A code that's listed under two names on the course list gets `"alts"`: `"SUN": { "place": "Sun Valley, ID", "alts": ["Hailey, ID"], ... }`. Practice, the Mock Test and Tower Control then ask with either name, and the cheat sheet shows both.

**City pictures and "known for" lines** live in `src/data/landmarks.json`: `"CYS": ["bronc", "Cheyenne Frontier Days rodeo"]`. The first value is a hand-drawn landmark from `src/trainer/motifs.js` or an emoji. A new airport without an entry gets a small town hall.

`src/data/geo.json` holds the map shapes (state outlines, lakes, rivers, interstates, mountains). It comes from public-domain US Census, Natural Earth and OurAirports data.

## Put it online (Netlify)

`netlify.toml` already holds the build settings.

1. On [netlify.com](https://app.netlify.com), click **Add new project → Import an existing project → GitHub**, then pick this repo.
2. Leave the build settings as they are (`npm run build`, publish `dist`).
3. Optional, for the world leaderboard: open **Environment variables** and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy.
4. Click **Deploy**.

After that, every push to GitHub updates the site on its own.

**Turning the leaderboard on for a site that's already live:** in Netlify open **Project configuration → Environment variables**, add the two `VITE_SUPABASE_…` values, then go to **Deploys → Trigger deploy → Deploy site**. The keys are read when the site is built, so the redeploy is needed. The bar at the top then shows **Leaderboard** and **Sign in** instead of "Leaderboard is off".

## Put it on another website

Paste this where the trainer should appear (use your own Netlify address):

```html
<iframe src="https://YOUR-SITE.netlify.app/" title="Airport Code Trainer"
        style="width:100%;height:900px;border:0" allow="autoplay"></iframe>
```

Or just link to it. Progress is saved in each student's own browser.
