"""
Vercel Serverless Function Entry Point for Flask MOHO Storefront
"""

import os
import sys
import traceback
from urllib.parse import parse_qs, urlencode

# Add project root directory to sys.path so app and its dependencies can be resolved
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

app_import_error = None
try:
    from app import app
except Exception:
    app = None
    app_import_error = traceback.format_exc()

class VercelPathFixMiddleware:
    """
    WSGI Middleware to accurately restore the original request path from:
    1. The __path query parameter forwarded by vercel.json rewrite
    2. Vercel's HTTP_X_MATCHED_PATH header
    3. Normal PATH_INFO fallback
    """
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        if app_import_error:
            start_response('500 Internal Server Error', [('Content-Type', 'text/plain; charset=utf-8')])
            return [f"Flask App Import Error:\n{app_import_error}".encode('utf-8')]

        try:
            query_string = environ.get('QUERY_STRING', '')
            custom_path = None

            if '__path' in query_string:
                try:
                    qs = parse_qs(query_string, keep_blank_values=True)
                    val = qs.pop('__path', [None])[0]
                    if val:
                        custom_path = '/' + val.lstrip('/')
                        new_qs = []
                        for k, vals in qs.items():
                            for v in vals:
                                new_qs.append((k, v))
                        environ['QUERY_STRING'] = urlencode(new_qs)
                except Exception:
                    pass

            if not custom_path:
                matched = environ.get('HTTP_X_MATCHED_PATH') or environ.get('HTTP_X_VERCEL_MATCHED_PATH')
                if matched and not matched.startswith('/api/index'):
                    custom_path = matched.split('?')[0]

            if custom_path:
                environ['PATH_INFO'] = custom_path
            else:
                path = environ.get('PATH_INFO', '')
                if path in ('/api/index', '/api/index.py'):
                    environ['PATH_INFO'] = '/'

            return self.wsgi_app(environ, start_response)
        except Exception:
            err_tb = traceback.format_exc()
            start_response('500 Internal Server Error', [('Content-Type', 'text/plain; charset=utf-8')])
            return [f"Serverless Execution Error:\n{err_tb}".encode('utf-8')]

if app is not None:
    app.wsgi_app = VercelPathFixMiddleware(app.wsgi_app)
    handler = app
else:
    def handler(environ, start_response):
        start_response('500 Internal Server Error', [('Content-Type', 'text/plain; charset=utf-8')])
        return [f"Flask App Import Error:\n{app_import_error}".encode('utf-8')]
