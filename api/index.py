"""
Vercel Serverless Function Entry Point for Flask MOHO Storefront
"""

import os
import sys

# Add project root directory to sys.path so app and its dependencies can be resolved
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app import app

class VercelPathFixMiddleware:
    """
    WSGI Middleware to normalize PATH_INFO when Vercel rewrites requests to /api/index
    """
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        path = environ.get('PATH_INFO', '')
        if path.startswith('/api/index.py'):
            environ['PATH_INFO'] = path[len('/api/index.py'):] or '/'
        elif path.startswith('/api/index'):
            environ['PATH_INFO'] = path[len('/api/index'):] or '/'
        return self.wsgi_app(environ, start_response)

app.wsgi_app = VercelPathFixMiddleware(app.wsgi_app)
handler = app
