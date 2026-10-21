#!/bin/bash
set -e

cd "$(dirname "$0")/../chatbot"
pip install -q -r requirements.txt
