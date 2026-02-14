def _coerce_value(val, attr_value):
    """Coerce filter value to building attribute type (number vs string)."""
    if attr_value is None:
        return val
    if isinstance(attr_value, (int, float)):
        if isinstance(val, str):
            try:
                return float(val) if "." in val or "e" in val.lower() else int(val)
            except (ValueError, TypeError):
                return val
        return val
    return val


def apply_filters(buildings, filters):
    ops = {
        "=": lambda a, b: a == b,
        "==": lambda a, b: a == b,
        "!=": lambda a, b: a != b,
        ">": lambda a, b: a is not None and b is not None and a > b,
        ">=": lambda a, b: a is not None and b is not None and a >= b,
        "<": lambda a, b: a is not None and b is not None and a < b,
        "<=": lambda a, b: a is not None and b is not None and a <= b,
        "contains": lambda a, b: (a is not None) and (str(b).lower() in str(a).lower()),
    }

    out = buildings
    for f in (filters or []):
        attr = f.get("attribute")
        op = f.get("operator")
        val = f.get("value")

        if attr is None or op not in ops:
            continue
        # Skip assessment filter (field removed from data)
        if attr == "assessed_value":
            continue

        fn = ops[op]

        def keep(b, attribute=attr, operator=op, value=val):
            a = b.get(attribute)
            v = _coerce_value(value, a)
            return fn(a, v)

        out = list(filter(keep, out))

    return out
