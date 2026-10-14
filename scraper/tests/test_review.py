from decimal import Decimal as D
from types import SimpleNamespace

import anthropic
import httpx2
import pytest

from scraper.review import (
    ClaudeReviewer,
    RateCheck,
    TieBreak,
    TieBreakChoice,
    Verification,
)
from scraper.validate import Candidate

PAGE = (
    "Demo Card A. Earn 3X points on dining. "
    "5X on travel booked through Demo Travel. 2X on other travel."
)


def cand(category, rate, unit="points", evidence=""):
    return Candidate(category, D(rate), unit, None, None, evidence)


DINING = cand("dining", "3", evidence="Earn 3X points on dining")
TRAVEL = cand("travel", "5", evidence="5X on travel booked through Demo Travel")


def check(i, agrees, **kw):
    return RateCheck(
        index=i,
        agrees=agrees,
        category=kw.get("category"),
        rate=kw.get("rate"),
        unit=kw.get("unit"),
        evidence=kw.get("evidence"),
        reason=kw.get("reason", "because"),
    )


class FakeMessages:
    """Returns queued parsed outputs in order and records each call's kwargs."""

    def __init__(self, *outputs, error=None):
        self.outputs, self.error, self.calls = list(outputs), error, []

    async def parse(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        out = self.outputs.pop(0)
        stop = "refusal" if out == "refusal" else "end_turn"
        return SimpleNamespace(
            parsed_output=None if out == "refusal" else out, stop_reason=stop, _request_id="req_t"
        )


def reviewer(msgs):
    return ClaudeReviewer(SimpleNamespace(messages=msgs), "verify-model", "tiebreak-model")


async def test_agreement_keeps_rates_and_skips_the_tie_breaker():
    msgs = FakeMessages(Verification(checks=[check(0, True), check(1, True)]))
    out = await reviewer(msgs).review("Demo Card A", PAGE, [DINING, TRAVEL])

    assert [r.candidate for r in out] == [DINING, TRAVEL]
    assert all(r.note is None and not r.hold for r in out)
    assert len(msgs.calls) == 1  # verify only
    kw = msgs.calls[0]
    assert kw["model"] == "verify-model" and kw["output_format"] is Verification
    text = kw["messages"][0]["content"]
    assert PAGE in text and "<page>" in text
    assert "Earn 3X points on dining" in text  # the claims under review are shown
    assert "never use your own knowledge" in kw["system"].lower()


async def test_disagreement_goes_to_tie_breaker_which_can_side_with_the_verifier():
    msgs = FakeMessages(
        Verification(
            checks=[
                check(0, True),
                check(
                    1,
                    False,
                    rate=2.0,
                    unit="points",
                    evidence="2X on other travel",
                    reason="5X needs the portal; general travel is 2X",
                ),
            ]
        ),
        TieBreak(choices=[TieBreakChoice(index=1, pick="verifier", reason="portal-only rate")]),
    )
    out = await reviewer(msgs).review("Demo Card A", PAGE, [DINING, TRAVEL])

    assert out[0].candidate == DINING and out[0].note is None
    fixed = out[1].candidate
    assert (fixed.category, fixed.rate, fixed.unit, fixed.evidence) == (
        "travel",
        D("2.0"),
        "points",
        "2X on other travel",
    )
    assert not out[1].hold
    assert "tie-break chose the verifier" in out[1].note
    assert [c["model"] for c in msgs.calls] == ["verify-model", "tiebreak-model"]
    assert msgs.calls[1]["output_format"] is TieBreak


async def test_tie_breaker_can_keep_the_extractor_version():
    msgs = FakeMessages(
        Verification(checks=[check(0, False, rate=4.0, unit="points", evidence="x")]),
        TieBreak(choices=[TieBreakChoice(index=0, pick="extractor", reason="quote says 3X")]),
    )
    (r,) = await reviewer(msgs).review("Demo Card A", PAGE, [DINING])
    assert r.candidate == DINING and not r.hold
    assert "tie-break kept the extractor" in r.note


async def test_tie_breaker_neither_holds_the_rate_back():
    msgs = FakeMessages(
        Verification(checks=[check(0, False, rate=4.0)]),
        TieBreak(choices=[TieBreakChoice(index=0, pick="neither", reason="unclear")]),
    )
    (r,) = await reviewer(msgs).review("Demo Card A", PAGE, [DINING])
    assert r.hold and r.candidate == DINING
    assert "neither" in r.note


async def test_missing_check_or_choice_holds_back_rather_than_passing():
    # Verifier skipped index 1; tie-breaker skipped index 0.
    msgs = FakeMessages(
        Verification(checks=[check(0, False, rate=4.0)]),
        TieBreak(choices=[]),
    )
    out = await reviewer(msgs).review("Demo Card A", PAGE, [DINING, TRAVEL])
    assert all(r.hold for r in out)


@pytest.mark.parametrize(
    "error",
    [
        anthropic.APIConnectionError(request=httpx2.Request("POST", "https://x")),
        anthropic.InternalServerError(
            "boom",
            response=httpx2.Response(500, request=httpx2.Request("POST", "https://x")),
            body=None,
        ),
    ],
)
async def test_api_failure_holds_everything_back(error):
    out = await reviewer(FakeMessages(error=error)).review("Demo Card A", PAGE, [DINING, TRAVEL])
    assert all(r.hold for r in out)
    assert all("review failed" in r.note for r in out)


async def test_refusal_holds_everything_back():
    out = await reviewer(FakeMessages("refusal")).review("Demo Card A", PAGE, [DINING])
    assert out[0].hold


async def test_no_rates_means_no_calls():
    msgs = FakeMessages()
    assert await reviewer(msgs).review("Demo Card A", PAGE, []) == []
    assert msgs.calls == []
