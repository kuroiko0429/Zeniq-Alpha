# Podman動作確認・起動速度メモ

> 2026-09-24に、このマシン（Docker Desktopではなく **Podman 6.1.2 / podman-compose 1.6.0**）で実際に `docker-compose.yml` を使って一式を起動し、backend / frontendの応答速度を計測した記録です。今後動かす人向けのメモとして残します。
>
> 追記（Zeniq-Alpha化にあたって）: 以下で見つかった1番目・2番目の問題は、Podman専用の `docker-compose.podman.yml` を新設して解決済みです。`podman-compose -f docker-compose.podman.yml up -d --build` で起動してください。以下の記述は「なぜその内容にしたか」の調査ログとして残しています。

## 詰まったポイント（Podman固有の差分）

`docker-compose.yml` はDocker前提で書かれているため、rootless Podmanでは無調整だと以下の3点で失敗します。

1. **`postgres:16-alpine` の短縮名解決エラー**
   `Error: short-name "postgres:16-alpine" did not resolve to an alias and no containers-registries.conf(5) was found` で失敗する。`nginx:alpine`や`python`系は以前pullしてローカルキャッシュにあったため通っていただけで、未キャッシュのイメージは全滅する。
   → 恒久対応として `docker-compose.podman.yml` ではイメージ名を `docker.io/library/postgres:16-alpine` のようにフル修飾している（`~/.config/containers/registries.conf` に `unqualified-search-registries = ["docker.io"]` を追加する方法でも解決できるが、リポジトリ外の環境設定になるため今回はcompose側で解決する方針にした）。
2. **80番ポートのbindでpermission denied**
   `frontend`（nginx）が `80:80` を公開しようとして `rootlessport cannot expose privileged port 80 ... bind: permission denied` で落ちる。rootless Podmanは既定で1024未満のポートをbindできない。
   → 恒久対応として `docker-compose.podman.yml` では `frontend` のポートを `8080:80` に固定している。`sudo sysctl net.ipv4.ip_unprivileged_port_start=80`（要sudo）で80番のまま使う方法もあるが、rootlessのまま動かすことを優先した。
3. **`backend/entrypoint.sh` の実行権限がリポジトリ上で落ちている**
   `git`上のパーミッションが`-rw-r--r--`（実行不可）になっており、`backend:/app`のbindマウントでイメージ内の`chmod +x`後のファイルを上書きしてしまうため、`OCI permission denied: exec: "./entrypoint.sh"`で起動に失敗する。ローカルで`chmod +x backend/entrypoint.sh`して解消し、そのまま本リポジトリにコミットした（Docker環境でも本来起きうる同種の問題なので、直しておく価値あり）。

## 追加で見つけたバグ（Podmanとは無関係）— ✅ 修正済み

- ~~`backend/entrypoint.sh` の `python -m alembic upgrade head` は、このalembicバージョン（1.13.1）では `No module named alembic.__main__` で**必ず失敗**し、`|| echo "Warning: ... continuing"` で握りつぶされてそのまま起動してしまう。結果、**DBにテーブルが1つも作られないままAPIが立ち上がり**、`/api/auth/login`等は500 Internal Server Errorになる。~~
  → `alembic upgrade head`（`-m`を外す）に修正済み。DBボリュームを空にした状態から起動し直し、手動介入なしで`entrypoint.sh`の自動マイグレーションだけでログインAPIが正しく動く（500ではなく200/401になる）ことを確認済み。

## 起動手順（Podman）

```bash
# 1. entrypoint.shの実行権限（本リポジトリでは対応済み）
chmod +x backend/entrypoint.sh

# 2. Podman専用compose（フル修飾イメージ名・frontend 8080番）で起動
#    マイグレーションはentrypoint.shが自動で実行する（-m alembic問題は修正済み）
podman-compose -f docker-compose.podman.yml up -d --build

# 3. 初期データ投入（初回のみ、テーブルが空の場合に実行される）
podman exec <backendコンテナ名> python init_stores.py
podman exec <backendコンテナ名> python init_data.py
```

