# AI PROMPT WAR — THINK. PROMPT. BUILD.

Node + Express backend, vanilla HTML/CSS/JS frontend, JSON file storage (`data/db.json`), Gemini called only from the server.

## 1. Install (Node.js 18+)
```
npm install
```

## 2. .env setup
```
cp .env.example .env        (Windows: copy .env.example .env)
```
Edit `.env`: set `GEMINI_API_KEY`, `HOST_USERNAME`, `HOST_PASSWORD` (and optionally `GEMINI_MODEL`, `PORT`). `.env` is git-ignored.

## 3. Gemini API setup
1. Create a key at https://aistudio.google.com/apikey.
2. Put it in `GEMINI_API_KEY` in `.env` only. Never share it in chat, screenshots or frontend files.
3. If a key is ever exposed, delete it in AI Studio and create a new one.
4. Free tiers rate-limit (HTTP 429). For a full event use a billing-enabled project.

## 4. Start
```
npm start
```
Open http://localhost:3000 (other devices on your network: http://YOUR-PC-IP:3000).

## 5. Participant credentials (70 accounts)
On the **first start** the server creates `pa001 … pa070` (change with `PARTICIPANT_COUNT`) with simple credentials where **username = password** (`pa001/pa001`, `pa002/pa002`, etc.) and writes them to **`data/credentials.csv`**. Existing participant records are migrated to this same format on startup.

## 6. Host credentials
`HOST_USERNAME` / `HOST_PASSWORD` from `.env` (defaults host / change_me — change them). Use the HOST tab on the login page.

## 7. Account reuse
An account is only a login. Each login creates a new **session** with its own server-side 45:00 timer, 5 prompts, Round 3 lock and website. While a session is active (or in the 01:00 post-submit countdown) the account can't be used elsewhere ("pa001 is currently in use."). It is released when the countdown ends (page returns to login with the username pre-filled), when 45 minutes expire, or when the host presses RELEASE.

## 8. Submission history
Each submission is its own record: unique ID `SUB-YYYYMMDD-PAxxx-NNN` (NNN counts up per account per day), session ID, score, breakdown, prompts and website HTML. Nothing is overwritten when accounts are reused. The Host Live Monitor lists every session and can open any submission.

Scoring: each round is scored on Prompt Quality, UI/UX Design and Functionality; each round contributes 25 points to the 100-point final score.

## Testing
```
MOCK_AI=1 RELEASE_SECONDS=2 DATA_FILE=data/test.json PORT=3111 node server/server.js
PORT=3111 DATA_FILE=data/test.json node tests/flow.js      # second terminal (wait ~5s after starting the server)
```

## 8a. The four rounds
Round 1 **Problem Statement** (8 min) → Round 2 **Easy Enhancement** (8) → Round 3 **Medium Enhancement** (10) → Round 4 **Hard Enhancement** (12), then **Submit**. Every participant receives a different assigned problem, and Rounds 2–4 enhance the same website instead of replacing the original problem.

## 8b. Round 3 quiz gate + reward
1. Round 1 and Round 2 have no quiz visible in the normal page.
2. When the participant finishes Round 2 and clicks **START ROUND 3**, a full-screen **5-question AI quiz popup** opens before Round 3 starts.
3. There are 2 attempts. Passing requires 3/5 by default.
4. A passed quiz unlocks a **solved Round 3 challenge prompt** generated from that participant's assigned problem and the exact Round 3 enhancement. The reward is automatically placed into the Round 3 prompt box.
5. **CONTINUE TO ROUND 3** closes the popup and starts Round 3. The participant generates the rewarded Round 3 website, then proceeds to Round 4 normally.

## 8c. Saved round history + preview
- Every round prompt is saved as the participant types and again when leaving the round.
- Clicking a completed ROUND 1/2/3/4 tab shows that round's saved prompt and its exact saved website preview.
- The current round can be edited; completed rounds are read-only history.
- If Round 2/3/4 has not generated a new site yet, the preview continues showing the previous round's working website instead of becoming blank.
- The preview strips restrictive Content-Security-Policy meta tags and uses a sandbox shim so generated navigation, forms, storage and common interactions do not break the event page.

## 8d. Prompt + submission
- The old 40-character minimum is removed. Any non-empty prompt up to 2000 characters is accepted.
- After final submission, **DOWNLOAD WEBSITE** uses the authenticated session to download the final Round 4 HTML.
- The login page uses the supplied AI Prompt War visual style; participant credentials are `pa001/pa001`, `pa002/pa002`, etc., while the Host Live Monitor keeps its host credentials from `.env`.

## 9. Troubleshooting
- **AI GENERATION FAILED**: check key, model name, internet, and the server console (logs HTTP status). Failed generations don't use a prompt.
- **429 in console**: rate limit; wait or use a billing-enabled key.
- **"paXXX is currently in use"**: use RELEASE on the Host Monitor.
- **Port busy**: the server now stops with a message; run STOP.BAT or change `PORT`.
- **Reset everything**: stop server, delete `data/db.json`.
- Optional env: `EVENT_MINUTES` (45), `RELEASE_SECONDS` (60), `MOCK_AI=1`.
- Round timers (5/8/10/22 min) are guidance; the enforced limit is the 45-minute server timer.
