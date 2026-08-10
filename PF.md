## 現状
### API構造
#### 商品情報 `/api/products`
* Get Products
    <details>
    <summary> 登録商品参照 </summary>
    リクエストを送ったら

        [
            {
                "id": 0,
                "store_product_no": 0,
                "name": "string",
                "price": 0,
                "stock": 0,
                "store_id": 0
            }
        ]

    の形で帰ってくる  
    ` id ` このアプリ全体での商品番号(通常は登録順)  
    ` store_product_no ` 店舗内での商品番号(通常は店舗内での登録順)  
    ` name ` 商品名  
    ` price ` 価格  
    ` stock ` 在庫数  
    ` store_id ` 店舗番号
    </details>
* Create Products
    <details>
    <summary> 商品登録 </summary>

        {
            "name": "string",
            "price": 0,
            "stock": 0
        }

    この形で渡したら登録できる  
    ` name ` 商品名  
    ` price ` 価格  
    ` stock ` 在庫数  
    </details>
* Get Product
    <details>
    <summary>商品参照</summary>
    商品番号で参照

        {
            "id": 0,
            "store_product_no": 0,
            "name": "string",
            "price": 0,
            "stock": 0,
            "store_id": 0
        }
    
    の形で帰ってくる  
    ` id ` このアプリ全体での商品番号(通常は登録順)  
    ` store_product_no ` 店舗内での商品番号(通常は店舗内での登録順)  
    ` name ` 商品名  
    ` price ` 価格  
    ` stock ` 在庫数  
    ` store_id ` 店舗番号
    </details>
* Update Product
    <details>
    <summary>商品情報更新</summary>
    商品番号で参照  

        {
            "name": "string",
            "price": 0,
            "stock": 0
        }

    の形で渡す  
    現状では値が全部変わる  
    変える必要ないところも全部入力しなければならない
    </details>
* Delete Product
    <details>
    <summary>登録商品削除</summary>

    商品番号で参照  
    そのまま消える  
    商品番号は空番になる
    </details>
---
#### 会計 `/api/orders`
* Get Orders
    <details>
    <summary>会計履歴</summary>
    リクエストしたら
        
        [
            {
                "id": 0,
                "total": 0,
                "tendered": 0,
                "change": 0,
                "store_id": 0,
                "created_at": "2026-05-29T06:53:47.363Z",
                "items": [
                    {
                        "product_id": 0,
                        "quantity": 0,
                        "subtotal": 0
                    }
                ]
            }
        ]

    の形で帰ってくる  
    `id` 注文番号(レシート番号)  
    `total` 合計  
    `tendered` 預り金  
    `change` おつり  
    `store_id` 店舗番号  
    `created_at` 日時  
    </details>
* Create Order
    <details>
    <summary>会計</summary>

        {
            "items": [
                {
                "product_id":1,
                "quantity": 1
                }
            ],
            "tendered": 0
        }

    の形で渡す
    </details>
* Get Sales Summary
    * 売り上げ参照
---
#### ログイン
* Login
    * アクセストークン取得
* Register
    * 店舗登録  


---  
* 管理者側で支払方法の設定  
* 合算可否(bool)設定できるように  
* 会計操作と預かりを別パートで処理  
    * お釣りの必要がないのでは
    * フロントで計算して表示でいいのでは
* 預かり時に支払い方法選択  
    * 選択画面フロント側の処理で  
* データベース構造見直し  
<br>

* フロントでできることとバックでできることの確認  
    * 労力、処理スピードどっちのほうがかかるかで選ぶ  
* アニメーションとか入れるならAPIアクセスしない  
* 逆にバックでしなきゃならないことは？  
* 極論フロントで全部できるけど....  
* 会計入力途中のリアルタイム小計はどう表示する？  
<br>

* js書き換えはフロントと相談しながらやった方がいいのでは？
* DB設計はAPI担当が担当しきれる。だけど、人がいるので一緒にやる(DBわかんねえ)  
* サーバー決定しないと言語使えなくて困るかも
<br>


---
* 会計履歴の編集
* 支払方法
* 摸擬券優先→足りない分現金
* 摸擬券０だったら全部現金
* 売り上げ参照  
    * 日別全期間、売上合計、会計件数、現金、摸擬券枚数、QR決済、商品別売り上げ
* 会計処理をフロントでやるので、データの受け渡し、DBの書き換えをやる
* 在庫消す  
* 管理者だけ店舗の登録できるのではなく新規登録を受け付けられるようにする
* URL知ってたら誰でもアクセスして、店舗登録できるようになるから、店舗登録が許可制である必要がある？

---
* 商品の編集
    * getで検索してupdateで返す
--- 
* 預かりなくして預かり金種

---

### 導入できたら面白い
* https://www.paypay.ne.jp/opa/doc/jp/v1.0/dynamicqrcode  
* サブモニター(会計のリアルタイム表示) 
    * 物理接続よりも別端末でネットワークアクセスしたら表示できるシステム欲しいよね
    * アクセス → ログイン → POSモードor小計モニターモード → 表示
    * そもそもリアルタイムでできるの？
* レシート
    * 会計時レシートいるか選択して、そのデータをバックエンドに送ったら自動的に印刷
    * 受け取った際にアクセスあるからそっから