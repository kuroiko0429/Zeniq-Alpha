# rate_limit.py
# IPアドレス単位のレート制限（slowapi）。
# main.py と routers/auth.py の両方から参照するため、
# main.py 側での循環importを避けてここに切り出している。
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
