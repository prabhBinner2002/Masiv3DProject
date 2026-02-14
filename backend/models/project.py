from datetime import datetime
from extensions import db


class Project(db.Model):
    """Saved map analysis: project name + LLM-generated filters."""
    __tablename__ = "projects"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    name = db.Column(db.String(256), nullable=False)
    filters = db.Column(db.Text, nullable=False)  # JSON array of { attribute, operator, value }
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        import json
        try:
            filters_list = json.loads(self.filters) if self.filters else []
        except (TypeError, ValueError):
            filters_list = []
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "filters": filters_list,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
