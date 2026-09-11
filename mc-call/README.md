# MC Call PWA

Static iPhone-style dialer PWA for stage-performance use.

## Hidden settings
Rapidly tap the bottom-right search button 5 times. Enter the actual/forced phone number and tap **Применить**. The value is stored locally on the device.

## PWA install on iPhone
Open the HTTPS page in Safari → Share → Add to Home Screen / Open as Web App.

## Real call transport
The static build runs in UI/demo mode by default. A real VoIP/PSTN call requires a backend. Set `window.MC_CALL_ENDPOINT` in `config.js` to an HTTPS endpoint that accepts `displayNumber` and `forceNumber`.

Do not put provider secrets in this repository or in browser JavaScript.
