# SeatScout

SeatScout is a static event-seat availability app. Open `index.html` in a browser, enter an event, date, and location, then choose an inventory source.

## Inventory sources

- Demo inventory: sample data for trying the interface immediately.
- Provider endpoint: calls your own ticketing inventory API with `event`, `date`, and `place` query parameters.
- Ticketmaster search: searches Ticketmaster Discovery API for a matching event and ticket link. Ticketmaster Discovery does not expose exact live seat counts, so use a provider inventory endpoint when exact availability is required.

## Buying tickets

Results show buying links in this priority order:

- `buyUrl` from your inventory provider, which should point to the event organizer, venue box office, or primary ticketing checkout.
- Ticketmaster event URL when using Ticketmaster search.
- Ticketmaster search and organizer or venue links as fallback discovery paths.

Ticketmaster's own help says verified Ticketmaster tickets are sold through Ticketmaster.com, the Ticketmaster app, or venue box offices.

## Provider endpoint response

Return JSON in this shape:

```json
{
  "name": "Miami Grand Prix",
  "venue": "Miami International Autodrome",
  "date": "2026-05-05",
  "availableSeats": 24718,
  "capacity": 65000,
  "sections": [
    { "name": "Turn 1 Grandstand", "available": 3926, "price": "$640+" }
  ],
  "sourceName": "Your inventory system",
  "sourceUrl": "https://example.com/event",
  "buyUrl": "https://example.com/event/tickets"
}
```
