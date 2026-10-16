@echo off
title MOHO Furniture Store Server
echo ========================================================
echo   DANG KHOI DONG HE THONG MO HO STOREFRONT & BACKEND
echo ========================================================
echo.
python database.py
echo Khoi dong may chu tai http://localhost:5000 ...
python app.py
pause
