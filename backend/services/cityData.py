"""Calgary building data: fetch from Open Data (Socrata), normalize geometry, optional zoning enrichment."""
import logging
import time
from typing import Optional, List, Any, Dict

import requests

logger = logging.getLogger(__name__)

# Downtown Calgary center (for local coordinate origin)
DOWNTOWN_ORIGIN_LAT = 51.047
DOWNTOWN_ORIGIN_LNG = -114.067

# Approximate meters per degree at Calgary latitude (~51°N)
M_PER_DEG_LAT = 111_000
M_PER_DEG_LNG = 69_800  # 111000 * cos(51°)


def to_float(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def centroid_of_ring(ring):
    if not ring:
        return None
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return (sum(xs) / len(xs), sum(ys) / len(ys))  # (lng, lat)


def outer_ring(geom_type: str, coords: Any) -> Optional[List]:
    if geom_type == "Polygon" and coords:
        return coords[0]
    if geom_type == "MultiPolygon" and coords:
        first = coords[0]
        if first and first[0]:
            return first[0]
    return None


def rings_for_geometry(geom_type: str, coords: Any) -> List[List]:
    out = []
    if geom_type == "Polygon" and coords:
        for ring in coords:
            if ring:
                out.append(ring)
    elif geom_type == "MultiPolygon" and coords:
        for poly in coords:
            if poly:
                for ring in poly:
                    if ring:
                        out.append(ring)
    return out


def lng_lat_to_local_meters(lng: float, lat: float) -> tuple:
    x_m = (lng - DOWNTOWN_ORIGIN_LNG) * M_PER_DEG_LNG
    z_m = (lat - DOWNTOWN_ORIGIN_LAT) * M_PER_DEG_LAT
    return (x_m, z_m)


def footprint_to_local_meters(geom_type: str, coords: Any) -> Optional[Any]:
    if not coords:
        return None
    if geom_type == "Polygon":
        return [
            [list(lng_lat_to_local_meters(p[0], p[1]) for p in ring) for ring in coords]
        ]
    if geom_type == "MultiPolygon":
        return [
            [list(lng_lat_to_local_meters(p[0], p[1]) for p in ring) for ring in poly]
            for poly in coords
        ]
    return None


def build_address(props: dict, centroid: Optional[dict]) -> str:
    addr = (props or {}).get("address") or (props or {}).get("full_address")
    if addr:
        return str(addr).strip()
    struct_id = (props or {}).get("struct_id") or ""
    if centroid:
        lat = centroid.get("lat")
        lng = centroid.get("lng")
        if lat is not None and lng is not None:
            return f"Downtown Calgary (ID: {struct_id}) — {float(lat):.5f}, {float(lng):.5f}"
    return f"Downtown Calgary (ID: {struct_id})"


def normalize_feature(feature: dict) -> dict:
    props = feature.get("properties", {}) or {}
    geom = feature.get("geometry", {}) or {}
    coords = geom.get("coordinates")
    geom_type = geom.get("type") or "Polygon"

    ring = outer_ring(geom_type, coords)
    centroid = None
    if ring:
        c = centroid_of_ring(ring)
        if c:
            centroid = {"lng": c[0], "lat": c[1]}

    rooftop = to_float(props.get("rooftop_elev_z"))
    ground_max = to_float(props.get("grd_elev_max_z"))
    ground_min = to_float(props.get("grd_elev_min_z"))
    ground = ground_max if ground_max is not None else ground_min

    height_m = None
    if rooftop is not None and ground is not None:
        height_m = rooftop - ground
        if height_m < 0:
            height_m = 0.0

    height_ft = (height_m * 3.28084) if height_m is not None else None

    footprint_local = footprint_to_local_meters(geom_type, coords)

    return {
        "id": props.get("struct_id"),
        "stage": props.get("stage"),
        "geometry_type": geom_type,
        "footprint": coords,
        "footprint_local": footprint_local,
        "centroid": centroid,
        "height_m": height_m,
        "height_ft": height_ft,
        "rooftop_elev_z": rooftop,
        "ground_elev_z": ground,
        "address": build_address(props, centroid),
        "zoning": props.get("zoning") or None,
    }


def build_where_clause(bbox: Optional[dict], geom_column: str = "polygon") -> Optional[str]:
    if not bbox:
        return None
    try:
        top = float(bbox["top"])
        bottom = float(bbox["bottom"])
        left = float(bbox["left"])
        right = float(bbox["right"])
    except (KeyError, TypeError, ValueError):
        return None
    lon_se, lat_se = right, bottom
    lon_nw, lat_nw = left, top
    return f"within_box({geom_column}, {lon_se}, {lat_se}, {lon_nw}, {lat_nw})"


def _in_bbox(centroid: Optional[dict], bbox: Optional[dict]) -> bool:
    if not centroid or not bbox:
        return True
    try:
        lat = float(centroid.get("lat"))
        lng = float(centroid.get("lng"))
        return (
            float(bbox["bottom"]) <= lat <= float(bbox["top"])
            and float(bbox["left"]) <= lng <= float(bbox["right"])
        )
    except (TypeError, ValueError, KeyError):
        return True


def _row_to_feature(row: dict) -> dict:
    polygon = row.get("polygon") or {}
    props = {k: v for k, v in row.items() if k != "polygon"}
    return {
        "type": "Feature",
        "geometry": polygon if isinstance(polygon, dict) else {},
        "properties": props,
    }


def _fetch_zoning_for_bbox(
    zoning_dataset_id: str,
    bbox: Optional[dict],
    app_token: str = "",
) -> List[Dict]:
    if not bbox:
        return []
    try:
        url = f"https://data.calgary.ca/resource/{zoning_dataset_id}.json"
        params = {"$limit": 2000}
        where = build_where_clause(bbox, "shape")
        if where:
            params["$where"] = where
        headers = {}
        if app_token:
            headers["X-App-Token"] = app_token
        r = requests.get(url, params=params, headers=headers, timeout=30)
        r.raise_for_status()
        data = r.json()
        rows = data if isinstance(data, list) else []
    except Exception as e:
        logger.warning("Zoning fetch failed: %s", e)
        return []
    out = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        geom = row.get("shape") or row.get("the_geom") or row.get("geometry")
        code = (
            (row.get("land_use_district") or row.get("district") or row.get("zone") or row.get("zoning") or row.get("code"))
            if row else None
        )
        if geom and code:
            out.append({"geom": geom, "zoning_code": str(code).strip()})
    return out


def _enrich_buildings_with_zoning(buildings: List[dict], zoning_features: List[Dict]) -> None:
    try:
        from shapely.geometry import shape, Point
    except ImportError:
        return
    for b in buildings:
        if b.get("zoning"):
            continue
        cent = b.get("centroid")
        if not cent:
            continue
        lng = cent.get("lng")
        lat = cent.get("lat")
        if lng is None or lat is None:
            continue
        pt = Point(float(lng), float(lat))
        for zf in zoning_features:
            geom = zf.get("geom")
            code = zf.get("zoning_code")
            if not geom or not code:
                continue
            try:
                if isinstance(geom, dict):
                    poly = shape(geom)
                else:
                    continue
                if poly.contains(pt):
                    b["zoning"] = code
                    break
            except Exception as _:
                continue


def fetch_buildings(
    dataset_id: str,
    limit: int,
    app_token: str = "",
    bbox: Optional[dict] = None,
    zoning_dataset_id: Optional[str] = None,
) -> dict:
    url = f"https://data.calgary.ca/resource/{dataset_id}.json"
    params = {"$limit": 5000}
    headers = {}
    if app_token:
        headers["X-App-Token"] = app_token

    r = requests.get(url, params=params, headers=headers, timeout=60)
    r.raise_for_status()
    data = r.json()

    rows = data if isinstance(data, list) else data.get("features", [])
    buildings = []
    for row in rows:
        if isinstance(row, dict) and "polygon" in row:
            feature = _row_to_feature(row)
        elif isinstance(row, dict) and row.get("geometry"):
            feature = row
        else:
            continue
        b = normalize_feature(feature)
        if bbox and not _in_bbox(b.get("centroid"), bbox):
            continue
        buildings.append(b)
        if len(buildings) >= limit:
            break

    if zoning_dataset_id and bbox:
        zoning_features = _fetch_zoning_for_bbox(zoning_dataset_id, bbox, app_token)
        if zoning_features:
            _enrich_buildings_with_zoning(buildings, zoning_features)

    return {
        "count": len(buildings),
        "fetched_at_unix": int(time.time()),
        "origin": {"lat": DOWNTOWN_ORIGIN_LAT, "lng": DOWNTOWN_ORIGIN_LNG},
        "buildings": buildings,
    }


def fetch_building_by_id(
    dataset_id: str, struct_id: str, app_token: str = ""
) -> Optional[dict]:
    url = f"https://data.calgary.ca/resource/{dataset_id}.json"
    params = {}
    headers = {}
    if app_token:
        headers["X-App-Token"] = app_token

    r = requests.get(url, params=params, headers=headers, timeout=60)
    r.raise_for_status()
    data = r.json()

    rows = data if isinstance(data, list) else []
    for row in rows:
        if not isinstance(row, dict) or str(row.get("struct_id", "")) != str(struct_id):
            continue
        feature = _row_to_feature(row)
        return normalize_feature(feature)
    return None
