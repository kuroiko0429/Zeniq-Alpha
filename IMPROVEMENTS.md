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

## 🎨 フロントエンド — ✅ 対応済み

- ~~**`admin.html`が未実装のまま**~~
  → 店舗登録フォームを実装（`frontend/admin.html` / `js/admin.js` / `css/admin.css`）。バックエンドの`TokenResponse`に`is_admin`を追加し、フロントは`auth.js`に`getIsAdmin()`/`requireAdmin()`を追加してセッションに保存、`header.js`は管理者ログイン時のみ「管理画面」ナビリンクを表示するよう変更。実機で「管理者ログイン→管理画面リンク表示→店舗登録→新規アカウントでログイン成功」「非管理者ログイン→リンク非表示→`admin.html`へ直接アクセスしても`index.html`へリダイレクト」を確認済み。
- ~~**`frontend/js/pos.js`が1関数1行にロジックを詰め込むスタイルで可読性が低い**~~
  → 会計金額計算・お釣り計算・模擬券不足判定・支払方法（payment_method）組み立てロジックを`frontend/js/pos-calc.js`に純粋関数として切り出し、`pos.js`側はDOM更新とこれらの関数呼び出しに専念する形に整理（`itemToCart`等のDOM配線部分は動作リスク回避のため今回はスタイル据え置き）。ブラウザでカート追加→現金支払い→会計実行の一連のフローが従来通り動作し、`unit_price`込みで注文がサーバーに正しく保存されることを確認済み。
- ~~**フロントに単体テストが一切ない**~~
  → `frontend/package.json`＋`bun test`で`pos-calc.js`の単体テスト（`pos-calc.test.js`）を追加。カート合計・お釣り計算・模擬券不足判定・会計ボタン活性判定・支払方法組み立ての各関数について、境界値（ちょうど足りる／不足／過払いのクランプ等）を含む33ケースを網羅。`bun test`で全件パス確認済み。
- ~~**API_BASEがハードコード**~~
  → `frontend/js/config.js`で`window.__ENV__.API_BASE`を注入する方式に変更（ビルドステップが無い素のHTML/JS構成のため、`window.__ENV__`注入を採用）。`api.js`は`window.__ENV__?.API_BASE`を優先し、未設定時のみデフォルト値にフォールバック。API呼び出しを行う全6画面（login/index/items/orders/sales/admin）に`<script src="js/config.js">`を追加し、`type="module"`のスクリプトより確実に先に実行されるようにした。

## 🐳 インフラ・DevOps — ✅ 対応済み

- ~~**Dockerfileに`.dockerignore`がない**~~
  → `.dockerignore`をリポジトリ**ルート**に追加（`backend/Dockerfile`のビルドコンテキストは`docker-compose.yml`で`context: .`＝リポジトリルートに設定されているため、`backend/.dockerignore`ではなくルート直下に置く必要がある点に注意。元のメモの想定場所は誤りだったので修正した）。`.git`・`frontend/`・ドキュメント・`__pycache__`等を除外。
- ~~**CIが存在しない**~~
  → `.github/workflows/ci.yml`を追加。push/pull requestのたびに (1) backendのpytest（`backend/tests/`、32ケース）、(2) frontendの`bun test`（33ケース）、(3) backendイメージの`docker build`確認、の3ジョブを実行。backendには以前テストが1件も無かったため、CIを機能させるためにまず`backend/tests/`（認証・商品・注文・売上の正常系/異常系/境界値）を新規に書いた。テスト用DBは実PostgreSQLではなくテストごとに独立したインメモリSQLiteを使うため、CI側でPostgreSQLサービスコンテナを用意する必要がない。
- ~~**依存パッケージのバージョンが2024年前後で固定**~~
  → `.github/workflows/dependency-audit.yml`を追加。毎週月曜（`workflow_dispatch`で手動実行も可）に`pip-audit`で`backend/requirements.txt`の既知脆弱性をチェックする。push/pull requestをブロックしない独立ワークフローとした。
- ~~**Podman環境での動作が未整備**~~
  → 既に`docker-compose.podman.yml`（フル修飾イメージ名・frontend 8080番）と`PODMAN_NOTES.md`で対応済みだったものを、README本体にも反映。`README.md`のセットアップ節にDocker/Podman両方の起動コマンドを併記し、`環境変数`表を`SECRET_KEY`必須化・`CORS_ORIGINS`・`ENVIRONMENT`の追加分も含めて更新した。

## 📌 その他・軽微 — ✅ 対応済み

- ~~`backend/services/order_service.py`の不要なセミコロン~~ → 削除済み。
- ~~`README.md`の画面一覧表が古い~~ → 全画面が連携済みであることを反映し、ディレクトリ構成図・環境変数表もあわせて現状に同期した。README に「テスト」節（pytest / bun test / CIの実行方法）も新設。

## テスト整備の過程で見つけた追加バグ（今回まとめて修正済み）

インフラ整備のためにbackendへ初めてテストを書いたところ、以下2件の実害あるバグが見つかったため、あわせて修正した。

- **`routers/sales.py`の商品別売上（`sales_by_product`）が、購入時点の単価ではなく現在の商品価格で再計算されていた**（`models.Product.price * models.OrderItem.quantity`）。`order_items.unit_price`追加時（データ整合性の回で）に、この集計クエリだけ移行し忘れていた。`models.OrderItem.unit_price * models.OrderItem.quantity`を使うよう修正し、「注文後に商品価格を変更しても売上集計の金額は変わらない」ことをテストで固定した。
- **`services/order_service.py`の`delete()`が在庫を復元していなかった**。同じファイルの`update()`は古い注文明細の分だけ在庫を戻す処理があるのに、`delete()`にはその処理が無く、注文を削除しても在庫が減ったままになっていた。`update()`と同様の復元処理を追加し、テストで固定した。
