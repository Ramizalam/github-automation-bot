# Testing Guide

The GitHub Automation Bot relies on strict separation of concerns, which makes testing the business logic very straightforward.

## Rule Engine Testing

The Rule Engine (`src/services/rule-engine.service.ts`) is a pure function disguised as a class. It has no dependencies on Prisma, the filesystem, or network requests.

You do not need mocking libraries to test it.

**Example Test Strategy:**
1. Construct a mock `Rule[]` object array.
2. Construct a mock JSON `payload` object.
3. Call `ruleEngine.matchRules(rules, payload)`.
4. Assert the returned array length and contents match expectations.

## Webhook Simulation (Local Testing)

You can simulate GitHub webhook deliveries without making actual changes to a GitHub repository by using `curl` or Postman.

### Using cURL

Because the bot strictly validates the HMAC-SHA256 signature (`X-Hub-Signature-256`), you must generate a valid signature for your test payload.

1. Create a `payload.json` file:
```json
{
  "action": "opened",
  "repository": {
    "id": 123456789,
    "name": "test-repo"
  },
  "pull_request": {
    "title": "WIP: Add feature X"
  }
}
```

2. Run a small Node script to generate the signature using your local `GITHUB_WEBHOOK_SECRET`.
```javascript
const crypto = require('crypto');
const fs = require('fs');
const secret = 'your_local_secret';
const payload = fs.readFileSync('payload.json', 'utf8');
const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
console.log(sig);
```

3. Send the request locally:
```bash
curl -X POST http://localhost:3000/api/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -H "X-GitHub-Delivery: 11111111-2222-3333-4444-555555555555" \
  -H "X-Hub-Signature-256: <PASTE_SIGNATURE_HERE>" \
  -d @payload.json
```

## Dashboard SSE Testing

To verify the Server Sent Events are working:
1. Open the Action Logs page in your browser.
2. Fire a fake webhook via curl (as shown above).
3. The dashboard table should instantly refresh with the new event and the result of the action, without you needing to press F5 or interact with the page.
