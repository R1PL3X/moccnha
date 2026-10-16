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

# Vercel looks for 'app' or 'application' or 'handler'
handler = app
