import { getProducts, getOrders, updateOrder, deleteOrder } from './api.js';

//エイリアス
const $ = (selector) => document.querySelector(selector);
const $all = (selector) => document.querySelectorAll(selector);

// 商品リスト（APIから取得して入れる。中身: {id, store_product_no, name, price, stock, store_id}）
let itemAry = [];

// 会計方法リスト（UI表示・支払方法selectの選択肢用）
const howAry = [
    "現金",
    "模擬券",
    "模擬券+現金",
    "模擬券+QR決済",
    "QR決済"
];

// 検索フィルターの決済方法select値 → 表示ラベルの対応
const howValueMap = {
    cash: "現金",
    ticket: "模擬券",
    ticketAndCash: "模擬券+現金",
    ticketAndQr: "模擬券+QR決済",
    qr: "QR決済"
};

//会計履歴リスト（APIから取得して入れる）
let orderAry = [];

// 支払方法に模擬券が含まれるかどうか
function isTicketHow(how) {
    return typeof how === "string" && how.indexOf("模擬券") !== -1;
}

// 商品idから単価・名前を取得するヘルパー（idはAPIの products[].id と対応）
function getItemMaster(id) {
    return itemAry.find((item) => item.id === Number(id));
}

// "yyyy/MM/dd HH:mm" 形式の文字列を作る
function formatDate(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// バックエンドのcreated_atはタイムゾーン情報なし（UTC想定）で返ってくるため、
// そのままDate化すると9時間ずれる（例: DB上1:00 → 画面上も1:00になってしまう）。
// 表示用にJST(+9時間)へ補正する。
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
function parseApiDateAsJst(apiDateStr) {
    return new Date(new Date(apiDateStr).getTime() + JST_OFFSET_MS);
}

// APIの注文レスポンス（OrderResponse）を、orders.js内部で使う形に変換する
function mapApiOrderToLocal(apiOrder) {
    const dateObj = parseApiDateAsJst(apiOrder.created_at);
    const pm = (apiOrder.payment_method && apiOrder.payment_method[0]) || {};
    const hasTicket = (pm.ticket_100 || 0) > 0 || (pm.ticket_200 || 0) > 0;
    const hasCash = (pm.cash || 0) > 0;
    const hasEmoney = (pm.emoney || 0) > 0;

    let how = "現金";
    if (hasTicket && hasCash) how = "模擬券+現金";
    else if (hasTicket && hasEmoney) how = "模擬券+QR決済";
    else if (hasTicket) how = "模擬券";
    else if (hasEmoney) how = "QR決済";
    else how = "現金";

    return {
        id: apiOrder.id,
        dateObj: dateObj,
        date: formatDate(dateObj),
        items: (apiOrder.items || []).map((it) => {
            const master = getItemMaster(it.product_id);
            // 単価はAPIが返す購入時点のunit_price（購入後に商品価格が変わっても
            // 履歴上の金額が変わらないようにするため）を優先し、
            // 万一unit_priceが無い古いデータのみ現在の商品マスタ価格にフォールバックする。
            return {
                id: it.product_id,
                name: master ? master.name : "不明な商品",
                price: it.unit_price ?? (master ? master.price : 0),
                num: it.quantity
            };
        }),
        how: how,
        ticket100: pm.ticket_100 || 0,
        ticket200: pm.ticket_200 || 0,
        total: apiOrder.total
    };
}

// 既存のorderAry上のオブジェクト(target)に、APIレスポンスの内容を上書きする
function applyApiOrderToLocal(target, apiOrder) {
    const mapped = mapApiOrderToLocal(apiOrder);
    Object.assign(target, mapped);
}

// 支払方法（how / ticket100 / ticket200 / total）から、注文APIに渡す payment_method 配列を組み立てる
// 注意: バックエンド側は cash / ticket_100 / ticket_200 / emoney の内訳金額を要求するが、
// UI側では模擬券の「枚数」と支払方法の「種別」しか入力しないため、
// 模擬券以外の残額をcashまたはemoneyにまとめて割り当てる想定で実装している。
function buildPaymentMethod(how, ticket100, ticket200, total) {
    const t100 = ticket100 || 0;
    const t200 = ticket200 || 0;
    const ticketAmount = t100 * 100 + t200 * 200;
    const remaining = Math.max(total - ticketAmount, 0);

    const pm = { cash: 0, ticket_100: t100, ticket_200: t200, emoney: 0 };

    if (how === "現金") {
        pm.cash = total;
    } else if (how === "模擬券") {
        pm.cash = 0;
    } else if (how === "模擬券+現金") {
        pm.cash = remaining;
    } else if (how === "模擬券+QR決済") {
        pm.emoney = remaining;
    } else if (how === "QR決済") {
        pm.emoney = total;
    }

    return [pm];
}

const itemSearchChecks = $(".item-search-checks")
function renderItemChecks() {
    itemSearchChecks.innerHTML = "";
    itemAry.forEach((item) => {
        const ele = document.createElement("label");
        ele.setAttribute("for", "item_" + String(item.id));
        ele.innerHTML = `
         <input id="item_${item.id}" type="checkbox" name="items" value="${item.id}">
        ${item.name}
        `;
        itemSearchChecks.appendChild(ele);
    })
}

const orderList = $(".order-list")

function calcSum(items) {
    return items.reduce((sum, item) => sum + (item.price * item.num), 0);
}

// 商品名選択用のoptionタグを生成
function buildItemOptions(selectedId) {
    return itemAry.map((item) => {
        const selected = Number(selectedId) === item.id ? "selected" : "";
        return `<option value="${item.id}" ${selected}>${item.name}</option>`;
    }).join("");
}

// 支払方法選択用のoptionタグを生成
function buildHowOptions(selectedHow) {
    return howAry.map((how) => {
        const selected = selectedHow === how ? "selected" : "";
        return `<option value="${how}" ${selected}>${how}</option>`;
    }).join("");
}

// order-head-right内の「編集・削除」ボタンを元通り表示する
function showDefaultHeadButtons(orderEle) {
    const headRight = orderEle.querySelector(".order-head-right");
    const editBtn = headRight.querySelector(".edit-order-btn");
    const deleteBtn = headRight.querySelector(".delete-order-btn");
    if (editBtn) editBtn.style.display = "";
    if (deleteBtn) deleteBtn.style.display = "";

    // 編集中に追加された確定・キャンセルボタンを除去
    const confirmBtn = headRight.querySelector(".confirm-order-btn");
    const cancelBtn = headRight.querySelector(".cancel-order-btn");
    if (confirmBtn) confirmBtn.remove();
    if (cancelBtn) cancelBtn.remove();
}

// order-head-rightに「確定・キャンセル」ボタンを追加し、既存ボタンを隠す
function showEditHeadButtons(orderEle, onConfirm, onCancel) {
    const headRight = orderEle.querySelector(".order-head-right");
    const editBtn = headRight.querySelector(".edit-order-btn");
    const deleteBtn = headRight.querySelector(".delete-order-btn");
    if (editBtn) editBtn.style.display = "none";
    if (deleteBtn) deleteBtn.style.display = "none";

    const confirmBtnEle = document.createElement("button");
    confirmBtnEle.setAttribute("type", "button");
    confirmBtnEle.setAttribute("class", "confirm-order-btn");
    confirmBtnEle.innerHTML = "<span class='m3-icon m3-icon-fill'>check</span>";
    confirmBtnEle.addEventListener("click", onConfirm);

    const cancelBtnEle = document.createElement("button");
    cancelBtnEle.setAttribute("type", "button");
    cancelBtnEle.setAttribute("class", "cancel-order-btn");
    cancelBtnEle.innerHTML = "<span class='m3-icon'>close</span>";
    cancelBtnEle.addEventListener("click", onCancel);

    headRight.appendChild(confirmBtnEle);
    headRight.appendChild(cancelBtnEle);
}

// 通常表示の中身（order-body）を作る
function renderOrderBodyView(orderEle, order) {
    showDefaultHeadButtons(orderEle);

    const orderBody = orderEle.querySelector(".order-body");
    orderBody.innerHTML = `
        <div class="order-item-area">
            <p class="order-body-subtitle">商品</p>
            <div class="order-item-list"></div>
        </div>

        <div class="order-how-area">
            <p class="order-body-subtitle">
                支払方法
            </p>
            <div class="order-how">
                ${order.how}
            </div>
            ${isTicketHow(order.how) ? `
            <div class="order-ticket">
                100円券：${order.ticket100 ?? 0}　200円券：${order.ticket200 ?? 0}
            </div>` : ""}
        </div>

        <div class="order-sum-area">
            <p class="order-body-subtitle">
                合計
            </p>
            <div class="order-sum">￥${order.total ?? calcSum(order.items)}</div>
        </div>
    `;

    const orderItemListEle = orderBody.querySelector(".order-item-list");
    order.items.forEach((item) => {
        const orderItemEle = document.createElement("div");
        orderItemEle.setAttribute("class", "order-item");
        orderItemEle.innerHTML = `
        <div class="order-item-name">
            ${item.name} × ${item.num}
        </div>
        <div class="order-item-sum">
            ￥${item.num * item.price}
        </div>`
        orderItemListEle.appendChild(orderItemEle);
    })
}

// 編集モードの中身（order-body）を作る。draftは編集中の一時オブジェクト
function renderOrderBodyEdit(orderEle, draft) {
    const orderBody = orderEle.querySelector(".order-body");
    orderBody.innerHTML = `
        <div class="order-item-area">
            <p class="order-body-subtitle">商品</p>
            <div class="order-item-list-area-edit">
                <div class="order-item-list-edit"></div>
                <button type="button" class="add-item-btn"><span class="m3-icon">add</span>商品を追加</button>
            </div>
        </div>

        <div class="order-how-area">
            <p class="order-body-subtitle">
                支払方法
            </p>
            <select class="order-how-select">
                ${buildHowOptions(draft.how)}
            </select>
            <div class="order-ticket-edit" style="${isTicketHow(draft.how) ? "" : "display:none;"}">
                <label><span>100円模擬券：</span><input type="number" class="ticket100-input" min="0" value="${draft.ticket100 ?? 0}"></label>
                <label><span>200円模擬券：</span><input type="number" class="ticket200-input" min="0" value="${draft.ticket200 ?? 0}"></label>
            </div>
        </div>

        <div class="order-sum-area">
            <p class="order-body-subtitle">
                合計
            </p>
            <div class="order-sum">￥${calcSum(draft.items)}</div>
        </div>
    `;

    const itemListEditEle = orderBody.querySelector(".order-item-list-edit");
    const sumEle = orderBody.querySelector(".order-sum");

    function refreshSum() {
        sumEle.textContent = `￥${calcSum(draft.items)}`;
    }

    function renderItemRows() {
        itemListEditEle.innerHTML = "";
        draft.items.forEach((item, index) => {
            const rowEle = document.createElement("div");
            rowEle.setAttribute("class", "order-item-edit-row");
            rowEle.innerHTML = `
            <div class="order-item-select-and-num">
                <select class="order-item-name-select">
                    ${buildItemOptions(item.id)}
                </select>
                <div class="order-item-num-edit-area">
                    <span>数量：</span>
                    <input type="text"  inputmode="numeric" class="order-item-num-input" min="1" value="${item.num}">
                </div>
            </div>
                <button type="button" class="delete-item-row-btn">
                    <span class="m3-icon">delete</span>
                </button>
            
            `;

            const nameSelectEle = rowEle.querySelector(".order-item-name-select");
            nameSelectEle.addEventListener("change", function () {
                const master = getItemMaster(this.value);
                draft.items[index].id = master.id;
                draft.items[index].name = master.name;
                draft.items[index].price = master.price ?? draft.items[index].price;
                refreshSum();
            });

            const numInputEle = rowEle.querySelector(".order-item-num-input");
            numInputEle.addEventListener("input", function () {
                const num = Number(this.value);
                draft.items[index].num = num > 0 ? num : 1;
                refreshSum();
            });

            const deleteRowBtnEle = rowEle.querySelector(".delete-item-row-btn");
            deleteRowBtnEle.addEventListener("click", function () {
                draft.items.splice(index, 1);
                renderItemRows();
                refreshSum();
            });

            itemListEditEle.appendChild(rowEle);
        })
    }
    renderItemRows();

    const addItemBtnEle = orderBody.querySelector(".add-item-btn");
    addItemBtnEle.addEventListener("click", function () {
        const firstItem = itemAry[0];
        if (!firstItem) return;
        draft.items.push({
            id: firstItem.id,
            name: firstItem.name,
            price: firstItem.price ?? 0,
            num: 1
        });
        renderItemRows();
        refreshSum();
    });

    const howSelectEle = orderBody.querySelector(".order-how-select");
    const ticketEditEle = orderBody.querySelector(".order-ticket-edit");
    const ticket100InputEle = orderBody.querySelector(".ticket100-input");
    const ticket200InputEle = orderBody.querySelector(".ticket200-input");

    howSelectEle.addEventListener("change", function () {
        draft.how = this.value;
        ticketEditEle.style.display = isTicketHow(draft.how) ? "" : "none";
    });

    ticket100InputEle.addEventListener("input", function () {
        const num = Number(this.value);
        draft.ticket100 = num >= 0 ? num : 0;
    });

    ticket200InputEle.addEventListener("input", function () {
        const num = Number(this.value);
        draft.ticket200 = num >= 0 ? num : 0;
    });

    // order-head-right に確定・キャンセルボタンを追加し、編集・削除ボタンを隠す
    showEditHeadButtons(
        orderEle,
        async function onConfirm() {
            const target = orderAry.find((o) => o.id === draft.id);
            if (!target) return;

            const total = calcSum(draft.items);
            const itemsPayload = draft.items.map((item) => {
                const master = getItemMaster(item.id);
                return {
                    store_product_no: master ? master.store_product_no : item.id,
                    quantity: item.num
                };
            });
            const paymentMethod = buildPaymentMethod(draft.how, draft.ticket100, draft.ticket200, total);

            try {
                const updated = await updateOrder(target.id, {
                    items: itemsPayload,
                    total: total,
                    payment_method: paymentMethod
                });
                // サーバー側の最新状態で内部データを更新
                applyApiOrderToLocal(target, updated);
                showSuccessToast("会計履歴を更新しました。")
            } catch (e) {
                showErrorToast(e.message);
                // 失敗時は編集前の表示に戻す
                renderOrderBodyView(orderEle, target);
                return;
            }
            applyFilters();
        },
        function onCancel() {
            renderOrderBodyView(orderEle, orderAry.find((o) => o.id === draft.id));
        }
    );
}

function createOrderElement(order) {
    const orderEle = document.createElement("div");
    orderEle.setAttribute("class", "order");
    orderEle.innerHTML = `<div class="order-head">
                        <div class="order-head-left">
                            <p class="order-date">${order.date}</p>
                        </div>
                        <div class="order-head-right">
                            <button class="edit-order-btn">
                                <span class="m3-icon">edit</span>
                            </button>
                            <button class="delete-order-btn">
                                <span class="m3-icon">delete</span>
                            </button>
                        </div>
                    </div>
                    <div class="order-body"></div>
                `;

    renderOrderBodyView(orderEle, order);

    //ボタン押下時
    const editBtnEle = orderEle.querySelector(".edit-order-btn");
    editBtnEle.addEventListener("click", function () {
        // 編集中の一時オブジェクト（ディープコピー）
        const draft = {
            id: order.id,
            items: order.items.map((item) => ({ ...item })),
            how: order.how,
            ticket100: order.ticket100 ?? 0,
            ticket200: order.ticket200 ?? 0
        };
        renderOrderBodyEdit(orderEle, draft);
    })

    const deleteBtnEle = orderEle.querySelector(".delete-order-btn");
    deleteBtnEle.addEventListener("click", async function () {
        const ok = confirm("この履歴を消去しますか？");
        if (!ok) return;

        try {
            await deleteOrder(order.id);
            showSuccessToast("会計履歴を削除しました。")
        } catch (e) {
            showErrorToast(e.message);
            return;
        }

        const index = orderAry.findIndex((o) => o.id === order.id);
        if (index !== -1) {
            orderAry.splice(index, 1);
        }
        applyFilters();
    })


    return orderEle;
}

// ==== 検索フィルター ====

let currentTerm = "day"; // "day" | "all"

function getSelectedItemIds() {
    return Array.from($all(".item-search-checks input[type='checkbox']:checked")).map((cb) => Number(cb.value));
}

// "yyyy-MM-dd"(date input) + "HH:mm"(time input) からDateを作る
// endOfDay=trueかつtimeが未入力の場合は23:59として扱う
function parseDateTime(dayStr, timeStr, endOfDay) {
    if (!dayStr) return null;
    const [y, m, d] = dayStr.split("-").map(Number);
    let hh = 0, mm = 0;
    if (timeStr) {
        [hh, mm] = timeStr.split(":").map(Number);
    } else if (endOfDay) {
        hh = 23; mm = 59;
    }
    return new Date(y, m - 1, d, hh, mm, 0);
}

function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}

