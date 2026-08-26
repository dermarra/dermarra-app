from flask import jsonify
from werkzeug.exceptions import HTTPException


def register_error_handlers(app):
    @app.errorhandler(HTTPException)
    def handle_http_exception(e):
        return jsonify({"error": e.description, "code": e.code}), e.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(e):
        app.logger.exception(e)
        return jsonify({"error": "internal server error"}), 500
