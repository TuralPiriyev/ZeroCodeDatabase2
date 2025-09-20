import os
import subprocess
import time
import requests
from server.python.hf_client import post

def test_python_client_ok():
    os.environ['HF_API_BASE'] = 'http://localhost:8088/models/owner/model?mode=ok'
    status, headers, text = post('x')
    assert status == 200

def test_python_client_503():
    os.environ['HF_API_BASE'] = 'http://localhost:8088/models/owner/model?mode=503'
    status, headers, text = post('x')
    assert status == 503
