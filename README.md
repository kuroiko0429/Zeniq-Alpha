# 学園祭POSレジシステム ぜにきゅーあるふぁ

学園祭の模擬店向けに作られた、店舗ごとにログインして商品登録・会計・売上集計を行うPOS（販売時点管理）システムです。バックエンド（FastAPI）とフロントエンド（HTML/CSS/JavaScript）で構成されています。

## 目次

- [概要](#概要)
- [技術スタック](#技術スタック)
- [ディレクトリ構成](#ディレクトリ構成)
- [画面一覧（フロントエンド）](#画面一覧フロントエンド)
- [バックエンドAPI](#バックエンドapi)
  - [認証フロー](#認証フロー)
  - [支払い額・お釣りの計算ロジック](#支払い額お釣りの計算ロジック)
  - [データベース設計](#データベース設計)
  - [APIエンドポイント一覧](#apiエンドポイント一覧)
  - [API詳細](#api詳細)
- [セットアップ・起動方法](#セットアップ起動方法)
- [環境変数](#環境変数)
- [テスト](#テスト)
- [初期データ](#初期データ)
- [既知の課題・TODO](#既知の課題todo)
- [Podman動作確認・起動速度メモ](./PODMAN_NOTES.md)（別ファイル）

## 概要

学園祭の各模擬店（焼きそば班、から揚げ班……）が個別のアカウントでログインし、以下のことを行えるようにするアプリケーションです。

- 自店舗の商品（メニュー）の登録・編集・削除
- レジでの会計（カートに商品を入れて、現金・模擬券・QR決済を組み合わせて支払う）
- 自店舗の会計履歴の確認
- 自店舗の売上集計（総売上・会計件数・商品別売上・決済手段別内訳・日別推移）
- 運営本部アカウントによる新規店舗の登録

店舗データは互いに分離されており、各店舗は自分の商品・注文しか閲覧・操作できません。

## 技術スタック

### バックエンド

| 項目 | 内容 |
|---|---|
| フレームワーク | FastAPI 0.111.0 |
| ORM | SQLAlchemy 2.0.30 |
| DB | PostgreSQL 16（`psycopg2-binary`） |
| マイグレーション | Alembic 1.13.1 |
| 認証 | JWT（`python-jose`） + bcrypt（`passlib`） |
| サーバー | Uvicorn |

### フロントエンド

| 項目 | 内容 |
|---|---|
| 構成 | 素のHTML / CSS / JavaScript（ビルド不要、フレームワーク未使用） |
| モジュール | ES Modules（`<script type="module">`、全画面共通） |
| 通信 | `fetch` API（`js/api.js` に集約） |
| セッション管理 | `localStorage`（JWTアクセストークン・店舗名・管理者フラグを保存） |
| デザイン | **Material 3 Expressive**（`css/m3-tokens.css`＋`css/m3-components.css`）。色ロール・シェイプ・タイポスケール・elevation・モーションをトークン化し、全画面に適用。クリックリップルは`js/ripple.js`（バニラJS、イベント委譲） |
| 配信 | Docker Compose上のnginx（静的配信） |

### インフラ

Docker Compose により `postgres` / `backend` / `frontend(nginx)` の3サービスで構成されています。

## ディレクトリ構成

```
Zeniq-Alpha/
├── docker-compose.yml          # Docker用
├── docker-compose.podman.yml   # rootless Podman用（詳細はPODMAN_NOTES.md）
├── .dockerignore
├── .github/workflows/
│   ├── ci.yml                  # backend pytest / frontend bun test / docker build
│   └── dependency-audit.yml    # pip-auditの週次実行
├── alembic.ini
├── alembic/
│   ├── env.py
│   └── versions/
│       ├── 001_initial.py                      # stores, products, orders, order_items 等の初期スキーマ
│       ├── 002_remove_subtotal.py              # order_items.subtotal カラムの削除
│       ├── 003_add_payment_methods.py          # payment_methods テーブルの追加
│       ├── 004_add_is_admin_to_stores.py       # stores.is_admin カラムの追加
│       ├── 005_add_unique_store_product_no.py  # (store_id, store_product_no) の一意制約
│       ├── 006_add_order_item_unit_price.py    # order_items.unit_price（購入時単価）の追加
│       └── 007_products_stock_not_null.py      # products.stock を NOT NULL に変更
├── backend/
│   ├── main.py                # FastAPIアプリのエントリーポイント（CORS・例外ハンドラ・レート制限の設定含む）
│   ├── database.py            # DB接続・セッション設定
│   ├── rate_limit.py          # slowapiのLimiter（ログインのレート制限）
│   ├── init_stores.py         # 初期店舗データ投入スクリプト
│   ├── init_data.py           # 初期商品データ投入スクリプト
│   ├── entrypoint.sh          # コンテナ起動スクリプト（alembic upgrade → uvicorn起動）
│   ├── requirements.txt
│   ├── requirements-dev.txt   # pytest等、テスト実行時のみ必要な依存
│   ├── pytest.ini
│   ├── tests/                 # pytest（SQLiteインメモリDBで実行、DockerもPostgreSQLも不要）
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_products.py
│   │   ├── test_orders.py
│   │   └── test_sales.py
│   ├── auth/
│   │   └── dependencies.py    # JWT検証・認証依存関数（get_current_store）
│   ├── models/                # SQLAlchemyモデル（DBスキーマ）
│   │   ├── store.py
│   │   ├── product.py
│   │   └── order.py           # Order / OrderItem / OrderPaymentMethod
│   ├── schemas/                # Pydanticスキーマ（リクエスト/レスポンス）
│   │   ├── auth.py
│   │   ├── product.py         # ProductCreate / ProductResponse
│   │   └── order.py
│   ├── services/                # ビジネスロジック
│   │   ├── auth_service.py
│   │   ├── product_service.py
│   │   └── order_service.py
│   └── routers/                  # APIエンドポイント定義
│       ├── auth.py
│       ├── products.py
│       ├── orders.py
│       └── sales.py
└── frontend/
    ├── package.json         # `bun test` 実行用
    ├── login.html           # ログイン／店舗新規登録
    ├── index.html           # POSレジ（会計）画面
    ├── items.html           # 商品管理画面
    ├── orders.html          # 会計履歴画面
    ├── sales.html           # 売上分析画面
    ├── admin.html           # 管理画面（店舗登録、管理者のみ）
    ├── css/
    │   ├── m3-tokens.css      # Material 3 Expressive デザイントークン（色・シェイプ・タイポ・elevation・motion）
    │   ├── m3-components.css # 全画面共通のリップル・フォーカスリング等のインタラクション層
    │   └── ...                # login.css / style.css / items.css / orders.css / sales.css / admin.css / header.css（画面固有スタイル）
    ├── img/                 # アイコン画像
    └── js/
        ├── config.js        # window.__ENV__.API_BASE（バックエンドURL設定）
        ├── ripple.js        # M3クリックリップル（イベント委譲、動的要素にも自動対応）
        ├── api.js           # バックエンドAPI呼び出しの共通モジュール
        ├── auth.js          # トークン・管理者フラグの保存/取得、認証ガード
        ├── header.js        # 共通ヘッダー（ナビゲーション）の描画・認証ガード
        ├── login.js         # ログイン画面のロジック
        ├── pos.js           # POSレジ画面のDOM制御
        ├── pos-calc.js      # POSレジの金額計算ロジック（DOM非依存、単体テスト対象）
        ├── pos-calc.test.js # pos-calc.js の単体テスト（`bun test`）
        ├── items.js         # 商品管理画面のロジック
        ├── orders.js        # 会計履歴画面のロジック
        ├── sales.js         # 売上分析画面のロジック
        └── admin.js         # 管理画面（店舗登録）のロジック
```

## 画面一覧（フロントエンド）

| 画面 | ファイル | 現状 |
|---|---|---|
| ログイン／新規登録 | `login.html` | ✅ 連携済み。`POST /api/auth/login` を実際に呼び出し、成功するとトークンを保存して各画面へ遷移する |
| 共通ヘッダー | `header.js` | ✅ 全画面で `<script type="module">` 読み込み・未ログイン時のリダイレクト（`requireAuth`）・店舗名表示・ログアウトボタンのクリックイベントとも連携済み。管理者（`is_admin`）ログイン時のみ「管理画面」リンクを表示 |
| POSレジ | `index.html` | ✅ 連携済み。商品一覧はAPIから取得し、会計実行で`POST /api/orders`を呼び出す。会計金額・お釣り・模擬券不足判定のロジックは`js/pos-calc.js`に切り出し、単体テスト済み |
| 商品管理 | `items.html` | ✅ 連携済み。商品の追加・編集・削除がすべて`api.js`経由でバックエンドに反映される |
| 会計履歴 | `orders.html` | ✅ 連携済み。`header.js`は`type="module"`で読み込まれ、検索フィルター・編集・削除とも`api.js`と連携している |
| 売上分析 | `sales.html` | ✅ 連携済み。日別／全期間タブとも`GET /api/sales/summary`から取得したデータを表示する |
| 管理画面 | `admin.html` | ✅ 実装済み。管理者（運営本部）アカウントのみアクセスでき、`POST /api/auth/register`を呼び出して新規店舗を登録できる。非管理者がURLを直接叩いても`index.html`へリダイレクトされる |

> フロントエンドが参照するバックエンドのURLは `frontend/js/config.js`（`window.__ENV__.API_BASE`）で設定する。別ホスト/別ポートで動かす場合はこのファイルだけを書き換えればよい。

## バックエンドAPI

### 認証フロー

1. `POST /api/auth/login` にユーザー名・パスワードを送信（`OAuth2PasswordRequestForm` = `application/x-www-form-urlencoded`）
2. サーバーがbcryptでパスワードを検証し、JWT（有効期限8時間）を発行
3. 認証に失敗した場合（ユーザー名が存在しない／パスワード不一致）は `401 ユーザー名またはパスワードが正しくありません` を返す
4. 以降のリクエストで `Authorization: Bearer <token>` を付与
5. `auth/dependencies.py` の `get_current_store` がトークンを検証し、ペイロード（`store_id` / `store_name` / `exp`）をそのままエンドポイントに渡す
6. 店舗登録（`POST /api/auth/register`）は `store_name == "運営本部"` のトークンでのみ実行可能（403で拒否）

すべての保護されたエンドポイントは `Authorization: Bearer <token>` ヘッダーが必須です。各店舗は自店舗のデータのみ参照・操作できます（`store_id` でフィルタ）。

### 支払い額・お釣りの計算ロジック

`POST /api/orders`（および `PUT /api/orders/{order_id}`）にリクエストする際、クライアントは支払額を直接送りません。代わりに `payment_method` のリストから、サーバー側（`services/order_service.py`）で以下の計算式により支払額を算出します。

```
tendered = Σ( cash + ticket_100 × 100 + ticket_200 × 200 + emoney )
change   = tendered - total
```

- `tendered` が `total` 未満の場合 → `400 支払額は合計金額以上である必要があります`
- 商品の `price × quantity` の合計とリクエストの `total` が一致しない場合 → `400 合計金額が正しくありません`
- 在庫不足の場合 → `400 ◯◯ の在庫が不足しています（残りN個）`
- 対象商品が店舗内に存在しない場合 → `404 商品番号 N が見つかりません`

`PUT /api/orders/{order_id}` による更新時も、在庫の増減・`total`/`tendered`/`change`の再計算に加えて、新しい注文明細（`items`）と支払い方法（`payment_method`）が正しくレスポンスに反映されます。

### データベース設計

Alembicマイグレーションが整備済みで、`entrypoint.sh` の `alembic upgrade head` によってスキーマが作成されます（`001_initial` → `002_remove_subtotal` → `003_add_payment_methods`）。

| テーブル | 内容 |
|---|---|
| `stores` | 店舗（id, name, username, hashed_password） |
| `products` | 商品（id：アプリ全体ID, store_product_no：店舗内番号, name, price, stock, store_id） |
| `orders` | 注文（id, store_id, created_at, total, tendered, change） |
| `order_items` | 注文商品（order_id, product_id, quantity） |
| `payment_methods` | 支払い方法（order_id, cash, ticket_100, ticket_200, emoney）※1注文に複数組み合わせ可 |

ER概要:

```
stores 1───* products
stores 1───* orders
orders 1───* order_items ──* products
orders 1───* payment_methods
```

### APIエンドポイント一覧

すべて `Authorization: Bearer <token>` が必要（◯）／不要（-）です。

#### 認証 `/api/auth`

| メソッド | パス | 説明 | 認証 |
|---|---|---|---|
| POST | `/api/auth/login` | ログイン（OAuth2パスワードフロー、フォーム形式） | - |
| POST | `/api/auth/register` | 店舗登録（運営本部のみ実行可） | ◯ |

#### 商品 `/api/products`

| メソッド | パス | 説明 | 認証 |
|---|---|---|---|
| GET | `/api/products` | 自店舗の商品一覧取得 | ◯ |
| GET | `/api/products/{store_product_no}` | 商品詳細取得（店舗内番号指定） | ◯ |
| POST | `/api/products` | 商品登録（`store_product_no` は自動採番） | ◯ |
| PUT | `/api/products/{store_product_no}` | 商品更新（全項目上書き） | ◯ |
| DELETE | `/api/products/{store_product_no}` | 商品削除 | ◯ |

#### 注文 `/api/orders`

| メソッド | パス | 説明 | 認証 |
|---|---|---|---|
| POST | `/api/orders` | 注文作成（在庫減算・支払額計算） | ◯ |
| GET | `/api/orders` | 自店舗の注文一覧取得（新しい順） | ◯ |
| PUT | `/api/orders/{order_id}` | 注文更新（在庫調整あり） | ◯ |
| DELETE | `/api/orders/{order_id}` | 注文削除 | ◯ |

#### 売上 `/api/sales`

| メソッド | パス | 説明 | 認証 |
|---|---|---|---|
| GET | `/api/sales/summary` | 売上集計（総売上・注文数・商品別売上・決済手段別内訳・日別推移） | ◯ |

### API詳細

#### `POST /api/auth/login`

フォームデータ（`application/x-www-form-urlencoded`）で送信します。

```
username=yakisoba&password=pass1234
```

レスポンス:

```json
{
  "access_token": "eyJhbGciOi...",
  "store_name": "焼きそば班"
}
```

ユーザー名またはパスワードが誤っている場合は `401 ユーザー名またはパスワードが正しくありません` が返ります。

#### `POST /api/auth/register`

運営本部（`store_name == "運営本部"`）のトークンでのみ実行可能。それ以外は `403 店舗登録は管理者のみ可能です`。

```json
{
  "name": "たこ焼き班",
  "username": "takoyaki",
  "password": "pass1234"
}
```

ユーザー名が既存の場合は `400 そのユーザー名はすでに使われています`。

#### `GET /api/products`

```json
[
  {
    "id": 1,
    "store_product_no": 1,
    "name": "焼きそば",
    "price": 500,
    "stock": 100,
    "store_id": 1
  }
]
```

- `id`: アプリ全体での商品ID（内部用）
- `store_product_no`: 店舗内の商品番号（URLパスや会計時はこちらを使う）

#### `POST /api/products`

```json
{ "name": "たこ焼き", "price": 400, "stock": 120 }
```

`store_product_no` はサーバー側で自店舗内の最大値+1として自動採番されます。

#### `PUT /api/products/{store_product_no}`

`ProductCreate` と同じ形式で、**全フィールドを毎回送信する必要があります**（部分更新には未対応）。

#### `POST /api/orders`

```json
{
  "items": [
    { "store_product_no": 1, "quantity": 2 }
  ],
  "total": 1000,
  "payment_method": [
    { "cash": 1000, "ticket_100": 0, "ticket_200": 0, "emoney": 0 }
  ]
}
```

- `items[].store_product_no`: 商品指定は**店舗内商品番号**（商品APIの `id` ではない点に注意）
- `total`: クライアント側で計算した合計金額（サーバー側の再計算と一致しないと400エラー）
- `payment_method`: 現金・各種金券・電子マネーを配列で組み合わせて指定（1件のみでも配列で送る）

レスポンス:

```json
{
  "id": 12,
  "store_id": 1,
  "created_at": "2026-07-01T09:00:00.000000",
  "items": [{ "product_id": 1, "quantity": 2 }],
  "total": 1000,
  "payment_method": [{ "cash": 1000, "ticket_100": 0, "ticket_200": 0, "emoney": 0 }],
  "tendered": 1000,
  "change": 0
}
```

#### `PUT /api/orders/{order_id}`

リクエスト形式は注文作成時と同じです。在庫を旧内容分戻してから新内容分を減算し、`total`/`tendered`/`change`を再計算した上で、新しい`items`・`payment_method`をレスポンスに反映します。

#### `GET /api/sales/summary`

クエリパラメータ `date`（`YYYY-MM-DD`形式、任意）を指定すると、その日の会計のみに絞り込んだ集計を返します。未指定なら全期間が対象です。

```json
{
  "total_revenue": 15000,
  "total_orders": 20,
  "sales_by_product": [
    { "product_name": "焼きそば", "quantity": 30, "amount": 15000 }
  ],
  "payment_breakdown": {
    "cash": 8000,
    "ticket_100_count": 10,
    "ticket_200_count": 5,
    "ticket_amount": 2000,
    "emoney": 5000
  },
  "sales_by_day": [
    { "date": "2026-07-08", "total_orders": 5, "total_revenue": 4200 },
    { "date": "2026-07-07", "total_orders": 15, "total_revenue": 10800 }
  ]
}
```

- `payment_breakdown`: 現金・模擬券（100円券／200円券の枚数と金額換算）・電子マネーの合計
- `sales_by_day`: 店舗の会計を日付単位でグループ化した一覧（`date`指定の有無に関わらず店舗全体の日別推移を返す）

自店舗の注文のみが集計対象です。

## セットアップ・起動方法

### Docker

```bash
docker compose up -d --build
```

### Podman（rootless）

Docker用の`docker-compose.yml`をrootless Podmanでそのまま使うと、短縮イメージ名の解決エラーや80番ポートのbind権限エラーで失敗します（詳細は`PODMAN_NOTES.md`参照）。Podman専用の`docker-compose.podman.yml`（イメージ名をフル修飾し、frontendを8080番で公開）を使ってください。

```bash
podman-compose -f docker-compose.podman.yml up -d --build
```

Podmanではフロントエンドのポートが8080番になる点以外は、以降の手順（初期データ投入等）はDocker/Podman共通です。

### 共通の初期セットアップ

- `entrypoint.sh` が起動時に `alembic upgrade head` を実行し、`stores` / `products` / `orders` / `order_items` / `payment_methods` テーブルを作成します。
- 初期データ投入（初回のみ、テーブルが空の場合に実行されます）:

```bash
# Docker
docker compose exec backend python init_stores.py
docker compose exec backend python init_data.py

# Podman
podman exec <backendコンテナ名> python init_stores.py
podman exec <backendコンテナ名> python init_data.py
```

- API: `http://localhost:8000`（Swagger UI: `http://localhost:8000/docs`）
- フロントエンド（nginx配信の静的ファイル）: Docker=`http://localhost:80` / Podman=`http://localhost:8080`

DBスキーマを作り直したい場合（Dockerの例。Podmanは`docker compose`を`podman-compose -f docker-compose.podman.yml`に読み替え）:

```bash
docker compose down -v   # DBボリュームを削除（データは消えます）
docker compose up -d
docker compose exec backend python init_stores.py
docker compose exec backend python init_data.py
```

> フロントエンドが参照するバックエンドURLは `frontend/js/config.js`（`window.__ENV__.API_BASE`）で設定します。デフォルトは`http://localhost:8000`。別ホスト/別ポートでbackendを動かす場合は、`api.js`を直接編集せずこのファイルだけを書き換えてください。

## 環境変数

| 変数名 | デフォルト値 | 説明 |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:password@localhost:5432/pos_db` | DB接続文字列（`docker-compose.yml` では `postgresql://postgres:postgres@postgres:5432/pos_db` を指定） |
| `SECRET_KEY` | **必須（デフォルト値なし）** | JWT署名キー。未設定だとbackendは起動時にエラーで落ちる（本番相当の秘密鍵ハードコード防止のため）。ローカル動作確認用の値は`docker-compose.yml`/`docker-compose.podman.yml`に設定済み |
| `DB_HOST` | - | `entrypoint.sh` のPostgreSQL起動待ち用ホスト名 |
| `DB_USER` | - | `entrypoint.sh` のPostgreSQL起動待ち用ユーザー名 |
| `CORS_ORIGINS` | localhost:80/8080等（`main.py`参照） | 許可するフロントエンドのオリジン（カンマ区切り）。未設定時はDocker/Podman双方のローカル配信ポートを許可 |
| `ENVIRONMENT` | 未設定（開発モード） | `production` を指定すると`uvicorn --reload`を無効化する（本番相当運用時のCPU負荷軽減） |

## テスト

### バックエンド（pytest）

実DB（PostgreSQL）ではなく、テストごとに独立したインメモリSQLiteを使うため、Docker/Podmanなしでも実行できます。

```bash
cd backend
pip install -r requirements-dev.txt
SECRET_KEY=test-secret-key pytest -v
```

認証・商品・注文・売上の各APIについて、正常系に加えて在庫不足／不正な合計金額／権限エラー／価格変更後も過去の注文の単価が変わらないこと、などの境界値・不変条件をテストしています（`backend/tests/`）。

### フロントエンド（bun test）

POSレジの会計金額計算・お釣り計算・模擬券不足判定・支払方法組み立てロジック（`frontend/js/pos-calc.js`）を対象に、[Bun](https://bun.sh/)のテストランナーでテストしています。ビルドステップが無い構成のため、追加の依存インストールは不要です。

```bash
cd frontend
bun test
```

### CI

`.github/workflows/ci.yml` で、push・pull request のたびに上記2つのテストと、backendイメージの`docker build`確認を実行します。`.github/workflows/dependency-audit.yml` は毎週`pip-audit`でbackendの依存パッケージの既知脆弱性をチェックします（手動実行も可能）。

## 初期データ

`init_stores.py` で投入される店舗（テーブルが空の場合のみ実行されます）:

| 店舗名 | username | password |
|---|---|---|
| 焼きそば班 | yakisoba | pass1234 |
| から揚げ班 | karaage | pass1234 |
| 運営本部 | admin | admin1234 |

`init_data.py` で投入される商品（同じくテーブルが空の場合のみ）:

| 店舗 | 商品名 | 価格 | 在庫 |
|---|---|---|---|
| 焼きそば班 | 焼きそば | 500 | 100 |
| から揚げ班 | から揚げ | 300 | 150 |
| から揚げ班 | フランクフルト | 200 | 200 |

