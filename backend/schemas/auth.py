from pydantic import BaseModel

# ログインリクエスト
class LoginRequest(BaseModel):
    username: str
    password: str

# ログイン成功時のレスポンス
class TokenResponse(BaseModel):
    access_token: str
    store_name:   str

class RegisterRequest(BaseModel):
    name:     str  # 店舗名
    username: str  # ログインID
    password: str  # パスワード

class RegisterResponse(BaseModel):
    id:       int
    name:     str
    username: str