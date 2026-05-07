const form = document.querySelector("#seat-form");
const emptyState = document.querySelector("#empty-state");
const loadingState = document.querySelector("#loading-state");
const resultState = document.querySelector("#result-state");
const errorState = document.querySelector("#error-state");
const endpointRow = document.querySelector("#endpoint-row");
const ticketmasterRow = document.querySelector("#ticketmaster-row");

const demoEvents = [
  {
    keywords: ["miami grand prix", "f1", "formula 1"],
    place: "miami",
    date: "2026-05-05",
    name: "Miami Grand Prix",
    venue: "Miami International Autodrome",
    availableSeats: 24718,
    capacity: 65000,
    sections: [
      { name: "Start / Finish Grandstand", available: 2140, price: "$785+" },
      { name: "Turn 1 Grandstand", available: 3926, price: "$640+" },
      { name: "Marina Grandstand", available: 5140, price: "$520+" },
      { name: "Campus Pass", available: 13512, price: "$165+" },
    ],
    sourceUrl: "https://f1miamigp.com/",
    buyUrl: "https://f1miamigp.com/tickets/",
  },
  {
    keywords: ["knicks", "new york knicks"],
    place: "new york",
    date: "2026-05-05",
    name: "New York Knicks",
    venue: "Madison Square Garden",
    availableSeats: 1488,
    capacity: 19812,
    sections: [
      { name: "Lower Bowl", available: 124, price: "$240+" },
      { name: "Chase Bridge", available: 268, price: "$178+" },
      { name: "Upper Bowl", available: 1096, price: "$92+" },
    ],
    sourceUrl: "https://www.msg.com/madison-square-garden",
    buyUrl: "https://www.ticketmaster.com/search?q=New%20York%20Knicks",
  },
  {
    keywords: ["beyonce", "concert"],
    place: "miami",
    date: "2026-05-05",
    name: "Beyonce",
    venue: "Hard Rock Stadium",
    availableSeats: 9304,
    capacity: 65000,
    sections: [
      { name: "Floor", available: 422, price: "$390+" },
      { name: "100 Level", available: 1870, price: "$260+" },
      { name: "200 Level", available: 3018, price: "$180+" },
      { name: "300 Level", available: 3994, price: "$95+" },
    ],
    sourceUrl: "https://www.hardrockstadium.com/",
    buyUrl: "https://www.ticketmaster.com/search?q=Beyonce%20Miami",
  },
];

document.querySelectorAll("input[name='source']").forEach((input) => {
  input.addEventListener("change", updateSourceControls);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const query = {
    event: clean(formData.get("event")),
    date: clean(formData.get("date")),
    place: clean(formData.get("place")),
    source: formData.get("source"),
    endpoint: clean(formData.get("endpoint")),
    ticketmasterKey: clean(formData.get("ticketmasterKey")),
  };

  setState("loading");

  try {
    const data = await getAvailability(query);
    renderResult(data, query);
    setState("result");
  } catch (error) {
    renderError(error.message);
    setState("error");
  }
});

updateSourceControls();

function updateSourceControls() {
  const source = document.querySelector("input[name='source']:checked").value;
  endpointRow.classList.toggle("is-hidden", source !== "endpoint");
  ticketmasterRow.classList.toggle("is-hidden", source !== "ticketmaster");
}

async function getAvailability(query) {
  if (query.source === "endpoint") {
    return fetchProviderEndpoint(query);
  }

  if (query.source === "ticketmaster") {
    return fetchTicketmaster(query);
  }

  return getDemoAvailability(query);
}

function getDemoAvailability(query) {
  const normalizedEvent = query.event.toLowerCase();
  const normalizedPlace = query.place.toLowerCase();
  const matched = demoEvents.find((event) => {
    const eventMatches = event.keywords.some((keyword) => normalizedEvent.includes(keyword));
    const placeMatches = !normalizedPlace || event.place.includes(normalizedPlace);
    return eventMatches && placeMatches && event.date === query.date;
  });

  if (matched) {
    return { ...matched, sourceName: "Demo inventory" };
  }

  const seed = hash(`${query.event}-${query.date}-${query.place}`);
  const capacity = 18000 + (seed % 62000);
  const availableSeats = 300 + (seed % Math.max(500, Math.floor(capacity * 0.58)));
  return {
    name: titleCase(query.event),
    venue: query.place ? `${titleCase(query.place)} event venue` : "Venue to be confirmed",
    date: query.date,
    availableSeats,
    capacity,
    sections: buildGeneratedSections(seed, availableSeats),
    sourceName: "Demo inventory",
    sourceUrl: "",
    buyUrl: "",
  };
}

