from datetime import date, timedelta

from app.db.models import Offer, OfferKind, OfferSource, Profile, PushToken, UserCard
from app.jobs.reminders import PushResult, run_reminders
from tests.conftest import USER_A, USER_B
from tests.factories import make_card

TODAY = date(2026, 10, 9)


class FakeEmail:
    def __init__(self, fail=False):
        self.sent, self.fail = [], fail

    def send(self, to, subject, text):
        if self.fail:
            raise OSError("smtp down")
        self.sent.append((to, subject, text))


class FakePush:
    def __init__(self, invalid=(), fail=False):
        self.sent, self.invalid, self.fail = [], set(invalid), fail

    def send(self, tokens, title, body):
        if self.fail:
            raise OSError("expo down")
        self.sent.append((tuple(tokens), title, body))
        return PushResult(
            delivered=len(set(tokens) - self.invalid), invalid_tokens=set(tokens) & self.invalid
        )


def offer(db, user, merchant, days, remind=3, **kw):
    o = Offer(
        user_id=user.id,
        merchant=merchant,
        kind=kw.pop("kind", OfferKind.percent_back),
        value=kw.pop("value", 10),
        expires_at=TODAY + timedelta(days=days) if days is not None else None,
        remind_days=remind,
        source=OfferSource.typed,
        **kw,
    )
    db.add(o)
    db.commit()
    return o


def profile(db, user, email="a@example.test"):
    db.add(Profile(user_id=user.id, email=email, point_value_cents=1))
    db.commit()


def run(db, email=None, push=None, **kw):
    return run_reminders(db, TODAY, email=email or FakeEmail(), push=push or FakePush(), **kw)


def test_picks_offers_whose_reminder_day_has_come(db):
    profile(db, USER_A)
    due = offer(db, USER_A, "Due today", days=3, remind=3)
    late = offer(db, USER_A, "Missed yesterday", days=2, remind=3)  # catch up after a skipped run
    early = offer(db, USER_A, "Not yet", days=6, remind=5)
    off = offer(db, USER_A, "Reminders off", days=1, remind=0)
    expired = offer(db, USER_A, "Expired", days=-1, remind=3)
    no_date = offer(db, USER_A, "No end date", days=None, remind=3)
    week = offer(db, USER_A, "A week out", days=7, remind=7)

    email = FakeEmail()
    stats = run(db, email=email)

    assert stats.offers_reminded == 3
    ((to, subject, text),) = email.sent
    assert to == "a@example.test"
    assert subject == "3 offers ending soon"
    assert "Missed yesterday · 10% back · ends in 2 days" in text
    assert "Due today · 10% back · ends in 3 days" in text
    assert "A week out · 10% back · ends in 7 days" in text
    assert "Not yet" not in text

    db.expire_all()
    assert all(o.reminded_at is not None for o in (due, late, week))
    assert all(o.reminded_at is None for o in (early, off, expired, no_date))


def test_never_reminds_twice(db):
    profile(db, USER_A)
    offer(db, USER_A, "Demo Bistro", days=3)
    email = FakeEmail()
    run(db, email=email)
    run(db, email=email)
    assert len(email.sent) == 1


def test_one_message_per_user_on_each_channel(db):
    profile(db, USER_A, "a@example.test")
    profile(db, USER_B, "b@example.test")
    db.add_all(
        [
            PushToken(user_id=USER_A.id, token="ExponentPushToken[a1]"),
            PushToken(user_id=USER_A.id, token="ExponentPushToken[a2]"),
        ]
    )
    db.commit()
    offer(db, USER_A, "Demo Bistro", days=0, remind=3)
    offer(db, USER_B, "Demo Shoes", days=1, remind=3, kind=OfferKind.amount_off, value=20)

    email, push = FakeEmail(), FakePush()
    run(db, email=email, push=push)

    assert sorted(to for to, _, _ in email.sent) == ["a@example.test", "b@example.test"]
    assert push.sent == [
        (("ExponentPushToken[a1]", "ExponentPushToken[a2]"), "Demo Bistro: 10% back", "Ends today")
    ]
    b_text = next(t for to, _, t in email.sent if to.startswith("b"))
    assert "Demo Shoes · $20 off · ends tomorrow" in b_text


def test_mentions_the_card_for_card_linked_offers(db):
    profile(db, USER_A)
    card = make_card(db, "Demo Card A")
    uc = UserCard(user_id=USER_A.id, card_id=card.id, last4="1234")
    db.add(uc)
    db.commit()
    offer(db, USER_A, "Demo Bistro", days=3, user_card_id=uc.id)
    email = FakeEmail()
    run(db, email=email)
    assert "Demo Bistro · 10% back · ends in 3 days · use Demo Card A •••• 1234" in email.sent[0][2]


def test_push_only_user_and_invalid_tokens_removed(db):
    db.add_all(
        [
            PushToken(user_id=USER_A.id, token="ExponentPushToken[good]"),
            PushToken(user_id=USER_A.id, token="ExponentPushToken[gone]"),
        ]
    )
    db.commit()
    o = offer(db, USER_A, "Demo Bistro", days=3)
    push = FakePush(invalid={"ExponentPushToken[gone]"})
    stats = run(db, push=push)  # no profile email at all

    assert stats.offers_reminded == 1
    assert [t.token for t in db.query(PushToken)] == ["ExponentPushToken[good]"]
    db.expire_all()
    assert o.reminded_at is not None


def test_not_marked_when_nothing_was_delivered(db):
    profile(db, USER_A)
    o = offer(db, USER_A, "Demo Bistro", days=3)
    stats = run(db, email=FakeEmail(fail=True), push=FakePush(fail=True))
    assert stats.offers_reminded == 0 and stats.failures == 1
    db.expire_all()
    assert o.reminded_at is None  # tomorrow's run tries again


def test_one_channel_failing_still_counts(db):
    profile(db, USER_A)
    db.add(PushToken(user_id=USER_A.id, token="ExponentPushToken[a]"))
    db.commit()
    o = offer(db, USER_A, "Demo Bistro", days=3)
    run(db, email=FakeEmail(fail=True), push=FakePush())
    db.expire_all()
    assert o.reminded_at is not None


def test_user_without_any_channel_is_skipped_quietly(db):
    o = offer(db, USER_A, "Demo Bistro", days=3)
    stats = run(db)
    assert stats.offers_reminded == 0 and stats.users_without_channel == 1
    db.expire_all()
    assert o.reminded_at is None


def test_dry_run_sends_and_marks_nothing(db):
    profile(db, USER_A)
    o = offer(db, USER_A, "Demo Bistro", days=3)
    email = FakeEmail()
    stats = run(db, email=email, dry_run=True)
    assert stats.offers_due == 1 and email.sent == []
    db.expire_all()
    assert o.reminded_at is None


def test_disabled_channels_are_none(db):
    profile(db, USER_A)
    o = offer(db, USER_A, "Demo Bistro", days=3)
    stats = run_reminders(db, TODAY, email=None, push=None)
    assert stats.offers_reminded == 0
    db.expire_all()
    assert o.reminded_at is None
