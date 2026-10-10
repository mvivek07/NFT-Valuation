"""
Live OpenSea API (v2) client — the report's "data queried using the OpenSea
API" requirement.

Given an OpenSea asset URL it fetches the asset, its collection and the
collection's statistics (total + 1/7/30-day windows) and maps them onto the
dataset's feature names so the trained models can score a live NFT.

API key
-------
The asset, collection and statistics endpoints currently answer without a key.
The asset's event history and its current listing price require one. A key is
therefore OPTIONAL: without it the lookup still works but those two parts are
skipped (their inputs fall back to typical values and there is no asking-price
check). Pass a key explicitly or set OPENSEA_API_KEY.

  * Instant 7-day test key, no sign-up:
        curl -X POST https://api.opensea.io/api/v2/auth/keys
  * Permanent key: opensea.io -> Settings -> Developer

Twitter/X data cannot be fetched for free any more, so creator Twitter stats
are supplied by the user (or median-imputed by the pipeline).
"""

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://api.opensea.io/api/v2"
TIMEOUT = 15

_URL_RE = re.compile(
    r"opensea\.io/(?:[a-z]{2}(?:-[A-Z]{2})?/)?(?:assets|item)/(?:(?P<chain>[a-z0-9_-]+)/)?"
    r"(?P<contract>0x[0-9a-fA-F]{40})/(?P<token>\d+)"
)
_CHAIN_ALIASES = {"eth": "ethereum", "polygon": "matic"}


class OpenSeaError(Exception):
    pass


class _NeedsKey(Exception):
    pass


class _BadKey(OpenSeaError):
    pass


def parse_asset_url(url: str):
    """-> (chain, contract, token_id) from an opensea.io asset link."""
    m = _URL_RE.search(url or "")
    if not m:
        raise OpenSeaError(
            "Enter an OpenSea NFT link like "
            "https://opensea.io/assets/ethereum/0x.../1234"
        )
    chain = (m.group("chain") or "ethereum").lower()
    return _CHAIN_ALIASES.get(chain, chain), m.group("contract"), m.group("token")


def _get(path: str, api_key: str = "", params: dict | None = None):
    url = f"{BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    headers = {"accept": "application/json", "user-agent": "nft-valuator/1.0"}
    if api_key:
        headers["x-api-key"] = api_key
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            if not api_key:
                raise _NeedsKey() from e
            raise _BadKey("OpenSea rejected the API key. Check that it is correct and not expired.") from e
        if e.code in (400, 404):
            raise OpenSeaError("OpenSea could not find that NFT. Check the link.") from e
        if e.code == 429:
            raise OpenSeaError("OpenSea's rate limit was hit. Wait a minute and try again"
                               + ("." if api_key else ", or add an API key for a higher limit.")) from e
        raise OpenSeaError(f"OpenSea returned an error ({e.code}). Try again shortly.") from e
    except urllib.error.URLError as e:
        raise OpenSeaError("Could not reach OpenSea. Check the server's internet connection.") from e


def eth_usd_rate() -> float | None:
    """Spot ETH price in USD (CoinGecko, no key). None if unreachable."""
    try:
        req = urllib.request.Request(
            "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
            headers={"accept": "application/json", "user-agent": "nft-valuator/1.0"},
        )
        with urllib.request.urlopen(req, timeout=8) as r:
            return float(json.loads(r.read().decode())["ethereum"]["usd"])
    except Exception:
        return None


def _num(x):
    """float(x) or None when the value is missing / not a number."""
    try:
        v = float(x)
        return v if v == v and v not in (float("inf"), float("-inf")) else None
    except (TypeError, ValueError):
        return None


def _avg(volume, sales):
    """Average price = volume / sales (OpenSea no longer returns it directly)."""
    if volume is None or sales is None:
        return None
    return volume / sales if sales > 0 else 0.0