フロントエンドは `http://localhost:8080`、backendは従来通り `http://localhost:8000` で確認できる。

> Docker側（`docker-compose.yml`）はこれまで通り `docker compose up -d --build` で80番のまま使える。`docker-compose.podman.yml`と自動マージはしていない（podman-composeの`-f`複数指定はリスト値を上書きではなく連結してしまうバグがあり、`ports`のようなリストが両方effectiveになって80番bindが復活し失敗するため。実際に踏んだ）。それぞれ独立したファイルとして使う。

## 速度計測結果

**ビルド／起動時間**

| 項目 | 所要時間 | 備考 |
|---|---|---|
| 初回 `podman-compose up -d --build`（pip依存フルダウンロード＋postgres/nginxイメージpull込み） | 600秒超（タイムアウトで中断、実際はさらに継続中だった） | 主因はbackendの`pip install`（fastapi等30パッケージ超）のフルダウンロード。ネットワーク律速 |
| `postgres:16-alpine` の単体pull（キャッシュ後の再計測用） | 約8秒 | 297MB |
| 2回目以降の `podman-compose up -d --build`（pip/レイヤーキャッシュあり） | 約4.7秒 | ビルドはほぼ全ステップ `Using cache`。実質コンテナ再生成のみ |
| コンテナが実際にリクエストへ応答可能になるまで（`postgres healthy`→`uvicorn起動完了`） | 3秒以内 | ログの`Application startup complete.`まで |

**backend（FastAPI/Uvicorn、`--reload`付き）のHTTP応答時間（`curl`、ローカルhost→ポートフォワード経由、5回計測）**

| エンドポイント | 応答時間（目安） | 備考 |
|---|---|---|
| `GET /docs` | 約1.1〜1.6ms | Swagger UI HTML |
| `POST /api/auth/login` | 約276〜326ms | **bcryptのハッシュ照合が支配的**（意図した重さ。異常ではない） |
| `GET /api/products`（JWT認証あり） | 約2.9〜5.0ms | DB1クエリ |
| `GET /api/sales/summary`（JWT認証あり） | 約6.6〜13.8ms | 集計クエリが複数走る分やや遅い |

**frontend（nginx:alpine、静的配信）のHTTP応答時間（5回計測）**

| パス | 応答時間（目安） | サイズ |
|---|---|---|
| `/login.html` | 約0.7〜0.8ms | 3.8KB |
| `/index.html` | 約0.6〜1.4ms | 6.5KB |
| `/js/pos.js` | 約0.6〜0.8ms | 18KB |

**アイドル時リソース使用量（`podman stats --no-stream`）**

| コンテナ | CPU% | メモリ |
|---|---|---|
| `postgres` | 0.85% | 23.6MB |
| `backend`（uvicorn --reload） | 16.12%（watchfilesのポーリングの影響が大きい） | 94.9MB |
| `frontend`（nginx） | 0.16% | 9.5MB |

**イメージサイズ**

| イメージ | サイズ |
|---|---|
| `localhost/zeniq-alpha_backend`（python:3.11-slim + 依存） | 305MB |
| `postgres:16-alpine` | 297MB |
| `nginx:alpine` | 63.7MB |

## まとめ

- **静的フロント（nginx）は爆速**（1ms未満）。バックエンドも認証以外のAPIはDB1発なら数ms程度で軽い。
- **`/api/auth/login`だけ意図的に遅い**（bcrypt）。1回あたり300ms弱は妥当な範囲で、性能問題ではない。
- **初回ビルドはネットワーク待ちがほぼ全て**（pip install）。2回目以降はキャッシュが効いて5秒未満で再起動できる。
- Podman rootless特有の詰まりどころは「短縮イメージ名解決」「特権ポート（80番）」の2点。`docker-compose.podman.yml`を新設してどちらも解決済み（イメージ名フル修飾＋frontendを8080番に固定）。
- `entrypoint.sh`のマイグレーション自動実行は**現状壊れている**（`-m alembic`非対応）ため、初回セットアップ時は手動で`alembic upgrade head`を叩く必要がある点は友人に共有した方がよさそう。
