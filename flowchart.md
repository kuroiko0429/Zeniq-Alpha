%%●ログイン画面

flowchart TD

A[Webアプリ起動] --> B[ログイン画面表示]

B --> C{タブ選択}

%% ログイン
C -->|ログイン| D[ユーザー名・パスワード入力]
D --> E[ログインボタン]

E --> F{認証成功?}

F -->|成功| G[POSレジ画面へ]
F -->|失敗| H[エラーメッセージ表示]

%% 新規作成
C -->|新規作成| I[店名・ユーザー名・パスワード入力]
I --> J[新規作成ボタン]

J --> K{作成成功?}

K -->|成功| G
K -->|失敗| L[エラーメッセージ表示]

classDef normal fill:#ffffff,stroke:#6b7280,color:#111827;
classDef success fill:#dcfce7,stroke:#16a34a,color:#166534;
classDef error fill:#fee2e2,stroke:#dc2626,color:#991b1b;
classDef branch fill:#fef9c3,stroke:#ca8a04,color:#854d0e;

class G success;
class H,L error;
class C,F,K branch;
class A,B,D,E,I,J normal;

%%●ログイン画面ここまで



%%●共通ヘッダー
flowchart LR

A[POSレジ]
B[商品管理]
C[会計履歴]
D[売上分析]

A <--> B
A <--> C
A <--> D
B <--> C
B <--> D
C <--> D

D --> E[ログアウト押下]

E --> F{確認アラート}

F -->|OK| G[ログアウト実行]
G --> H[ログイン画面へ]

F -->|キャンセル| I[元の画面へ戻る]

classDef normal fill:#ffffff,stroke:#6b7280,color:#111827;
classDef success fill:#dcfce7,stroke:#16a34a,color:#166534;
classDef error fill:#fee2e2,stroke:#dc2626,color:#991b1b;
classDef branch fill:#fef9c3,stroke:#ca8a04,color:#854d0e;

class G,H success;
class F branch;
class A,B,C,D,E,I normal;

%%●共通ヘッダーここまで


%%●POSレジ画面

flowchart TD

A[商品選択] --> B[カート追加]

B --> C[数量変更]
C -->|＋| D[1個追加]
C -->|－| E[1個減少]
C -->|×| F[商品削除]

B --> G{支払方法選択}

%% 現金
G -->|現金| H[預り金入力]
H --> I{金額足りる?}

I -->|YES| J[お釣り表示]
J --> K[会計するボタン有効]

I -->|NO| L[不足金額表示]

%% 模擬券
G -->|模擬券| M[100円券・200円券入力]
M --> N{金額足りる?}

N -->|YES| K

N -->|NO| O[追加支払方法選択]

O -->|現金| P[現金入力]
P --> Q{金額足りる?}

Q -->|YES| R[お釣り表示]
R --> K

Q -->|NO| S[不足金額表示]

O -->|QR決済| K

%% QR
G -->|QR決済| K

%% 会計
K --> T[会計実行]

T --> U{成功?}

U -->|成功| V[会計完了トースト]
V --> W[カートを空にする]

U -->|失敗| X[会計失敗トースト]

classDef normal fill:#ffffff,stroke:#6b7280,color:#111827;
classDef success fill:#dcfce7,stroke:#16a34a,color:#166534;
classDef error fill:#fee2e2,stroke:#dc2626,color:#991b1b;
classDef branch fill:#fef9c3,stroke:#ca8a04,color:#854d0e;

class V,W success;
class L,S,X error;
class G,I,N,Q,U branch;
class A,B,C,D,E,F,H,J,K,M,O,P,R,T normal;

%%●POSレジ画面ここまで


%%●商品管理画面
flowchart TD

A[商品管理画面]

%% 商品追加
A --> B[商品を追加ボタン]
B --> C[追加フォーム表示]

C --> D[商品名・価格入力]

D --> E{操作選択}

E -->|キャンセル| F[元画面へ戻る]

E -->|追加| G{バリデーションOK?}

