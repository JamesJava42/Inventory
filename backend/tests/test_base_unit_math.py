import pytest
from app.services.base_unit_math import (
    StockDisplay,
    delta_units,
    from_display,
    to_display,
    validate_delta,
)


# ---------------------------------------------------------------------------
# to_display
# ---------------------------------------------------------------------------

class TestToDisplay:
    def test_exact_cases(self):
        d = to_display(48, units_per_case=24, units_per_pack=6)
        assert d == StockDisplay(cases=2, packs=0, singles=0, total_units=48)

    def test_cases_and_packs(self):
        d = to_display(30, units_per_case=24, units_per_pack=6)
        assert d == StockDisplay(cases=1, packs=1, singles=0, total_units=30)

    def test_cases_packs_singles(self):
        d = to_display(33, units_per_case=24, units_per_pack=6)
        assert d == StockDisplay(cases=1, packs=1, singles=3, total_units=33)

    def test_only_singles(self):
        d = to_display(3, units_per_case=24, units_per_pack=6)
        assert d == StockDisplay(cases=0, packs=0, singles=3, total_units=3)

    def test_zero(self):
        d = to_display(0, units_per_case=24, units_per_pack=6)
        assert d == StockDisplay(cases=0, packs=0, singles=0, total_units=0)

    def test_thirty_pack_beer(self):
        # 1 case-30 + 2 singles
        d = to_display(32, units_per_case=30, units_per_pack=1)
        assert d.cases == 1
        assert d.singles == 2

    def test_wine_case_12(self):
        d = to_display(25, units_per_case=12, units_per_pack=1)
        assert d.cases == 2
        assert d.singles == 1

    def test_invalid_units_per_case(self):
        with pytest.raises(ValueError):
            to_display(10, units_per_case=0, units_per_pack=6)

    def test_invalid_pack_exceeds_case(self):
        with pytest.raises(ValueError):
            to_display(10, units_per_case=6, units_per_pack=12)

    def test_str_representation(self):
        d = to_display(33, units_per_case=24, units_per_pack=6)
        assert str(d) == "1 case, 1 pack, 3 singles"

    def test_str_zero(self):
        d = to_display(0, units_per_case=24, units_per_pack=6)
        assert str(d) == "0"

    def test_str_single_case(self):
        d = to_display(24, units_per_case=24, units_per_pack=6)
        assert str(d) == "1 case"


# ---------------------------------------------------------------------------
# from_display
# ---------------------------------------------------------------------------

class TestFromDisplay:
    def test_cases_only(self):
        assert from_display(cases=2, units_per_case=24, units_per_pack=6) == 48

    def test_mixed(self):
        assert from_display(cases=1, packs=1, singles=3, units_per_case=24, units_per_pack=6) == 33

    def test_zero(self):
        assert from_display() == 0

    def test_negative_raises(self):
        with pytest.raises(ValueError):
            from_display(cases=-1, units_per_case=24, units_per_pack=6)

    def test_round_trip(self):
        original = 47
        d = to_display(original, 24, 6)
        result = from_display(d.cases, d.packs, d.singles, 24, 6)
        assert result == original


# ---------------------------------------------------------------------------
# delta_units
# ---------------------------------------------------------------------------

class TestDeltaUnits:
    def test_restock_addition(self):
        d = delta_units(scan_cases=2, units_per_case=24, units_per_pack=6)
        assert d == 48

    def test_sale_subtraction(self):
        d = delta_units(scan_packs=1, units_per_case=24, units_per_pack=6, subtract=True)
        assert d == -6

    def test_mixed_restock(self):
        d = delta_units(scan_cases=1, scan_packs=2, scan_singles=3,
                        units_per_case=24, units_per_pack=6)
        assert d == 39  # 24 + 12 + 3

    def test_zero_delta(self):
        assert delta_units() == 0


# ---------------------------------------------------------------------------
# validate_delta
# ---------------------------------------------------------------------------

class TestValidateDelta:
    def test_valid_positive_delta(self):
        validate_delta(current_units=10, delta=5)  # no exception

    def test_valid_negative_delta(self):
        validate_delta(current_units=10, delta=-10)  # exactly zero, no exception

    def test_would_go_negative(self):
        with pytest.raises(ValueError, match="below zero"):
            validate_delta(current_units=5, delta=-6)

    def test_zero_stock_no_sale(self):
        with pytest.raises(ValueError):
            validate_delta(current_units=0, delta=-1)
