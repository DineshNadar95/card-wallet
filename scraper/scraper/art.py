"""Pick a card's own picture (card art) from its issuer product page.

The image stays on the issuer's site: we store its URL and the app links to it, with the
issuer named as the source. Nothing is downloaded or re-hosted.

The rule, in order:
1. Drop obvious non-card images: icons, logos, badges, banners, SVGs, promo tiles, and
   anything whose known size isn't card-shaped (a card is 1.586:1).
2. Score each image by how many of the card's distinctive name words its alt text or file
   name contains ("Sapphire Preferred" -> sapphire, preferred), so a menu thumbnail of a
   sibling card ("Delta SkyMiles Gold" on the Gold Card page) loses to the card itself.
3. Accept an image that names the whole card, or half of it when it's clearly card art and
   names nothing else ("Prime Visa" for "Amazon Prime Rewards Visa Card").
4. Otherwise use the page's share image (og:image) if its path says it's card art.
Return None when unsure. The app then draws a plain colored card.
"""

import re
from collections.abc import Sequence
from urllib.parse import urlparse

from scraper.fetch import PageImage

# Words that don't tell one card from another.
GENERIC = {
    "american", "express", "amex", "chase", "citi", "capital", "one", "bank", "america", "bofa",
    "wells", "fargo", "discover", "card", "cards", "credit", "rewards", "reward", "visa",
    "signature", "mastercard", "world", "elite", "the", "from", "by", "of", "and", "with", "on",
    "for", "your", "a", "an", "no", "annual", "fee", "dagger", "new", "image", "art", "front",
    "chip", "contactless", "tap", "to", "pay", "png", "jpg", "jpeg", "webp", "ranged", "apr",
    "offering", "registered", "trademark", "service", "mark", "sm", "tm",
}  # fmt: skip
_SKIP = re.compile(
    r"icon|logo|badge|sprite|banner|social|promo|refer[-_ ]?a[-_ ]?friend|lockup|shimmer|flag"
    r"|feature|getty"
    r"|photograph|award|\.svg|\.gif",
    re.I,
)
_ART = re.compile(r"card[-_ ]?art|cardasset|creditcardart", re.I)
_ASPECT = (1.4, 1.8)
_MIN_WIDTH = 150


def _words(text: str) -> list[str]:
    text = re.sub(r"\([^)]*\)", " ", text.lower())  # "(Registered Trademark)", "(ranged APR…)"
    text = re.sub(r"[®™℠]", " ", text)
    return [w for w in re.split(r"[^a-z0-9]+", text) if w]


def name_tokens(card_name: str) -> set[str]:
    return {w for w in _words(card_name) if w not in GENERIC and not w.isdigit()}


def _mentions(text: str, token: str) -> bool:
    # Prefix match so "preferred" finds "sapphire-preferredcard2026.png"; short words exact.
    pat = rf"(?<![a-z0-9]){re.escape(token)}" + ("" if len(token) >= 4 else r"(?![a-z0-9])")
    return re.search(pat, text) is not None


def _filename(src: str) -> str:
    return " ".join(_words(urlparse(src).path.rsplit("/", 1)[-1]))


def pick_card_image(
    card_name: str, images: Sequence[PageImage], og_image: str | None = None
) -> str | None:
    tokens = name_tokens(card_name)
    if not tokens:
        return None
    best: tuple | None = None
    for idx, img in enumerate(images):
        if not img.src.startswith("https://") or _SKIP.search(img.src) or _SKIP.search(img.alt):
            continue
        if img.width and img.height:
            ratio = img.width / img.height
            if not (_ASPECT[0] <= ratio <= _ASPECT[1]) or img.width < _MIN_WIDTH:
                continue
        alt = " ".join(_words(img.alt))
        both = f"{alt} {_filename(img.src)}"
        frac = sum(_mentions(both, t) for t in tokens) / len(tokens)
        alt_frac = sum(_mentions(alt, t) for t in tokens) / len(tokens)
        extra = {w for w in alt.split() if w not in GENERIC and not w.isdigit() and len(w) > 2}
        extra = {w for w in extra if not any(_mentions(w, t) for t in tokens)}
        is_art = bool(_ART.search(img.src) or _ART.search(img.alt))
        ok = frac == 1 or (frac >= 0.5 and is_art and not extra)
        if not ok:
            continue
        key = (frac, alt_frac, is_art, -len(extra), -idx)
        if best is None or key > best[0]:
            best = (key, img.src)
    if best:
        return best[1]
    if og_image and og_image.startswith("https://") and _ART.search(og_image):
        return og_image
    return None
