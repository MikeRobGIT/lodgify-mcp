# Lodgify dashboard (internal) API: blocks, custom quotes, discounts

Reverse-engineered from app.lodgify.com on 2026-11-18 and verified with test writes on Toucan (property 684855, room type 751902), all deleted afterwards. These endpoints are undocumented and can change without notice.

## Access constraints

- Base URL: `https://app.lodgify.com/api/`.
- Auth: the dashboard session. Inside a logged-in browser tab, `fetch()` with the session cookie works; without it the API answers 401.
- The API key (`X-ApiKey`) is not accepted.
- Cloudflare answers every server-side request with a "Just a moment..." challenge (403), with or without credentials. Calls must therefore run **inside a logged-in browser** (`page.evaluate(fetch(...))`), not from the MCP server.
- The bearer token the dashboard sends is an `identityserver.lodgify.com` JWT (client `lodgify.social`, about 3-hour lifetime, MFA account).
- Responses are wrapped as `{data, success, warnings}`. A business error can arrive with HTTP 200 and `success:false`, so always check `success`.

## Blocks (closed periods)

| Action | Request | Result |
|---|---|---|
| Validate | `POST availability/closedPeriodValidation` with the body below | `{data:{roomTypes:[{id, booked}]}}`; saves nothing |
| Create | `POST availability/closedPeriod` with the body below | `{data:{id}}` |
| Read | `GET availability/closedPeriod/{id}` | `{data:{id, start, end, propertyId, roomTypes:[{id}], comments}}` |
| Update | `PUT availability/closedPeriod/{id}` with the full body | `{data:null, success:true}` |
| Delete | `DELETE availability/closedPeriod/{id}` | `{data:null, success:true}` |
| List | `GET availability/calendar/{propertyId}?periodStart=&periodEnd=&includeDetails=true&normalizedDetails=true` | `data.roomTypes[].closedPeriods[]` |

The create, update and validate requests all use this body:

```json
{ "start": "2027-06-07", "end": "2027-06-10", "propertyId": 684855, "roomTypes": [{ "id": 751902 }], "comments": "text" }
```

`end` is inclusive. After creating Jun 7–10 and editing it to end Jun 9, the public `GET /v2/availability/{propertyId}` showed Jun 7–9 unavailable with `closed_period:{id}`.

## Custom quotes and discounts (existing booking)

1. **Read.** `GET reservations/inbox/{uid}/quote` returns the editable quote at `data.quote`. `uid` is `"B" + bookingId`.
   - The quote has `roomTypes[].priceTypes[]`; each `type` is RoomRate, Promotion, Fee or Tax.
   - Each price type holds `prices[]`. A price line has `uid, isManual, isSaved, isDeleted, isRemoved, description, descriptionGuest, amount, grossAmount, netAmount, basePercentage, ...`.
2. **Edit** the quote object.
   - **Custom room rate.** Set `isDeleted:true` on the existing RoomRate line. Then push a copy of it with `uid:"fe-"+uuid`, `isManual:true`, `isSaved:false`, `isDeleted:false` and the new `amount`/`grossAmount`/`netAmount`.
     - Editing `amount` on the existing line is ignored.
     - `isRemoved:true` keeps the old amount in the total. Use `isDeleted`.
   - **Discount.** Push a Promotion line with `uid:"fe-"+uuid`, `isManual:true`, `isSaved:false`, a positive `grossAmount`/`netAmount` and a negative `amount`.
   - **Fee.** Push a manual line under the Fee type in the same way.
3. **Recalculate.** `POST reservations/quote` with `{"quote": <edited quote>}` returns the recalculated quote at `data.quote`. Taxes are percentages (`basePercentage`: BTB 9, Service Fee 5, Sales Tax 1.75) applied to room rate minus promotions. This step saves nothing.
4. **Save.** `PUT reservations/inbox/{uid}` with:
   ```json
   { "quote": <recalculated quote>, "sourceText": "...", "status": "Booked",
     "guest": { "countryCode": "", "email": "...", "language": "EN", "phoneNumber": "", "guestName": { "firstName": "...", "lastName": "..." } } }
   ```
   It returns `{data:{uid}, success:true, warnings:[...]}`. `status` is one of `Open`, `Booked`, `Tentative`; the dashboard calls these "Save as open / booked / tentative".

Verified result: room rate 800 (rack 572), plus a −50 discount, came to a total of 868.12, with taxes 118.12 = 15.75% of 750. The public API v2 then showed `total_amount` 868.12 with matching subtotals. The booking stayed Booked, the quote was NotScheduled, and a payment link was created (`{"succeeded":true}`).

The quote also has `isPolicyActive`, `sendQuote` and `overrideRatePolicy` fields, which were not explored. `sendQuote:true` presumably sends the quote to the guest.

## Guest messages (email thread)

1. **Find the thread.** `GET reservations/inbox/{uid}` returns `data.booking.threadUid`.
2. **Read it.** `GET reservations/threads/{threadUid}` returns `{threadUid, guestName, guestEmail, inboxUid, isClosed, isArchived, messages[]}`.
   - `messages[]` is newest first.
   - Each message has `{id, type: Owner|Renter|ChangeLog|..., subject, message (HTML), route (e.g. "Email"), messageStatus (Submitted|Delivered|...), messageStatusUpdateError, dateCreatedUTC}`.
3. **Send.** `POST reservations/inbox/{uid}/messages` with:
   ```json
   { "attachments": [], "message": "<p>First paragraph</p><p>Second</p>", "initiator": "inbox" }
   ```
   - It returns `{"success":true,"statusCode":"OK"}`.
   - The message then appears in the thread as `type:"Owner"`, `route:"Email"`, `messageStatus:"Delivered"`.
   - It is emailed from `owner-{threadUid}@messaging.lodgify.com`, with the subject "Reply to your booking request B{id} for {property}".

Verified on 2026-11-18 with two test sends to the owner's own address, one from the UI and one replayed by script. Both arrived. HTML-escaped `&` and `<` rendered correctly. Only direct (PublicApi) bookings were tested; OTA threads are untested.

## Side effects observed

- Creating a Booked booking through the public API emails the guest: "Thanks for your inquiry", "Your booking request…" and "…has been accepted".
- Deleting a **Tentative** booking emails the guest "couldn't be accepted". Deleting a Booked booking sent no email.
- Saving a quote through `PUT reservations/inbox/{uid}` with `sendQuote:false` sent no email.
- Script implementation: `~/.openclaw/scripts/lodgify-dash.mjs`.
