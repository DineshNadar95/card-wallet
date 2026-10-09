from pathlib import Path

import pytest

from scraper.targets import TargetError, load_targets


def write(tmp_path: Path, body: str) -> Path:
    p = tmp_path / "targets.yaml"
    p.write_text(body)
    return p


def test_real_targets_file_is_valid():
    targets = load_targets()
    assert len(targets) >= 3
    assert all(t.url.startswith("https://") for t in targets)


@pytest.mark.parametrize(
    "url",
    [
        "https://www.nerdwallet.com/article/x",
        "https://thepointsguy.com/card",
        "https://www.bankrate.com/x",
    ],
)
def test_aggregators_are_rejected(tmp_path, url):
    with pytest.raises(TargetError, match="aggregator"):
        load_targets(write(tmp_path, f'cards:\n  - {{issuer: "B", name: "C", url: "{url}"}}\n'))


def test_http_and_duplicates_rejected(tmp_path):
    with pytest.raises(TargetError, match="https"):
        load_targets(
            write(tmp_path, 'cards:\n  - {issuer: "B", name: "C", url: "http://bank.test/c"}\n')
        )
    dup = (
        'cards:\n  - {issuer: "B", name: "C", url: "https://bank.test/1"}\n'
        '  - {issuer: "B", name: "C", url: "https://bank.test/2"}\n'
    )
    with pytest.raises(TargetError, match="duplicate"):
        load_targets(write(tmp_path, dup))
