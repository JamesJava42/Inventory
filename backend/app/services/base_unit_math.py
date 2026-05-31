"""
Unit conversion for liquor store inventory.

Rule: the database always stores current_units as individual cans/bottles.
This module converts between that canonical form and human-readable displays
(cases / packs / singles) and vice-versa.

Container hierarchy example for a 24-pack beer:
  units_per_case = 24   (1 case = 24 cans)
  units_per_pack = 6    (1 pack = 6 cans)
  loose singles are whatever is left over

For wine / spirits that ship in 12-bottle cases with no "pack" concept,
set units_per_pack = 1 (every bottle is its own pack).
"""

from __future__ import annotations

from dataclasses import dataclass


# ---------------------------------------------------------------------------
# Standard container sizes for quick item creation
# ---------------------------------------------------------------------------

CONTAINER_UNITS: dict[str, int] = {
    "single": 1,
    "six_pack": 6,
    "twelve_pack": 12,
    "flat_18": 18,
    "case_24": 24,
    "case_30": 30,
    "case_12": 12,   # wine / spirits
    "case_6": 6,     # spirits (handles, etc.)
}


@dataclass(frozen=True)
class StockDisplay:
    cases: int
    packs: int
    singles: int
    total_units: int

    def as_dict(self) -> dict[str, int]:
        return {
            "cases": self.cases,
            "packs": self.packs,
            "singles": self.singles,
            "total_units": self.total_units,
        }

    def __str__(self) -> str:
        parts: list[str] = []
        if self.cases:
            parts.append(f"{self.cases} case{'s' if self.cases != 1 else ''}")
        if self.packs:
            parts.append(f"{self.packs} pack{'s' if self.packs != 1 else ''}")
        if self.singles:
            parts.append(f"{self.singles} single{'s' if self.singles != 1 else ''}")
        return ", ".join(parts) if parts else "0"


def to_display(total_units: int, units_per_case: int, units_per_pack: int) -> StockDisplay:
    """Convert a raw unit count into a human-readable breakdown."""
    if units_per_case <= 0:
        raise ValueError("units_per_case must be positive")
    if units_per_pack <= 0:
        raise ValueError("units_per_pack must be positive")
    if units_per_pack > units_per_case:
        raise ValueError("units_per_pack cannot exceed units_per_case")

    cases, remainder = divmod(total_units, units_per_case)
    # When pack size is 1 there is no meaningful "pack" concept — fold into singles
    if units_per_pack == 1:
        packs, singles = 0, remainder
    else:
        packs, singles = divmod(remainder, units_per_pack)
    return StockDisplay(cases=cases, packs=packs, singles=singles, total_units=total_units)


def from_display(
    cases: int = 0,
    packs: int = 0,
    singles: int = 0,
    units_per_case: int = 24,
    units_per_pack: int = 6,
) -> int:
    """Convert a human entry (cases + packs + singles) to a total unit count."""
    if cases < 0 or packs < 0 or singles < 0:
        raise ValueError("Counts cannot be negative")
    return cases * units_per_case + packs * units_per_pack + singles


def delta_units(
    scan_cases: int = 0,
    scan_packs: int = 0,
    scan_singles: int = 0,
    units_per_case: int = 24,
    units_per_pack: int = 6,
    subtract: bool = False,
) -> int:
    """
    Convert a scanned quantity into a signed delta for the ledger.
    subtract=True for sales/removals, False for restocks/additions.
    """
    total = from_display(scan_cases, scan_packs, scan_singles, units_per_case, units_per_pack)
    return -total if subtract else total


def validate_delta(current_units: int, delta: int) -> None:
    """Raise ValueError if applying delta would result in negative stock."""
    if current_units + delta < 0:
        raise ValueError(
            f"Delta {delta} would reduce stock below zero "
            f"(current: {current_units})"
        )
