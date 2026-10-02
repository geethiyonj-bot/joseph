# DAVID_AI — Privacy/Security Edition

## Default privacy behavior
- **Local-only mode is ON by default.**
- Project data is stored in the browser with `localStorage` unless the user exports it or explicitly enables Remote AI.
- Remote AI requests are opt-in from **Privacy & Security → Allow remote AI requests**.
- Camera frames used for gesture recognition are processed in the browser and are not uploaded by the gesture engine.
- Microphone audio is only uploaded for the remote transcription fallback after Remote AI is enabled.
- No cloud project database is used by this prototype.

## Backend protection
- `OPENAI_API_KEY` is server-side only and must be stored in Vercel Environment Variables.
- The browser never receives the API key.
- The API does not expose key configuration or key prefixes through a health endpoint.
- API POST requests require a same-origin check and an HttpOnly, SameSite session cookie.
- The session is stateless and HMAC-signed on the server; `DAVID_SESSION_SECRET` may be supplied as a Vercel Environment Variable. If omitted, the server derives the signing secret from the server-side OpenAI key.
- Rate limiting is applied in the serverless instance.
- Request size and prompt size are limited.
- AI output is constrained to a strict structured action schema.
- Upstream AI/audio error details are not returned to the browser.
- The backend does not intentionally log prompts, project state, audio, API keys, or upstream response bodies.
- `store:false` is sent for Responses API requests.
- Security headers include CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, Permissions Policy, and no-store caching.

## Important limitation
This is a security-hardened prototype, not a guarantee of absolute security. A public web application can still be attacked, and Vercel/server/provider infrastructure remains outside the application's control. Do not place passwords, private keys, financial information, or other highly sensitive secrets inside a project.

## Vercel deployment
Repository root:

```text
index.html
vercel.json
README.md
api/index.js
```

Required Vercel Environment Variable:

```text
OPENAI_API_KEY = your server-side OpenAI API key
```

Recommended additional secret:

```text
DAVID_SESSION_SECRET = a long random secret
```

Optional:

```text
OPENAI_MODEL = gpt-6-astra
OPENAI_TRANSCRIBE_MODEL = gpt-transcribe
```

After changing environment variables, create a new deployment.

## Privacy controls in DAVID
- Allow/disable Remote AI
- Clear local project/privacy/activity data
- Export project
- Save/load project locally
- Camera and microphone remain permission-gated by the browser
