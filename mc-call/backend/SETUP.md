# MC Call Voice · deployment preparation

**Status: integration scaffold, not an activated telephone service.** Unit tests validate token/ticket/signature logic. No real end-to-end paid call or Safari microphone routing has been tested.

Deploy this `backend` directory as a separate Node 22+ serverless project (for example Vercel). Install dependencies and run `npm run build`; the build bundles the official Twilio Voice JavaScript SDK into `public/sdk.js`. Pin the resolved dependency versions in a lockfile for the actual deployment.

Copy the names from `.env.example` into the server host's environment editor. Never commit actual values. `MC_OPERATOR_KEY` and `MC_TICKET_SECRET` must be different random secrets of at least 32 characters. The operator key is entered into the PWA only for the current session; **Twilio API Key Secret and Auth Token must never be entered into the browser**.

Set `MC_ORIGIN` to the exact PWA origin, `MC_PUBLIC_URL` to the HTTPS backend origin without a trailing slash. `MC_ALLOWED_NUMBERS` is a comma-separated allowlist of agreed assistant numbers in E.164. `TWILIO_CALLER_ID` must be a calling identity accepted by the provider. Country access, carrier restrictions, provider availability and actual tariffs must be verified for the user's account and destination before a paid call.

Create/configure the TwiML application with POST Voice URL `<MC_PUBLIC_URL>/api/voice`. Put its SID in `TWILIO_APP_SID`. Set the Twilio account SID, a suitable API key SID/secret, and the account Auth Token in server environment. Set `MC_ENABLED=1` only after review. Keep provider geographical permissions and spending limits restrictive.

`POST /api/session` accepts `{target}` with an operator bearer key. The server rejects any target outside the allowlist and issues a 120-second SDK token plus a 90-second identity-bound routing ticket. The browser sends only the ticket to Twilio. `POST /api/voice` verifies the Twilio signature using the configured public URL, AccountSid, client identity and ticket, then returns Dial to the allowlisted number. It never trusts a display-number parameter. Answer-on-bridge is enabled and maximum call duration is capped.

The sample's per-minute request cap is warm-instance only, **not a distributed global rate limiter**. A signed ticket can be replayed within its short validity window by an already authenticated actor. Before exposing this as a multi-user service, add durable single-use ticket consumption, distributed rate limiting, per-user auth, global cost/concurrency guards and abuse monitoring. This sample is scoped to one trusted performer and must not be described as production-ready commercial telephony.

Set the SDK response CORS origin in `vercel.json` if using a different PWA domain. Enter the backend origin, prepared destination and operator key in hidden PWA settings. Use Check connection first. Test permission prompts, real answer/hangup state, audio through the physical iPhone speaker, app backgrounding and network interruption **before performance**.

The app must remain in the foreground. Do not rely on a PWA for emergency calls. Speaker/earpiece switching is system-controlled and is not faked as a working web audio route switch.
