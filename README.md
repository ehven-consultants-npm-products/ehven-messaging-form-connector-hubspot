# HubSpot messaging form connector

`@ehven/messaging-form-connector-hubspot` sends a validated contact or request message to a configured HubSpot form. This private development candidate uses MIT and targets Node 24. It uses Fetch APIs and the HubSpot Forms v3 submission endpoint.

```js
import { submitHubSpotForm } from '@ehven/messaging-form-connector-hubspot';

const receipt = await submitHubSpotForm({
  portalId: process.env.HUBSPOT_PORTAL_ID,
  formGuid: process.env.HUBSPOT_CONTACT_FORM_ID,
  data: validatedContact,
  context: { pageName: 'Contact', pageUri: 'https://example.org/contact/' },
  signal,
});
```

- `data` supplies `firstName`, `lastName`, `email` and `message`. Configure those properties on the form as `firstname`, `lastname`, `email` and `message`. Keep authorization, consent and validation in the application.
- `hubSpotSubmissionPayload(data, context)` builds the existing field mapping and submission timestamp. Optional context includes `pageName`, `pageUri` and a consented 32-character lowercase hex `hutk`.
- `createHubSpotRecorder({ portalId, formGuids })` returns a handler keyed by submission kind, such as `contact` or `request`. Its call accepts `{ kind, data, context, signal, fetchImpl }`.
- A successful HTTP response returns its parsed JSON or `null` when there is no JSON body. Non-success responses throw `HubSpotSubmissionError` with the HTTP status. Transport and cancellation errors propagate. Use `AbortSignal.timeout(...)` or the core delivery pipeline signal to bound the request.
- The connector makes one POST per call. After an ambiguous timeout, reconcile the original submission before retrying. Pass validated data and avoid logging payloads, cookies or provider response bodies.
- When using the core pipeline, await the connector inside the primary operation and return `{ ok: true }` after it resolves. The provider response body has a separate contract from the pipeline.

HubSpot form configuration owns CRM routing, contact updates and Inbox behavior. The connector's tests use synthetic provider responses. Run `npm ci --ignore-scripts --offline` and `npm run check` to verify the transport contract locally.
