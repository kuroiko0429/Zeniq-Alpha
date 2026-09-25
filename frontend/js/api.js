import { authHeaders, setSession, logout } from './auth.js';

// config.js（window.__ENV__）で上書きできる。未設定時はローカル開発用のデフォルト。
const API_BASE = (typeof window !== 'undefined' && window.__ENV__?.API_BASE) || 'http://localhost:8000';

// 401（未認証・トークン切れ）が返ってきたら共通でログイン画面に戻す
async function handleAuthError(res) {
    if (res.status === 401) {
        logout();
        throw new Error('認証の有効期限が切れました。再度ログインしてください。');
    }
}

// ログイン
// バックエンドは OAuth2PasswordRequestForm（application/x-www-form-urlencoded）を
// 要求するため、JSONではなく URLSearchParams で送信する。
export async function login(username, password) {
    const body = new URLSearchParams();
    body.append('username', username);
    body.append('password', password);

    const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    });

    if (!res.ok) {
        // 現状のバックエンドはユーザー名/パスワード不一致時に
        // 500が返ることがあるため、ステータスに関わらず
        // 「ログインに失敗しました」として扱う。
        throw new Error('ユーザー名またはパスワードが正しくありません');
    }

    const data = await res.json();
    setSession(data.access_token, data.store_name, data.is_admin);
    return data;
}

// 店舗の新規登録
// 注意: バックエンドの /api/auth/register は「運営本部」でログイン済みの
// トークンでのみ実行できる（誰でも自由に新規登録できる仕様ではない）。
// 未ログイン状態で呼ぶと 401 が返る。
export async function register(name, username, password) {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name, username, password })
    });

    if (res.status === 401) {
        throw new Error('新規登録には運営本部アカウントでのログインが必要です。運営本部に登録を依頼してください。');
    }
    if (res.status === 403) {
        throw new Error('新規登録は運営本部のみが行えます。');
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // pydanticのバリデーションエラー（422）は detail が配列になるため、
        // 文字列（HTTPExceptionからのdetail）と配列の両方に対応する。
        const detail = Array.isArray(err.detail)
            ? err.detail.map((e) => e.msg).join(' / ')
            : err.detail;
        throw new Error(detail || '新規登録に失敗しました');
    }
    return res.json();
}

export async function getProducts() {
    const res = await fetch(`${API_BASE}/api/products`, {
        headers: authHeaders()
    });
    await handleAuthError(res);
    if (!res.ok) throw new Error('商品の取得に失敗しました');
    return res.json();
}

export async function getProduct(storeProductNo) {
    const res = await fetch(`${API_BASE}/api/products/${storeProductNo}`, {
        headers: authHeaders()
    });
    await handleAuthError(res);
    if (!res.ok) throw new Error('商品の取得に失敗しました');
    return res.json();
}

export async function createProduct(data) {
    const res = await fetch(`${API_BASE}/api/products`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data)
    });
    await handleAuthError(res);
    if (!res.ok) throw new Error('商品の登録に失敗しました');
    return res.json();
}

export async function updateProduct(storeProductNo, data) {
    const res = await fetch(`${API_BASE}/api/products/${storeProductNo}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data)
    });
    await handleAuthError(res);
    if (!res.ok) throw new Error('商品の更新に失敗しました');
    return res.json();
}

export async function deleteProduct(storeProductNo) {
    const res = await fetch(`${API_BASE}/api/products/${storeProductNo}`, {
        method: 'DELETE',
        headers: authHeaders()
    });
    await handleAuthError(res);
    if (!res.ok) throw new Error('商品の削除に失敗しました');
    return res.json();
}

// 注文作成
// バックエンドは tendered ではなく total + payment_method（配列）を要求する。
// 例: createOrder(items, total, [{ cash: 1000, ticket_100: 0, ticket_200: 0, emoney: 0 }])
export async function createOrder(items, total, paymentMethod) {
    const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            items: items.map(item => ({
                store_product_no: item.store_product_no,
                quantity: item.quantity
            })),
            total,
            payment_method: paymentMethod
        })
    });
    await handleAuthError(res);
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || '注文に失敗しました');
    }
    return res.json();
}

export async function getOrders() {
    const res = await fetch(`${API_BASE}/api/orders`, {
        headers: authHeaders()
    });
    await handleAuthError(res);
    if (!res.ok) throw new Error('注文履歴の取得に失敗しました');
    return res.json();
}

// 注文更新（会計履歴の編集）
// リクエスト形式は createOrder と同じ（items / total / payment_method）
export async function updateOrder(orderId, data) {
    const res = await fetch(`${API_BASE}/api/orders/${orderId}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data)
    });
    await handleAuthError(res);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || '注文の更新に失敗しました');
    }
    return res.json();
}

// 注文削除
// 注意: このエンドポイントは仕様書に明記されていないため、
// REST の慣例（DELETE /api/orders/{id}）に沿って実装しています。
// バックエンド側に対応するエンドポイントがあるか、実装時に必ず確認してください。
export async function deleteOrder(orderId) {
    const res = await fetch(`${API_BASE}/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: authHeaders()
    });
    await handleAuthError(res);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || '注文の削除に失敗しました');
    }
    return res.json();
}

// 売上集計
// date に 'YYYY-MM-DD' を渡すとその日のみ、省略すると全期間が対象。
// sales_by_day（日別推移）は date 指定の有無に関わらず店舗全体分が返る。
export async function getSalesSummary(date) {
    const url = date
        ? `${API_BASE}/api/sales/summary?date=${encodeURIComponent(date)}`
        : `${API_BASE}/api/sales/summary`;

    const res = await fetch(url, {
        headers: authHeaders()
    });
    await handleAuthError(res);
    if (!res.ok) throw new Error('売上集計の取得に失敗しました');
    return res.json();
}