function getFilteredOrders() {
    const valueRaw = $("#value").value;
    const value = valueRaw === "" ? null : Number(valueRaw);
    const howValue = $("#how").value;
    const startDate = parseDateTime($("#startday").value, $("#starttime").value, false);
    const endDate = parseDateTime($("#endday").value, $("#endtime").value, true);
    const selectedItemIds = getSelectedItemIds();
    const today = new Date();

    return orderAry.filter((order) => {
        if (currentTerm === "day" && !isSameDay(order.dateObj, today)) return false;

        if (value !== null && (order.total ?? calcSum(order.items)) !== value) return false;

        if (howValue !== "none" && order.how !== howValueMap[howValue]) return false;

        if (startDate && order.dateObj < startDate) return false;
        if (endDate && order.dateObj > endDate) return false;

        if (selectedItemIds.length > 0) {
            const hasSelected = order.items.some((item) => selectedItemIds.includes(item.id));
            if (!hasSelected) return false;
        }

        return true;
    });
}

// 現在の検索条件・期間切り替えに従って会計履歴一覧を再描画する
function applyFilters() {
    const filtered = getFilteredOrders();
    orderList.innerHTML = "";
    if (filtered.length === 0) {
        orderList.innerHTML = "<p class='no-result-msg'>該当する会計履歴がありません</p>";
        return;
    }
    filtered.forEach((order, index) => {
        const orderEle = createOrderElement(order);
        orderEle.classList.add('m3-enter');
        orderEle.style.animationDelay = `${Math.min(index, 12) * 40}ms`;
        orderList.appendChild(orderEle);
    })
}

