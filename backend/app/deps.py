from datetime import date


def get_today() -> date:
    """Today's date for date-based rules (offer status, reminders). Overridden in tests."""
    return date.today()