def map_to_features(collection: dict, stats: dict, events: list | None,
                    best_listing: dict | None, eth_usd: float | None):
    """Translate raw API payloads into the dataset's feature columns.

    Values that OpenSea does not provide are left out (None), so the pipeline
    fills them with the dataset's typical value instead of a misleading zero.
    """
    total = stats.get("total", {}) or {}
    volume, sales = _num(total.get("volume")), _num(total.get("sales"))
    supply = _num(collection.get("total_supply"))
    feats = {
        "floor_price": _num(total.get("floor_price")),
        "total_volume": volume,
        "total_sales": sales,
        "num_owners": _num(total.get("num_owners")),
        "average_price": _num(total.get("average_price")) if total.get("average_price") is not None else _avg(volume, sales),
        "market_cap": _num(total.get("market_cap")),
        "total_supply": supply,
        "count": _num(collection.get("unique_item_count")) or supply,
    }
    if collection.get("safelist_status"):
        feats["is_collection_verified"] = 1.0 if collection["safelist_status"] == "verified" else 0.0

    for iv in stats.get("intervals", []) or []:
        name = (iv.get("interval") or "").lower()          # one_day / seven_day / thirty_day
        if name not in ("one_day", "seven_day", "thirty_day"):
            continue
        v, s = _num(iv.get("volume")), _num(iv.get("sales"))
        feats[f"{name}_volume"] = v
        feats[f"{name}_sales"] = s
        feats[f"{name}_average_price"] = (
            _num(iv.get("average_price")) if iv.get("average_price") is not None else _avg(v, s))
        feats[f"{name}_change"] = _num(iv.get("volume_change"))

    # 2021-era market cap = 7-day average price x supply
    if feats["market_cap"] is None and supply and feats.get("seven_day_average_price"):
        feats["market_cap"] = feats["seven_day_average_price"] * supply

    # event history -> counts by type (dataset columns: numEvents, successful, ...)
    if events is not None:
        c = {"sale": 0, "transfer": 0, "listing": 0, "offer": 0}
        for ev in events:
            t = (ev.get("event_type") or "").lower()
            if t == "order":
                ot = (ev.get("order_type") or "").lower()
                t = "listing" if "listing" in ot else "offer" if "offer" in ot else "order"
            elif t == "mint":
                t = "transfer"
            c[t] = c.get(t, 0) + 1
        feats.update({
            "numEvents": float(len(events)),
            "successful": float(c["sale"]),
            "transfer": float(c["transfer"]),
            "created": float(c["listing"]),
            "offer_entered": float(c["offer"]),
        })

    listing_usd = listing_native = None
    if best_listing:
        price = (best_listing.get("price") or {}).get("current") or {}
        value = _num(price.get("value"))
        decimals = int(price.get("decimals") or 18)
        cur = (price.get("currency") or "ETH").upper()
        if value:
            listing_native = value / (10 ** decimals)
            if cur in ("ETH", "WETH") and eth_usd:
                listing_usd = listing_native * eth_usd
            elif cur in ("USDC", "USDT", "DAI"):
                listing_usd = listing_native

    return {k: v for k, v in feats.items() if v is not None}, listing_usd, listing_native


def fetch_live_asset(chain: str, contract: str, token_id: str, api_key: str | None = None):
    key = (api_key or os.environ.get("OPENSEA_API_KEY") or "").strip()
    no_key_msg = ("OpenSea asked for an API key for this request. Paste one in the form "
                  "(get an instant test key with: curl -X POST https://api.opensea.io/api/v2/auth/keys).")
    try:
        nft = _get(f"/chain/{chain}/contract/{contract}/nfts/{token_id}", key).get("nft", {})
        slug = nft.get("collection")
        if not slug:
            raise OpenSeaError("That NFT has no collection on OpenSea, so its market data cannot be read.")
        collection = _get(f"/collections/{slug}", key)
        stats = _get(f"/collections/{slug}/stats", key)
    except _NeedsKey:
        raise OpenSeaError(no_key_msg) from None

    # these two need a key; without one they are skipped, not fatal
    skipped, events, best, key_rejected = [], None, None, False
    try:
        events = _get(f"/events/chain/{chain}/contract/{contract}/nfts/{token_id}", key,
                      {"limit": 200}).get("asset_events", []) or []
    except _BadKey:
        key_rejected = True
        skipped.append("event history")
    except (_NeedsKey, OpenSeaError):
        skipped.append("event history")
    try:
        best = _get(f"/listings/collection/{slug}/nfts/{token_id}/best", key)
    except _BadKey:
        key_rejected = True
        skipped.append("listing price")
    except _NeedsKey:
        skipped.append("listing price")
    except OpenSeaError:
        best = None                      # simply not listed for sale

    eth_usd = eth_usd_rate() if best else None
    feats, listing_usd, listing_native = map_to_features(collection, stats, events, best, eth_usd)
    return {
        "name": nft.get("name") or f"{collection.get('name', slug)} #{token_id}",
        "collection": collection.get("name", slug),
        "image_url": nft.get("display_image_url") or nft.get("image_url"),
        "opensea_url": nft.get("opensea_url") or f"https://opensea.io/assets/{chain}/{contract}/{token_id}",
        "chain": chain,
        "used_key": bool(key) and not key_rejected,
        "key_rejected": key_rejected,
        "skipped": skipped,
        "eth_usd": eth_usd,
        "listing_usd": listing_usd,
        "listing_native": listing_native,
        "n_events": None if events is None else len(events),
        "n_features": len(feats),
        "features": feats,
    }
