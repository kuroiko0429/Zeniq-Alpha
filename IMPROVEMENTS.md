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

## 🧱 データ整合性・スキーマ設計 — ✅ 対応済み

- ~~**`products.store_product_no`にDBレベルの一意制約がない**~~
  → `UniqueConstraint('store_id', 'store_product_no')`をマイグレーション（`005_add_unique_store_product_no`）で追加。`product_service.create`は`IntegrityError`発生時に最大3回まで採番をリトライし、それでも失敗したら409を返すよう変更。15並列リクエストで実機テストし、重複なしで13件成功・2件が409（リトライ上限）になることを確認済み。
- ~~**注文明細（`order_items`）に購入時点の単価スナップショットがない**~~
  → `order_items.unit_price`カラムを追加（マイグレーション`006_add_order_item_unit_price`、既存行はproducts.priceで一括バックフィル）。`order_service.py`のcreate/update両方で作成時の`product.price`を保存。`frontend/js/orders.js`の履歴表示もこの`unit_price`を使うよう変更。商品価格を500→700に変更後も、既存注文が引き続き500円として表示されることを実機確認済み。
- ~~**商品削除時に過去の注文がある場合の考慮がない**~~
  → `product_service.delete`で削除前に`order_items`の参照有無をチェックし、履歴がある場合は400「◯◯ は過去の注文で使用されているため削除できません」を返すよう変更（生の500 IntegrityErrorだったのを解消）。履歴のある商品の削除が400、履歴のない商品の削除が200になることを確認済み。
- ~~**`products.stock`が`nullable=True`**~~
  → マイグレーション`007_products_stock_not_null`で既存NULL行を0埋めしたうえで`NOT NULL DEFAULT 0`に変更。モデルも追従済み。
- ~~**`ProductCreate`/`OrderItemCreate`に非負制約がない**~~
  → `ProductCreate.price`/`stock`に`Field(ge=0)`、`OrderItemCreate.quantity`に`Field(gt=0)`、`OrderCreate.total`と`OrderPaymentMethodCreate`の各金額フィールドにも`Field(ge=0)`を追加。負の価格・0以下の数量での登録がいずれも422になることを確認済み。

## ⚙️ バックエンド設計 — ✅ 対応済み

- ~~**`--reload`が本番相当のentrypointでも常に有効**~~
  → `backend/entrypoint.sh`で`ENVIRONMENT=production`のときだけ`--reload`を外すよう変更（未設定時は従来通り開発モード）。`ENVIRONMENT=production`でコンテナを起動し、`Started reloader process`のログが出なくなることを確認済み。
- ~~**`sqlalchemy.ext.declarative.declarative_base`が非推奨API**~~
  → `backend/database.py`のインポート元を`sqlalchemy.orm.declarative_base`に変更。
- ~~**ページネーションが存在しない**~~
  → `GET /api/products`・`GET /api/orders`に`limit`（1〜500、省略時は無制限で従来通り全件）・`offset`クエリパラメータを追加。商品一覧は`store_product_no`昇順、注文一覧は従来通り`created_at`降順で決定的にソートした上でoffset/limitを適用。`limit=1&offset=1`で正しく次の1件が返ること、`limit=0`が422になることを確認済み。
- ~~**`backend/routers/products.py`と`orders.py`に例外ハンドリングの層がない**~~
  → `main.py`に`IntegrityError`用ハンドラ（409＋サーバーログ出力）と、想定外の例外全般を捕捉する`Exception`ハンドラ（500、スタックトレースを外部に漏らさない）を追加。既存の`HTTPException`（401/403/404/400/409/422等）はFastAPIのデフォルトハンドラが優先されるため動作は変わらない。実機で「同時に同じユーザー名を5並列で登録」を再現し、以前は生の500になっていたはずの競合が、1件成功・4件とも綺麗な409（+サーバーログにWARNING記録）になることを確認済み。

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
