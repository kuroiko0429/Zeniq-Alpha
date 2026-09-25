# 改善・改造・改良メモ（Zeniq → Zeniq-Alpha）

コード全体を読んで見つけた改善点の棚卸しです。優先度高いもの（今すぐ壊れてる／危ない）から並べています。

## 🔥 最優先（実害が出ているバグ）— ✅ 対応済み

- ~~**`frontend/js/api.js:3` の `API_BASE` が `https://localhost:8000` になっている**~~
  → `http://localhost:8000` に修正済み。ブラウザで実際にログイン→POSレジ画面遷移まで動作確認済み（`http://localhost:8000/api/auth/login` が200を返すことを確認）。
- ~~**`backend/entrypoint.sh:11` の `python -m alembic upgrade head` が常に失敗する**~~
  → `alembic upgrade head`（`-m`なし）に修正済み。DBボリュームを空の状態から起動し、`entrypoint.sh`の自動マイグレーションだけでログインAPIが200/401を正しく返す（500にならない）ことを確認済み。
- ~~**`frontend/js/pos.js:358-359` にデバッグ用の `console.log` が残っている**~~
  → 削除済み。ブラウザで`/api/products`へのリクエストが不要な重複なく1回だけ発生することを確認済み。

## 🔒 セキュリティ — ✅ 対応済み

- ~~**管理者判定が文字列比較（`store_name == "運営本部"`）に依存している**~~
  → `stores.is_admin`（Boolean）カラムを追加（`alembic/versions/004_add_is_admin_to_stores.py`、既存の「運営本部」行は自動でis_admin=trueに移行）。JWTペイロードにも`is_admin`を含め、`/api/auth/register`は`is_admin`で判定するよう変更。非admin店舗からの登録試行が403になることを実機確認済み。
- ~~**`SECRET_KEY`のデフォルト値がハードコードされている**~~
  → `backend/auth/dependencies.py`でフォールバックを廃止し、未設定なら`RuntimeError`で起動時に落ちるように変更。`SECRET_KEY`なしでコンテナを起動しようとするとエラーで落ちることを確認済み。
- ~~**CORSが全開放**~~
  → `backend/main.py`で`CORS_ORIGINS`環境変数（未設定時はlocalhost:80/8080等のデフォルト）による許可オリジンリストに変更。許可オリジン（`http://localhost:8080`）からのプリフライトは200、非許可オリジン（`http://evil.example.com`）からは400になることを確認済み。
- ~~**ログインにレート制限がない**~~
  → `slowapi`を導入し、`POST /api/auth/login`にIPごと`10/minute`のレート制限を追加（`backend/rate_limit.py`）。同一IPから11回目のリクエストが429になることを確認済み。
- ~~**パスワードの強度チェックが一切ない**~~
  → `schemas/auth.py`の`RegisterRequest.password`に`Field(min_length=8)`を追加。8文字未満での登録が422になることを確認済み。
- **JWTの失効手段がない**（ステートレスJWTのみ、ブラックリスト等なし）。店舗のパスワード変更・アカウント削除後も、有効期限（8時間）内はトークンが使え続ける。学園祭1日運用なら実害は小さいため、今回は未対応（実装するならRedis等でのブラックリスト管理が必要になり手間が大きい）。

## 🧱 データ整合性・スキーマ設計

- **`products.store_product_no`にDBレベルの一意制約がない**（`alembic/versions/001_initial.py:28-38`）。`product_service.create`（`backend/services/product_service.py:18-29`）は「同店舗の最大値+1」をSELECTしてから INSERTするだけで、トランザクションロックも一意制約もない。同時に2リクエストが来ると**同じ`store_product_no`が重複採番される**（競合状態）。`UniqueConstraint('store_id', 'store_product_no')`をマイグレーションで追加し、アプリ側でも`IntegrityError`をハンドリングしてリトライ or 400を返すようにする。
- **注文明細（`order_items`）に購入時点の単価スナップショットがない**（`backend/models/order.py:19-28`、`schemas/order.py:19-21`）。`quantity`と`product_id`だけを保持しており、単価は持っていない。あとから商品価格を変更すると、過去の注文の「単価×数量」を再現できなくなる（`Order.total`自体は作成時点の値のまま保持されるので合計だけは正しいが、明細レベルの内訳が壊れる）。`order_items`に`unit_price`カラムを追加し、作成時の`product.price`を保存するべき。
- **商品削除時に過去の注文がある場合の考慮がない**（`backend/services/product_service.py:43-47`）。`order_items.product_id`のFKには`ondelete`指定がなく（`001_initial.py:61`）、注文履歴がある商品を削除しようとするとDBの外部キー制約違反で生の500エラーになる。「論理削除（is_deletedフラグ）」に切り替えるか、削除前に注文履歴の有無をチェックして分かりやすい400エラーを返す。
- **`products.stock`が`nullable=True`**（`models/product.py:11`、マイグレーションも`nullable=True`）。在庫はビジネスロジック上必須の値なので`NOT NULL DEFAULT 0`にすべき。
- **`ProductCreate`/`OrderItemCreate`に非負制約がない**（`schemas/product.py`, `schemas/order.py`）。`price`や`stock`に負の値、`quantity`に0以下の値を送っても素通りしてしまう。Pydanticの`Field(ge=0)`/`Field(gt=0)`で弾くべき。

