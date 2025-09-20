import os
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

MYSTER_URL = os.environ.get('MYSTER_API_BASE_URL', 'https://api.myster.example/v1/generate')
MYSTER_KEY = os.environ.get('MYSTER_API_KEY')

def create_session():
    s = requests.Session()
    retries = Retry(total=4, backoff_factor=0.5, status_forcelist=[429, 502, 503], raise_on_status=False)
    s.mount('http://', HTTPAdapter(max_retries=retries))
    s.mount('https://', HTTPAdapter(max_retries=retries))
    if MYSTER_KEY:
        s.headers.update({'Authorization': f'Bearer {MYSTER_KEY}'})
    s.headers.update({'Content-Type': 'application/json'})
    return s

def post(messages=None, inputs=None):
    s = create_session()
    payload = {}
    if messages:
        payload['type'] = 'chat'
        payload['messages'] = messages
    else:
        payload['type'] = 'text'
        payload['input'] = inputs
    r = s.post(MYSTER_URL, json=payload, timeout=(5,30))
    return r.status_code, r.headers, r.text

if __name__ == '__main__':
    print(post(inputs='hello'))
