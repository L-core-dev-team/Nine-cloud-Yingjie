@echo off
python -B "%~dp0play.py" visual-demo
if errorlevel 1 pause
