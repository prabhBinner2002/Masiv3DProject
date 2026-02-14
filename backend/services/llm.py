"""Parse natural-language map queries into { attribute, operator, value } filters; falls back to regex if HF API fails."""
import json
import logging
import re
from typing import Optional

import requests

logger = logging.getLogger(__name__)

VALID_ATTRIBUTES = {
    "height", "height_m", "height_ft", "height_feet", "height_meters",
    "zoning", "address",
}

VALID_OPERATORS = {">", ">=", "<", "<=", "=", "==", "!=", "contains"}


def _clean_json_string(s: str) -> str:
    s = s.strip()
    # Remove markdown code blocks
    if s.startswith("```"):
        s = re.sub(r"^```\w*\n?", "", s)
        s = re.sub(r"\n?```\s*$", "", s)
    s = s.strip()
    # Find first { ... }
    start = s.find("{")
    if start == -1:
        return s
    depth = 0
    for i in range(start, len(s)):
        if s[i] == "{":
            depth += 1
        elif s[i] == "}":
            depth -= 1
            if depth == 0:
                return s[start : i + 1]
    return s[start:]


def parse_filter_from_llm_response(text: str) -> Optional[dict]:
    if not text or not text.strip():
        return None
    cleaned = _clean_json_string(text)
    try:
        obj = json.loads(cleaned)
    except json.JSONDecodeError:
        return None
    if not isinstance(obj, dict):
        return None
    attr = obj.get("attribute")
    if attr is None:
        attr = obj.get("field") or obj.get("key")
    op = obj.get("operator") or obj.get("op")
    val = obj.get("value")
    if attr is None or op is None:
        return None
    attr = str(attr).strip().lower().replace(" ", "_")
    if attr == "height_feet" or attr == "feet":
        attr = "height_ft"
    if attr == "height_meters" or attr == "meters":
        attr = "height_m"
    if attr not in VALID_ATTRIBUTES and attr not in {"height_ft", "height_m", "zoning", "address"}:
        if "height" in attr:
            attr = "height_ft" if "ft" in attr or "feet" in attr else "height_m"
        elif "zoning" in attr:
            attr = "zoning"
        elif "address" in attr:
            attr = "address"
        else:
            attr = "height_ft"  # safe default for "over 100 feet" style
    if op not in VALID_OPERATORS:
        op = ">"
    return {"attribute": attr, "operator": op, "value": val}


def _fallback_parse_query(user_query: str) -> Optional[dict]:
    if not user_query or not user_query.strip():
        return None
    q = user_query.strip().lower()
    # "over X feet" / "over 100 feet" / "buildings over 100 feet"
    m = re.search(r"over\s+([\d.]+)\s*(?:feet|ft|')", q)
    if m:
        return {"attribute": "height_ft", "operator": ">", "value": float(m.group(1))}
    m = re.search(r"over\s+([\d.]+)\s*(?:meters?|m)\b", q)
    if m:
        return {"attribute": "height_m", "operator": ">", "value": float(m.group(1))}
    # "under X feet" / "less than X feet"
    m = re.search(r"(?:under|less than|below)\s+([\d.]+)\s*(?:feet|ft|')", q)
    if m:
        return {"attribute": "height_ft", "operator": "<", "value": float(m.group(1))}
    m = re.search(r"(?:under|less than|below)\s+([\d.]+)\s*(?:meters?|m)\b", q)
    if m:
        return {"attribute": "height_m", "operator": "<", "value": float(m.group(1))}
    # "commercial" / "RC-G" / "zoning X"
    if "commercial" in q or "rc-g" in q or "zoning" in q:
        return {"attribute": "zoning", "operator": "contains", "value": q.split()[-1] if q.split() else "commercial"}
    return None


def query_llm_for_filter(user_query: str, api_token: str, model: str) -> Optional[dict]:
    if not user_query or not user_query.strip():
        return None

    if api_token and model:
        prompt = f"""Extract exactly one filter from this map query. Return ONLY a JSON object with keys "attribute", "operator", "value". No other text.

Query: {user_query}

Valid attributes: height_ft, height_m, zoning, address.
Valid operators: >, >=, <, <=, =, contains.

Examples:
- "buildings over 100 feet" -> {{"attribute": "height_ft", "operator": ">", "value": 100}}
- "commercial buildings" -> {{"attribute": "zoning", "operator": "contains", "value": "commercial"}}
- "show buildings in RC-G zoning" -> {{"attribute": "zoning", "operator": "contains", "value": "RC-G"}}

JSON:"""

        url = f"https://api-inference.huggingface.co/models/{model}"
        headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": 120,
                "return_full_text": False,
                "temperature": 0.1,
            },
        }

        try:
            r = requests.post(url, json=payload, headers=headers, timeout=30)
            r.raise_for_status()
            data = r.json()
        except requests.RequestException as e:
            logger.warning("HF Inference API request failed: %s", e)
            return _fallback_parse_query(user_query)
        except (KeyError, TypeError, ValueError) as e:
            logger.warning("HF Inference API response parse error: %s", e)
            return _fallback_parse_query(user_query)

        if isinstance(data, dict) and "error" in data:
            logger.warning("HF API error: %s", data.get("error"))
            return _fallback_parse_query(user_query)
        if isinstance(data, list) and len(data) > 0:
            first = data[0]
            if isinstance(first, dict) and "generated_text" in first:
                out = parse_filter_from_llm_response(first["generated_text"])
                if out:
                    return out
        if isinstance(data, dict) and "generated_text" in data:
            out = parse_filter_from_llm_response(data["generated_text"])
            if out:
                return out

    return _fallback_parse_query(user_query)
