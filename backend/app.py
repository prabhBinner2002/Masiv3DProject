import logging
import os
from flask import Flask
from flask_cors import CORS
from config import Config
from extensions import db
from routes.api import api_bp

logger = logging.getLogger(__name__)


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    uri = app.config.get("SQLALCHEMY_DATABASE_URI") or ""
    if "sqlite" in uri and "instance" in uri:
        instance_dir = app.instance_path
        os.makedirs(instance_dir, exist_ok=True)
        db_path = os.path.join(instance_dir, "masiv.db")
        app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + db_path.replace("\\", "/")

    CORS(app)
    db.init_app(app)

    with app.app_context():
        try:
            db.create_all()
        except Exception as e:
            logger.exception("db.create_all failed: %s", e)
            raise

    app.register_blueprint(api_bp)
    return app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
