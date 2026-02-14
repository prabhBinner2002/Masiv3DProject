from datetime import datetime
from extensions import db


class User(db.Model):
    """Simple user identification (username only; no auth)."""
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(128), unique=True, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    projects = db.relationship("Project", backref="user", lazy="dynamic", cascade="all, delete-orphan")

    def to_dict(self):
        return {"id": self.id, "username": self.username, "created_at": self.created_at.isoformat() if self.created_at else None}
