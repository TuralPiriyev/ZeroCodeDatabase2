import os
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

HF_URL = os.environ.get('HF_API_BASE', 'http://localhost:8088/models/owner/model')
HF_TOKEN = os.environ.get('HF_TOKEN')

def create_session():
    s = requests.Session()
    retries = Retry(total=4, backoff_factor=0.5, status_forcelist=[429, 503], raise_on_status=False)
    s.mount('http://', HTTPAdapter(max_retries=retries))
    s.mount('https://', HTTPAdapter(max_retries=retries))
    if HF_TOKEN:
        s.headers.update({'Authorization': f'Bearer {HF_TOKEN}'})
    s.headers.update({'Content-Type': 'application/json'})
    return s

def post(inputs):
    s = create_session()
    r = s.post(HF_URL, json={'inputs': inputs}, timeout=(5,30))
    return r.status_code, r.headers, r.text

if __name__ == '__main__':
    print(post('hello'))
