// auth.js
// ログイン状態（JWTトークン・店舗名）の保存/取得/破棄と、
// 未ログイン時のリダイレクトをまとめて扱う共通モジュール。
// index.html / items.html / orders.html / sales.html / login.html から利用する。

const TOKEN_KEY = 'pos_access_token';
const STORE_NAME_KEY = 'pos_store_name';

// ログイン成功時にトークンと店舗名を保存する
export function setSession(accessToken, storeName) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(STORE_NAME_KEY, storeName);
}

// 保存されているトークンを取得する（未ログインなら null）
export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

// 保存されている店舗名を取得する（未ログインなら null）
export function getStoreName() {
    return localStorage.getItem(STORE_NAME_KEY);
}

// ログイン中かどうか
export function isLoggedIn() {
    return !!getToken();
}

// セッション情報の破棄のみ行う（画面遷移はしない）
export function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(STORE_NAME_KEY);
}

// ログアウトしてログイン画面へ戻す
export function logout() {
    clearSession();
    location.href = 'login.html';
}

// 確認ダイアログ付きのログアウト（共通ヘッダーのログアウトボタンから使用）
export function logoutWithConfirm() {
    if (confirm('ログアウトしますか？')) {
        logout();
    }
}

// 未ログインならログイン画面へ強制的に飛ばす。
// 各画面（index.html / items.html / orders.html / sales.html）の
// 共通ヘッダー（header.js）から呼び出して使う。
export function requireAuth() {
    if (!isLoggedIn()) {
        location.href = 'login.html';
    }
}

// Authorization ヘッダー付きの fetch オプションを組み立てるヘルパー。
// api.js から共通で使う。
export function authHeaders(extra = {}) {
    return {
        ...extra,
        Authorization: `Bearer ${getToken()}`
    };
}
