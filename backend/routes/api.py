import json
import logging
from flask import Blueprint, current_app, jsonify, request
from extensions import db
from models import User, Project
from services.cityData import fetch_buildings, fetch_building_by_id
from services.filters import apply_filters
from services.llm import query_llm_for_filter

logger = logging.getLogger(__name__)
api_bp = Blueprint("api", __name__, url_prefix="/api")


def get_downtown_bbox(cfg):
    return {
        "top": cfg.get("DOWNTOWN_TOP"),
        "bottom": cfg.get("DOWNTOWN_BOTTOM"),
        "left": cfg.get("DOWNTOWN_LEFT"),
        "right": cfg.get("DOWNTOWN_RIGHT"),
    }


@api_bp.get("/health")
def health():
    return jsonify({"status": "ok"})


@api_bp.get("/buildings")
def buildings():
    cfg = current_app.config
    try:
        payload = fetch_buildings(
            dataset_id=cfg["HEIGHT_DATA"],
            limit=cfg["DATASET_LIMIT"],
            app_token=cfg.get("DATASET_TOKEN", ""),
            bbox=get_downtown_bbox(cfg),
            zoning_dataset_id=cfg.get("ZONING_DATASET"),
        )
        return jsonify(payload)
    except Exception as e:
        logger.exception("fetch_buildings failed")
        return jsonify({"error": str(e), "buildings": [], "count": 0}), 503


@api_bp.get("/buildings/<string:building_id>")
def building_details(building_id):
    cfg = current_app.config
    try:
        b = fetch_building_by_id(
            dataset_id=cfg["HEIGHT_DATA"],
            struct_id=building_id,
            app_token=cfg.get("DATASET_TOKEN", ""),
        )
    except Exception as e:
        logger.exception("fetch_building_by_id failed")
        return jsonify({"error": str(e)}), 503
    if b is None:
        return jsonify({"error": "Building not found"}), 404
    return jsonify(b)


@api_bp.post("/filter")
def filter_buildings():
    cfg = current_app.config
    body = request.get_json(silent=True) or {}
    limit = int(body.get("limit", cfg["DATASET_LIMIT"]))
    filters = body.get("filters") if isinstance(body.get("filters"), list) else []

    try:
        payload = fetch_buildings(
            dataset_id=cfg["HEIGHT_DATA"],
            limit=limit,
            app_token=cfg.get("DATASET_TOKEN", ""),
            bbox=get_downtown_bbox(cfg),
            zoning_dataset_id=cfg.get("ZONING_DATASET"),
        )
    except Exception as e:
        logger.exception("fetch_buildings failed in filter")
        return jsonify({"error": str(e), "buildings": [], "count": 0, "filters": filters}), 503

    filtered = apply_filters(payload["buildings"], filters)
    return jsonify({"count": len(filtered), "filters": filters, "buildings": filtered})


@api_bp.post("/query")
def llm_query():
    cfg = current_app.config
    body = request.get_json(silent=True) or {}
    user_query = (body.get("query") or "").strip()
    if not user_query:
        return jsonify({"error": "Missing 'query' in body", "filters": [], "buildings": []}), 400

    api_token = cfg.get("HF_API_TOKEN") or cfg.get("HUGGINGFACE_API_TOKEN")
    model = cfg.get("HUGGINGFACE_MODEL", "mistralai/Mistral-7B-Instruct-v0.3")
    if not api_token:
        return jsonify({"error": "Hugging Face API token not configured", "filters": [], "buildings": []}), 503

    filter_obj = query_llm_for_filter(user_query, api_token, model)
    filters = [filter_obj] if filter_obj else []

    try:
        payload = fetch_buildings(
            dataset_id=cfg["HEIGHT_DATA"],
            limit=cfg["DATASET_LIMIT"],
            app_token=cfg.get("DATASET_TOKEN", ""),
            bbox=get_downtown_bbox(cfg),
            zoning_dataset_id=cfg.get("ZONING_DATASET"),
        )
    except Exception as e:
        logger.exception("fetch_buildings failed in query")
        return jsonify({"error": str(e), "query": user_query, "filters": filters, "buildings": [], "count": 0}), 503

    buildings_list = payload["buildings"]
    if filters:
        buildings_list = apply_filters(buildings_list, filters)
    return jsonify({"query": user_query, "filters": filters, "count": len(buildings_list), "buildings": buildings_list})


@api_bp.post("/users/identify")
def identify_user():
    body = request.get_json(silent=True) or {}
    username = (body.get("username") or "").strip()
    if not username:
        return jsonify({"error": "Username is required"}), 400
    try:
        user = User.query.filter_by(username=username).first()
        if user is None:
            user = User(username=username)
            db.session.add(user)
            db.session.commit()
        return jsonify(user.to_dict())
    except Exception as e:
        db.session.rollback()
        logger.exception("identify_user failed")
        return jsonify({"error": str(e)}), 500


@api_bp.get("/users/<int:user_id>/projects")
def list_projects(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    projects = Project.query.filter_by(user_id=user_id).order_by(Project.created_at.desc()).all()
    return jsonify({"projects": [p.to_dict() for p in projects]})


@api_bp.post("/users/<int:user_id>/projects")
def save_project(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    filters = body.get("filters")
    if not name:
        return jsonify({"error": "Project name is required"}), 400
    if filters is not None and not isinstance(filters, list):
        return jsonify({"error": "filters must be an array"}), 400
    filters_list = filters if isinstance(filters, list) else []
    try:
        project = Project(user_id=user_id, name=name, filters=json.dumps(filters_list))
        db.session.add(project)
        db.session.commit()
        return jsonify(project.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        logger.exception("save_project failed")
        return jsonify({"error": str(e)}), 500


@api_bp.get("/projects/<int:project_id>")
def load_project(project_id):
    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
    return jsonify(project.to_dict())
