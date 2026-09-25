// config.js
// デプロイ環境ごとに変わりうる設定値（バックエンドAPIのURLなど）をここに集約する。
//
// 別ホスト/別ポートでbackendを動かす場合は、api.js等のソースを直接編集せず
// このファイルのAPI_BASEだけを書き換えればよい。nginx配信であれば、
// このファイル1枚だけを環境ごとに差し替える（volumeマウント等で上書きする）
// 運用も可能。
//
// type="module" のスクリプトより前に必ず実行される通常の<script>として
// 各HTMLから読み込むこと（`<script src="js/config.js"></script>`、type属性なし）。
window.__ENV__ = {
    API_BASE: 'http://localhost:8000'
};
