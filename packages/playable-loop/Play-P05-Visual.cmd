@echo off
python -B "%~dp0play.py" visual-reader
if errorlevel 1 pause
