"""Keep installed transitive dependencies above the audited security floors."""

from importlib.metadata import version

import pytest
from packaging.version import Version


@pytest.mark.parametrize(
    ("package", "minimum"),
    [
        ("certifi", "2026.10.19"),
        ("httpx2", "2.16.0"),
        ("httpcore2", "2.16.0"),
        ("Pygments", "2.21.0"),
    ],
)
def test_dependency_security_floor(package, minimum):
    assert Version(version(package)) >= Version(minimum), (
        f"{package} must be upgraded to at least {minimum}"
    )
