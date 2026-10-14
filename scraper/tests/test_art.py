"""Card-art picking. Fake cards and URLs only (CLAUDE.md rule 1)."""

from scraper.art import name_tokens, pick_card_image
from scraper.fetch import PageImage, images_from_html

ART = "https://demo-bank.test/content/card-art"


def img(src, alt="", w=300, h=189):
    return PageImage(src, alt, w, h)


def test_name_tokens_drop_issuer_and_generic_words():
    assert name_tokens("Demo Bank Orbit Preferred® Card (ranged APR offering)") == {
        "demo",
        "orbit",
        "preferred",
    }
    assert name_tokens("Credit Card") == set()


def test_picks_the_cards_own_art_over_a_sibling_in_the_menu():
    images = [
        img(f"{ART}/comet-gold.png", "Demo Comet Gold Card"),  # nav thumbnail of another card
        img(f"{ART}/orbit-gold.png", "Demo Orbit Gold Card"),
    ]
    assert pick_card_image("Demo Orbit Gold Card", images) == f"{ART}/orbit-gold.png"


def test_prefers_alt_text_and_card_art_paths_on_ties():
    images = [
        img("https://demo-bank.test/img/orbit-business.webp"),  # name only in the file name
        img("https://demo-bank.test/img/hero-orbit.png", "Demo Orbit card"),
        img(f"{ART}/orbit.png", "Demo Orbit card"),
    ]
    assert pick_card_image("Demo Orbit Card", images) == f"{ART}/orbit.png"


def test_skips_icons_badges_svgs_and_shapes_that_arent_cards():
    images = [
        img("https://demo-bank.test/icons/orbit-icon.png", "Demo Orbit"),
        img("https://demo-bank.test/orbit-badge.png", "Demo Orbit award badge"),
        img("https://demo-bank.test/orbit.svg", "Demo Orbit"),
        img("https://demo-bank.test/orbit-wide.jpg", "Demo Orbit", w=1220, h=627),
        img("https://demo-bank.test/orbit-tiny.png", "Demo Orbit", w=60, h=38),
        img("https://demo-bank.test/refer-a-friend.png", "Refer a friend: Demo Orbit"),
    ]
    assert pick_card_image("Demo Orbit Card", images) is None


def test_refer_filter_does_not_catch_preferred():
    images = [img(f"{ART}/orbit-preferredcard2026.png", "Demo Orbit Preferred credit card")]
    assert pick_card_image("Demo Orbit Preferred", images) == images[0].src


def test_unknown_sizes_are_allowed():
    images = [img(f"{ART}/orbit.png", "Demo Orbit Card", w=0, h=0)]
    assert pick_card_image("Demo Orbit Card", images) == images[0].src


def test_half_a_name_only_counts_for_clear_card_art_naming_nothing_else():
    # "Orbit Prime Rewards Visa Card" is sold as "Prime"; the art says so and names nothing else.
    prime = img(f"{ART}/prime.png", "Prime NO ANNUAL FEE")
    assert pick_card_image("Orbit Prime Rewards Visa Card", [prime]) == prime.src
    # A sibling sharing one word, even as card art, is not this card.
    sibling = img(f"{ART}/orbit-everyday.png", "Demo Orbit Everyday")
    assert pick_card_image("Demo Orbit Preferred", [sibling]) is None
    # Half a name without a card-art signal isn't enough.
    plain = img("https://demo-bank.test/img/prime.png", "Prime")
    assert pick_card_image("Orbit Prime Rewards Visa Card", [plain]) is None


def test_falls_back_to_share_image_only_when_it_is_card_art():
    unnamed = [img("https://demo-bank.test/img/x_300x188.png")]
    og = "https://demo-bank.test/images/CreditCardArt/8xyz_250x158.png"
    assert pick_card_image("Demo Orbit Card", unnamed, og) == og
    assert pick_card_image("Demo Orbit Card", unnamed, "https://demo-bank.test/social.jpg") is None
    assert pick_card_image("Demo Orbit Card", [], "http://demo-bank.test/card-art/x.png") is None


def test_images_from_html_reads_imgs_and_og_with_absolute_urls():
    html = """<html><head><meta property="og:image" content="/og/orbit.png"></head><body>
      <img src="/card-art/orbit.png" alt="Demo Orbit" width="300" height="189">
      <img data-src="https://cdn.demo-bank.test/lazy.png">
      <img src="data:image/png;base64,AAAA" alt="tracking pixel">
      <img src="http://demo-bank.test/insecure.png">
    </body></html>"""
    found = images_from_html(html, "https://demo-bank.test/cards/orbit/")
    assert found["og"] == "https://demo-bank.test/og/orbit.png"
    assert found["imgs"] == [
        {"src": "https://demo-bank.test/card-art/orbit.png", "alt": "Demo Orbit", "width": 300,
         "height": 189},
        {"src": "https://cdn.demo-bank.test/lazy.png", "alt": "", "width": 0, "height": 0},
    ]  # fmt: skip