## ⚙️ バックエンド設計

- **`--reload`が本番相当のentrypointでも常に有効**（`backend/entrypoint.sh:14`）。watchfilesのポーリングにより、アイドル時でもbackendコンテナのCPU使用率が約16%と高め（実測、`PODMAN_NOTES.md`参照）。`ENVIRONMENT`環境変数で`--reload`の有無を切り替えるようにする。
- **`sqlalchemy.ext.declarative.declarative_base`が非推奨API**（`backend/database.py:2`）。SQLAlchemy 2.0では`sqlalchemy.orm.declarative_base`に統合されている。インポート元を差し替えるだけの軽微な修正。
- **ページネーションが存在しない**（`GET /api/products`, `GET /api/orders`）。学園祭規模なら今すぐ困らないが、件数が増えると全件シリアライズがそのまま重くなる。`limit`/`offset`かカーソルベースの対応を検討。
- **`backend/routers/products.py`と`orders.py`に例外ハンドリングの層がない**。バリデーションエラーやDB制約違反がFastAPIのデフォルト500として素通しになる箇所が複数ある（上記の商品削除の例など）。共通の例外ハンドラ（`@app.exception_handler`）を`main.py`に追加して、レスポンス形式を統一したい。

## 🎨 フロントエンド

- **`admin.html`が未実装のまま**（「実装予定」の見出しのみ）。店舗登録（`POST /api/auth/register`）は運営本部トークンでしか呼べない仕様なので、この画面がないと新規店舗登録がSwagger UI経由でしかできない。優先して作る価値あり。
- **`frontend/js/pos.js`が1関数1行にロジックを詰め込むスタイルで書かれており可読性が低い**（例: 122行目の`itemToCart`、124行目の`renderCartItem`など、セミコロン区切りの長大な1行関数）。動作はするが保守性が低いので、改造の過程で整形・分割したい。
- **フロントに単体テストが一切ない**（`pos.js`の会計金額計算・お釣り計算・模擬券不足判定などロジックが複雑な割に無防備）。Vitest等で計算ロジック部分だけでも切り出してテストしたい。
- **API_BASEがハードコード**（`https://localhost:8000` の件と同根）。本番/検証/ローカルで向き先を変えられるよう、ビルド時環境変数か`window.__ENV__`的な注入に変えたい。

## 🐳 インフラ・DevOps

- **Dockerfileに`.dockerignore`がない**。ビルドコンテキストに`.git`等の不要ファイルまで含まれてしまう。`backend/.dockerignore`（`__pycache__`, `.git`, `*.pyc`等）を追加。
- **CIが存在しない**（GitHub Actions等なし）。少なくとも「backendの起動確認」「pytestがあれば実行」程度のワークフローを入れたい。
- **依存パッケージのバージョンが2024年前後で固定**（`fastapi==0.111.0`, `python-jose==3.3.0`等）。既知の脆弱性がないか`pip-audit`等で定期チェックしたい。
- **Podman環境での動作が未整備**（詳細は`PODMAN_NOTES.md`）。`registries.conf`の要求、rootless時の特権ポート制限、`entrypoint.sh`の実行ビット消失など。プロジェクトとしてPodmanもサポート対象にするなら、READMEにDocker/Podman両対応の手順を書いておきたい。

## 📌 その他・軽微

- `backend/services/order_service.py`の各所にセミコロン付きの文（`services/order_service.py:32`, `114`など）が混じっている。Pythonなので不要、統一したい。
- `README.md`のスクリーン実装状況の表（画面一覧）が古い。`header.js`はログアウトボタンのイベントバインド済み、`orders.html`は`type="module"`化済み、`pos.js`/`items.js`/`orders.js`/`sales.js`もAPI連携済みなど、実装が進んでREADMEの記述と食い違っている箇所が複数ある。ドキュメントの同期も改造の一環でやりたい。
