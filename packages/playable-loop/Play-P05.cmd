@echo off
python -B "%~dp0play.py" reader
if errorlevel 1 pause