async function fetchProviderEndpoint(query) {
  if (!query.endpoint) {
    throw new Error("Add an inventory API URL before checking provider inventory.");
  }

  const url = new URL(query.endpoint);
  url.searchParams.set("event", query.event);
  url.searchParams.set("date", query.date);
  if (query.place) url.searchParams.set("place", query.place);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`The provider endpoint returned ${response.status}.`);
  }

  const data = await response.json();
  if (!Number.isFinite(Number(data.availableSeats))) {
    throw new Error("The provider response needs an availableSeats number.");
  }

  return {
    name: data.name || titleCase(query.event),
    venue: data.venue || query.place || "Venue unavailable",
    date: data.date || query.date,
    availableSeats: Number(data.availableSeats),
    capacity: Number(data.capacity) || Number(data.availableSeats),
    sections: Array.isArray(data.sections) ? data.sections : [],
    sourceName: data.sourceName || "Provider endpoint",
    sourceUrl: data.sourceUrl || "",
    buyUrl: data.buyUrl || data.checkoutUrl || data.ticketUrl || "",
  };
}

async function fetchTicketmaster(query) {
  if (!query.ticketmasterKey) {
    throw new Error("Paste a Ticketmaster API key to search Ticketmaster.");
  }

  const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  url.searchParams.set("apikey", query.ticketmasterKey);
  url.searchParams.set("keyword", query.event);
  url.searchParams.set("startDateTime", `${query.date}T00:00:00Z`);
  url.searchParams.set("endDateTime", `${query.date}T23:59:59Z`);
  if (query.place) url.searchParams.set("city", query.place);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Ticketmaster returned ${response.status}. Check the API key and search fields.`);
  }

  const payload = await response.json();
  const event = payload?._embedded?.events?.[0];
  if (!event) {
    throw new Error("No Ticketmaster event matched that name, place, and date.");
  }

  const venue = event._embedded?.venues?.[0]?.name || query.place || "Venue unavailable";
  return {
    name: event.name,
    venue,
    date: event.dates?.start?.localDate || query.date,
    availableSeats: null,
    capacity: null,
    sections: [],
    sourceName: "Ticketmaster Discovery API",
    sourceUrl: event.url,
    buyUrl: event.url,
    caveat:
      "Ticketmaster Discovery can confirm matching events and ticket links, but it does not expose exact live seat counts. Use a provider inventory endpoint for exact availability.",
  };
}

function renderResult(data, query) {
  const hasSeatCount = Number.isFinite(data.availableSeats) && Number.isFinite(data.capacity);
  const soldSeats = hasSeatCount ? Math.max(data.capacity - data.availableSeats, 0) : null;
  const availablePercent = hasSeatCount && data.capacity ? Math.round((data.availableSeats / data.capacity) * 100) : 0;
  const sections = data.sections.length
    ? data.sections
    : [{ name: "Exact section inventory unavailable", available: data.availableSeats, price: "See provider" }];

  resultState.innerHTML = `
    <p class="eyebrow">${escapeHtml(data.sourceName)}</p>
    <h2>${escapeHtml(data.name)}</h2>
    <p class="section-meta">${escapeHtml(data.venue)} · ${formatDate(data.date || query.date)}</p>

    <div class="summary-grid">
      <div class="metric-card">
        <span class="metric-label">Available</span>
        <strong class="metric-value">${formatMetric(data.availableSeats)}</strong>
      </div>
      <div class="metric-card">
        <span class="metric-label">Capacity</span>
        <strong class="metric-value">${formatMetric(data.capacity)}</strong>
      </div>
      <div class="metric-card">
        <span class="metric-label">Sold / held</span>
        <strong class="metric-value">${formatMetric(soldSeats)}</strong>
      </div>
    </div>

    ${renderMeter(hasSeatCount, availablePercent)}

    <ul class="section-list">
      ${sections.map(renderSection).join("")}
    </ul>

    ${renderPurchasePanel(data, query)}
    <p class="note">${escapeHtml(
      data.caveat ||
        "Demo results are sample inventory. For production, connect a ticketing provider endpoint that returns availableSeats, capacity, section-level counts, and buyUrl."
    )}</p>
  `;
}

function renderSection(section) {
  const availableCount = Number(section.available);
  const available = Number.isFinite(availableCount) ? formatNumber(availableCount) : "N/A";
  return `
    <li class="section-row">
      <div>
        <div class="section-name">${escapeHtml(section.name || "Section")}</div>
        <div class="section-meta">${escapeHtml(section.price || "Price unavailable")}</div>
      </div>
      <div class="section-count">${available}</div>
    </li>
  `;
}

function renderMeter(hasSeatCount, availablePercent) {
  if (!hasSeatCount) {
    return "";
  }

  return `
    <div class="meter" aria-label="${availablePercent}% available">
      <div class="meter-fill" style="width: ${Math.max(0, Math.min(availablePercent, 100))}%"></div>
    </div>
  `;
}

function renderPurchasePanel(data, query) {
  const links = buildPurchaseLinks(data, query);
  if (!links.length && !data.sourceUrl) return "";

  return `
    <div class="purchase-panel">
      <div>
        <p class="purchase-title">Buy from a trusted source</p>
        <p class="section-meta">Prefer the event organizer, venue box office, or a verified ticketing provider.</p>
      </div>
      <div class="links-row">
        ${links.map(renderPurchaseLink).join("")}
        ${renderSourceLink(data)}
      </div>
    </div>
  `;
}

function renderPurchaseLink(link) {
  const className = link.primary ? "link-button buy-button" : "link-button";
  return `
    <a class="${className}" href="${escapeAttribute(link.url)}" target="_blank" rel="noreferrer">
      ${escapeHtml(link.label)}
    </a>
  `;
}

function renderSourceLink(data) {
  if (!data.sourceUrl || data.sourceUrl === data.buyUrl) return "";
  return `
    <a class="link-button" href="${escapeAttribute(data.sourceUrl)}" target="_blank" rel="noreferrer">
      View event site
    </a>
  `;
}

function buildPurchaseLinks(data, query) {
  const links = [];

  if (data.buyUrl) {
    links.push({
      label: data.sourceName === "Ticketmaster Discovery API" ? "Buy on Ticketmaster" : "Buy tickets",
      url: data.buyUrl,
      primary: true,
    });
  }

  const eventQuery = [data.name || query.event, data.venue || query.place].filter(Boolean).join(" ");
  const ticketmasterSearch = `https://www.ticketmaster.com/search?q=${encodeURIComponent(eventQuery)}`;
  if (!links.some((link) => link.url === ticketmasterSearch)) {
    links.push({
      label: "Search Ticketmaster",
      url: ticketmasterSearch,
      primary: !links.length,
    });
  }

  if (data.sourceUrl && !links.some((link) => link.url === data.sourceUrl)) {
    links.push({
      label: "Organizer or venue",
      url: data.sourceUrl,
      primary: !links.length,
    });
  }

  return links;
}

function renderError(message) {
  errorState.textContent = message;
}

function setState(state) {
  emptyState.classList.toggle("is-hidden", state !== "empty");
  loadingState.classList.toggle("is-hidden", state !== "loading");
  resultState.classList.toggle("is-hidden", state !== "result");
  errorState.classList.toggle("is-hidden", state !== "error");
}

function buildGeneratedSections(seed, total) {
  const first = Math.floor(total * (0.16 + ((seed % 9) / 100)));
  const second = Math.floor(total * (0.22 + ((seed % 7) / 100)));
  const third = Math.floor(total * (0.28 + ((seed % 5) / 100)));
  const fourth = Math.max(total - first - second - third, 0);
  return [
    { name: "Lower reserved", available: first, price: "$220+" },
    { name: "Club level", available: second, price: "$185+" },
    { name: "General grandstand", available: third, price: "$120+" },
    { name: "Standing / lawn", available: fourth, price: "$65+" },
  ];
}

function clean(value) {
  return String(value || "").trim();
}

function titleCase(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function hash(value) {
  return [...value].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMetric(value) {
  return Number.isFinite(value) ? formatNumber(value) : "N/A";
}

function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
