"""
Vercel Serverless Function Entry Point for Flask MOHO Storefront
"""

import os
import sys
import traceback

# Add project root directory to sys.path so app and its dependencies can be resolved
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

try:
    from app import app
except Exception:
    import_error = traceback.format_exc()

    def app(environ, start_response):
        start_response('500 Internal Server Error', [('Content-Type', 'text/plain; charset=utf-8')])
        return [f"=== MOCNHA IMPORT ERROR ===\n{import_error}".encode('utf-8')]