function initSearchFilters() {
    const valueEle = $("#value");
    const howEle = $("#how");
    const startDayEle = $("#startday");
    const startTimeEle = $("#starttime");
    const endDayEle = $("#endday");
    const endTimeEle = $("#endtime");
    const clearBtnEle = $(".search-clear-btn");

    [valueEle, howEle, startDayEle, startTimeEle, endDayEle, endTimeEle].forEach((ele) => {
        ele.addEventListener("input", applyFilters);
        ele.addEventListener("change", applyFilters);
    });

    // 商品絞り込みチェックボックスは動的生成のためイベント委任で拾う
    itemSearchChecks.addEventListener("change", function (e) {
        if (e.target.matches("input[type='checkbox']")) {
            applyFilters();
        }
    });

    clearBtnEle.addEventListener("click", function () {
        valueEle.value = "";
        howEle.value = "none";
        startDayEle.value = "";
        startTimeEle.value = "";
        endDayEle.value = "";
        endTimeEle.value = "";
        $all(".item-search-checks input[type='checkbox']").forEach((cb) => { cb.checked = false; });
        applyFilters();
    });
}

//日別と全期間切り替え
const termBtnDay = $("button[data-term='day']")
const termBtnAll = $("button[data-term='all']")

// 全期間のときだけ使う「開始日・終了日」欄の表示/非表示を切り替える
// 日別に切り替えたときは値もクリアしておく（隠れた状態のまま値が残らないように）
function updateDateRangeVisibility() {
    const allTermOnlyEles = $all(".all-term-only");
    if (currentTerm === "day") {
        allTermOnlyEles.forEach((ele) => { ele.style.display = "none"; });
        $("#startday").value = "";
        $("#endday").value = "";
    } else {
        allTermOnlyEles.forEach((ele) => { ele.style.display = ""; });
    }
}

function switchTerm() {
    function initTermUI() {
        termBtnDay.classList.remove("isSelected");
        termBtnAll.classList.remove("isSelected");
    }
    termBtnDay.addEventListener("click", function () {
        initTermUI();
        this.classList.add("isSelected");
        currentTerm = "day";
        updateDateRangeVisibility();
        applyFilters();
    })
    termBtnAll.addEventListener("click", function () {
        initTermUI();
        this.classList.add("isSelected")
        currentTerm = "all";
        updateDateRangeVisibility();
        applyFilters();
    })
}

// ==== 初期化 ====

async function init() {
    switchTerm();
    initSearchFilters();
    updateDateRangeVisibility();

    orderList.innerHTML = "<p class='loading-msg'>読み込み中...</p>";
    try {
        const products = await getProducts();
        itemAry = products;
        renderItemChecks();

        const orders = await getOrders();
        orderAry = orders.map(mapApiOrderToLocal);
    } catch (e) {
        orderList.innerHTML = `<p class="error-msg">${e.message}</p>`;
        return;
    }

    applyFilters();
}
init();