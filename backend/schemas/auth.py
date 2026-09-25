from pydantic import BaseModel, Field

# ログインリクエスト
class LoginRequest(BaseModel):
    username: str
    password: str

# ログイン成功時のレスポンス
class TokenResponse(BaseModel):
    access_token: str
    store_name:   str
    is_admin:     bool

class RegisterRequest(BaseModel):
    name:     str  # 店舗名
    username: str  # ログインID
    password: str = Field(min_length=8)  # パスワード（8文字以上）

class RegisterResponse(BaseModel):
    id:       int
    name:     str
    username: str