G -->|NO| H[そのままエラーメッセージ表示]

G -->|YES| I[商品追加実行]

I --> J{成功?}

J -->|成功| K[商品追加トースト]
J -->|失敗| L[追加失敗トースト]

%% 編集
A --> M[編集ボタン]
M --> N[編集フォーム表示]

N --> O[商品名・価格編集]

O --> P{操作選択}

P -->|キャンセル| Q[元画面へ戻る]

P -->|保存| R{バリデーションOK?}

R -->|NO| S[そのままエラーメッセージ表示]

R -->|YES| T[商品編集実行]

T --> U{成功?}

U -->|成功| V[編集成功トースト]
U -->|失敗| W[編集失敗トースト]

%% 削除
A --> X[削除ボタン]

X --> Y{確認アラート}

Y -->|キャンセル| Z[元画面へ戻る]

Y -->|OK| AA[商品削除実行]

AA --> AB{成功?}

AB -->|成功| AC[削除成功トースト]
AB -->|失敗| AD[削除失敗トースト]

classDef normal fill:#ffffff,stroke:#6b7280,color:#111827;
classDef success fill:#dcfce7,stroke:#16a34a,color:#166534;
classDef error fill:#fee2e2,stroke:#dc2626,color:#991b1b;
classDef branch fill:#fef9c3,stroke:#ca8a04,color:#854d0e;

class K,V,AC success;
class H,L,S,W,AD error;
class E,G,P,R,Y,AB branch;
class A,B,C,D,F,I,J,M,N,O,Q,T,U,X,Z,AA normal;

%%●商品管理画面ここまで


%%●会計履歴画面

flowchart TD

A[会計履歴画面]

%% タブ
A --> B{タブ選択}

B -->|全期間| C[全履歴表示]
B -->|日別| D[当日履歴表示]

%% 検索
C --> E[検索条件入力]
D --> E

E --> F[入力次第検索]

F --> G{検索結果あり?}

G -->|YES| H[履歴表示]
G -->|NO| I[該当履歴なし表示]

%% 編集
H --> J[編集ボタン]

J --> K[編集フォーム表示]

K --> L[項目編集]

L --> M{操作選択}

M -->|キャンセル| N[元画面へ戻る]

M -->|保存| O{バリデーションOK?}

O -->|NO| P[そのままエラーメッセージ表示]

O -->|YES| Q[履歴編集実行]

Q --> R{成功?}

R -->|成功| S[編集成功トースト]
R -->|失敗| T[編集失敗トースト]

%% 削除
H --> U[削除ボタン]

U --> V{確認アラート}

V -->|キャンセル| W[元画面へ戻る]

V -->|OK| X[履歴削除実行]

X --> Y{成功?}

Y -->|成功| Z[削除成功トースト]
Y -->|失敗| AA[削除失敗トースト]

classDef normal fill:#ffffff,stroke:#6b7280,color:#111827;
classDef success fill:#dcfce7,stroke:#16a34a,color:#166534;
classDef error fill:#fee2e2,stroke:#dc2626,color:#991b1b;
classDef branch fill:#fef9c3,stroke:#ca8a04,color:#854d0e;

class S,Z success;
class I,P,T,AA error;
class B,G,M,O,R,V,Y branch;
class A,C,D,E,F,H,J,K,L,N,Q,U,W,X normal;

%%●会計履歴画面ここまで



%%●売上分析画面

flowchart TD

A[売上分析画面]

A --> B{タブ選択}

B -->|日別| C[当日の売上分析表示]

B -->|全期間| D[全期間の売上分析表示]

classDef normal fill:#ffffff,stroke:#6b7280,color:#111827;
classDef success fill:#dcfce7,stroke:#16a34a,color:#166534;
classDef error fill:#fee2e2,stroke:#dc2626,color:#991b1b;
classDef branch fill:#fef9c3,stroke:#ca8a04,color:#854d0e;

class B branch;
class A,C,D normal;

%%●売上分析画面ここまで