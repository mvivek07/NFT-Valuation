"""
Live OpenSea API (v2) client — the report's "data queried using the OpenSea
API" requirement.

Given an OpenSea asset URL it fetches the asset, its collection statistics
(total + 1/7/30-day windows), the asset's event history and its best current
listing, and maps everything onto the dataset's feature names so the trained
models can score a live NFT.

Needs an OpenSea API key (free tier: https://docs.opensea.io/reference/api-keys)
passed explicitly or via the OPENSEA_API_KEY environment variable.
Twitter/X data cannot be fetched for free any more, so creator Twitter stats
are supplied by the user (or median-imputed by the pipeline).
"""

import os
import re
import urllib.request
import urllib.parse
import json

BASE = "https://api.opensea.io/api/v2"
TIMEOUT = 15

_URL_RE = re.compile(
    r"opensea\.io/(?:assets|item)/(?:(?P<chain>[a-z0-9_-]+)/)?(?P<contract>0x[0-9a-fA-F]{40})/(?P<token>\d+)"
)
_CHAIN_ALIASES = {"eth": "ethereum", "matic": "matic", "polygon": "matic"}


class OpenSeaError(Exception):
    pass


def parse_asset_url(url: str):
    """-> (chain, contract, token_id) from an opensea.io asset link."""
    m = _URL_RE.search(url or "")
    if not m:
        raise OpenSeaError(
            "Enter an OpenSea asset link like "
            "https://opensea.io/assets/ethereum/0x.../1234"
        )
    chain = (m.group("chain") or "ethereum").lower()
    return _CHAIN_ALIASES.get(chain, chain), m.group("contract"), m.group("token")


def _get(path: str, api_key: str, params: dict | None = None):
    url = f"{BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"accept": "application/json", "x-api-key": api_key})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            raise OpenSeaError("OpenSea rejected the API key (401/403). Check the key.") from e
        if e.code == 404:
            raise OpenSeaError("OpenSea could not find that asset (404). Check the link.") from e
        if e.code == 429:
            raise OpenSeaError("OpenSea rate limit hit (429). Wait a moment and retry.") from e
        raise OpenSeaError(f"OpenSea API error {e.code}.") from e


def eth_usd_rate() -> float | None:
    """Spot ETH price in USD (CoinGecko, no key). None if unreachable."""
    try:
        req = urllib.request.Request(
            "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
            headers={"accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=8) as r:
            return float(json.loads(r.read().decode())["ethereum"]["usd"])
    except Exception:
        return None


def _num(x, default=0.0):
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


def map_to_features(nft: dict, collection: dict, stats: dict, events: list,
                    best_listing: dict | None, eth_usd: float | None):
    """Translate raw API payloads into the dataset's feature columns."""
    total = stats.get("total", {}) or {}
    feats = {
        "floor_price": _num(total.get("floor_price")),
        "average_price": _num(total.get("average_price")),
        "total_sales": _num(total.get("sales")),
        "total_volume": _num(total.get("volume")),
        "market_cap": _num(total.get("market_cap")),
        "num_owners": _num(total.get("num_owners")),
        "total_supply": _num(collection.get("total_supply")),
    }
    for iv in stats.get("intervals", []) or []:
        name = (iv.get("interval") or "").lower()          # one_day / seven_day / thirty_day
        if name in ("one_day", "seven_day", "thirty_day"):
            feats[f"{name}_volume"] = _num(iv.get("volume"))
            feats[f"{name}_sales"] = _num(iv.get("sales"))
            feats[f"{name}_average_price"] = _num(iv.get("average_price"))
            feats[f"{name}_change"] = _num(iv.get("volume_change"))

    # event history -> counts by type (dataset columns: numEvents, successful, ...)
    counts = {"sale": 0, "transfer": 0, "order": 0, "cancel": 0, "redemption": 0}
    for ev in events:
        t = (ev.get("event_type") or "").lower()
        counts[t] = counts.get(t, 0) + 1
    feats.update({
        "numEvents": float(len(events)),
        "successful": float(counts.get("sale", 0)),
        "transfer": float(counts.get("transfer", 0)),
        "created": float(counts.get("order", 0)),
        "cancelled": float(counts.get("cancel", 0)),
    })

    listing_usd = None
    listing_native = None
    if best_listing:
        price = (best_listing.get("price") or {}).get("current") or {}
        decimals = int(price.get("decimals") or 18)
        value = _num(price.get("value"))
        listing_native = value / (10 ** decimals) if value else None
        cur = (price.get("currency") or "ETH").upper()
        if listing_native is not None:
            if cur in ("ETH", "WETH") and eth_usd:
                listing_usd = listing_native * eth_usd
            elif cur in ("USDC", "USDT", "DAI"):
                listing_usd = listing_native
    return feats, listing_usd, listing_native


def fetch_live_asset(chain: str, contract: str, token_id: str, api_key: str | None = None):
    key = (api_key or os.environ.get("OPENSEA_API_KEY") or "").strip()
    if not key:
        raise OpenSeaError(
            "An OpenSea API key is required for live lookups. Paste one in the form "
            "or set OPENSEA_API_KEY in the server environment."
        )

    nft = _get(f"/chain/{chain}/contract/{contract}/nfts/{token_id}", key).get("nft", {})
    slug = nft.get("collection")
    if not slug:
        raise OpenSeaError("Asset found but it has no collection on OpenSea — cannot compute market features.")
    collection = _get(f"/collections/{slug}", key)
    stats = _get(f"/collections/{slug}/stats", key)
    events = _get(f"/events/chain/{chain}/contract/{contract}/nfts/{token_id}", key,
                  {"limit": 50}).get("asset_events", []) or []
    try:
        best = _get(f"/listings/collection/{slug}/nfts/{token_id}/best", key)
    except OpenSeaError:
        best = None

    eth_usd = eth_usd_rate()
    feats, listing_usd, listing_native = map_to_features(nft, collection, stats, events, best, eth_usd)
    return {
        "name": nft.get("name") or f"{collection.get('name', slug)} #{token_id}",
        "collection": collection.get("name", slug),
        "image_url": nft.get("image_url") or nft.get("display_image_url"),
        "opensea_url": nft.get("opensea_url") or f"https://opensea.io/assets/{chain}/{contract}/{token_id}",
        "chain": chain,
        "eth_usd": eth_usd,
        "listing_usd": listing_usd,
        "listing_native": listing_native,
        "n_events": len(events),
        "features": feats,
    }
