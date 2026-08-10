import { getProducts, createOrder } from './api.js';


//エイリアス
const $ = (selector) => document.querySelector(selector);
const $all = (selector) => document.querySelectorAll(selector);

// DOM取得
const totalPriceEle = $(".total-price");
const changePriceEle = $(".change-price");
const mainChangeResult = $(".change-result");
const depositMsg = $(".deposit-shortage-msg");

// state
let totalPrice = 0;
let depositMain = 0;
let depositAdditional = 0;
let ticket100 = 0;
let ticket200 = 0;
let ticketTotalPrice = 0;
// payment state
let currentPayHow = null; // 'cash' | 'ticket' | 'qr'
let addPayHowSelected = null; // 'cash' | 'qr' | null

// レジ画面のロジックをここに実装する
// エイリアスと DOM / state はファイル上部で定義済み

// 支払方法ボタン
const payHowBtns = $all('.pay-how-btn-list button');
function initPayHowBtn() { payHowBtns.forEach(b => b.classList.remove('is-selected-btn')); }

// 各支払方法詳細エリア
const payHowDetail = $all('.pay-how-detail > *');
const payHowDetailCash = $('.pay-how-detail-cash');
const payHowDetailTicket = $('.pay-how-detail-ticket');
function initPayHowDetail() { payHowDetail.forEach(ele => ele.style.display = 'none'); }
function onPayHow(ele, how) {
    initPayHowBtn(); initPayHowDetail(); ele.classList.add('is-selected-btn');
    currentPayHow = how;
    if (how === 'cash') payHowDetailCash.style.display = 'block';
    if (how === 'ticket') payHowDetailTicket.style.display = 'block';
    if (how === 'qr') {
        // QR 決済は詳細部が無い可能性がある
    }
    updateExecutePayButtonState();
}
window.onPayHow = onPayHow;

// add-pay-how（模擬券側の追加支払）
const addPayHowBtns = $all('.add-pay-how-btn-list button');
function initAddPayHowBtns() { addPayHowBtns.forEach(b => b.classList.remove('is-selected-btn')); }
const cashForTicket = $('.cash-for-ticket');
addPayHowBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        initAddPayHowBtns(); btn.classList.add('is-selected-btn');
        addPayHowSelected = btn.dataset.option || null;
        if (cashForTicket) cashForTicket.style.display = 'none';
        if (btn.dataset.option === 'cash' && cashForTicket) cashForTicket.style.display = 'block';
        // cash 選択時は remaining (totalPrice - ticketTotalPrice) を扱う
        if (btn.dataset.option === 'cash') {
            const remaining = (totalPrice || 0) - (ticketTotalPrice || 0);
            const need = remaining > 0 ? remaining : 0;
            depositAdditional = need;
            const addInput = cashForTicket ? cashForTicket.querySelector('.for-ticket-deposit-input-area input') : null;
            if (addInput) addInput.value = depositAdditional;
            renderChange();
        }
        // update execute button when add-pay selection changes
        renderTicketShortagePrice();
        updateExecutePayButtonState();
    });
});

// 入力系の下限処理
function clampNumberInputToZero(input) {
    if (!input) return; input.setAttribute('min', '0');
    input.addEventListener('input', function () { const v = Number(this.value); if (isNaN(v) || v < 0) this.value = 0; });
    input.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { const v = Number(this.value) || 0; if (v <= 0) e.preventDefault(); } });
}
document.querySelectorAll('input[type="number"]').forEach(inp => clampNumberInputToZero(inp));

// 商品レンダリング
const itemList = $('.item-list');
let itemAry = [];

// 商品IDの昇順（小さい順）に並び替えた配列を返す
function sortItemsById(arr) {
    return [...arr].sort((a, b) => a.id - b.id);
}

// itemAry の内容を（ID昇順で）item-list に描画し直す
function renderItemList() {
    if (!itemList) return;
    itemList.replaceChildren();
    sortItemsById(itemAry).forEach(item => {
        const itemEle = document.createElement('div');
        itemEle.innerHTML = `<dt>${item.name}</dt><dd>￥${item.price}</dd><dd class="item-stock">在庫数：${item.stock}</dd>`;
        itemEle.dataset.id = item.id;
        itemEle.addEventListener('click', () => itemToCart(item.id));
        itemList.appendChild(itemEle);
    });
}

// サーバーから商品一覧（在庫を含む）を取得し、itemAry を更新して再描画する
async function loadItems() {
    const itemData = await getProducts();
    itemAry = itemData.map((item) => {
        return {
            id: item.store_product_no,
            name: item.name,
            price: item.price,
            stock: item.stock
        };
    });
    renderItemList();
}

await loadItems();

// カート処理
const cartItem = [];
function itemToCart(id) { const same = cartItem.find(i => i.id == id); if (!same) { const src = itemAry.find(i => i.id === id); cartItem.push({ id, name: src.name, price: src.price, num: 1 }); } else same.num++; renderCartItem(); }
const cartItemArea = $('.cart-item-area'); function initCartItem() { if (cartItemArea) cartItemArea.replaceChildren(); }
function renderCartItem() { initCartItem(); cartItem.forEach(item => { const itemEle = document.createElement('div'); itemEle.classList.add('cart-item'); itemEle.innerHTML = ` <p class="cart-item-name">${item.name}</p> <div class="cart-item-edit"> <button class="cart-item-edit-num" data-edit-type="dec">-</button> <p class="cart-item-num">${item.num}</p> <button class="cart-item-edit-num" data-edit-type="inc">+</button> <button class="cart-item-edit-delete">×</button> </div>`; const incBtn = itemEle.querySelector('[data-edit-type="inc"]'); const decBtn = itemEle.querySelector('[data-edit-type="dec"]'); const delBtn = itemEle.querySelector('.cart-item-edit-delete'); if (incBtn) incBtn.addEventListener('click', () => increaseItem(item.id)); if (decBtn) decBtn.addEventListener('click', () => decreaseItem(item.id)); if (delBtn) delBtn.addEventListener('click', () => deleteItem(item.id)); if (cartItemArea) cartItemArea.appendChild(itemEle); }); renderTotal(); updatePayButtonsState(); }
function decreaseItem(id) { const it = cartItem.find(i => i.id === id); if (!it) return; if (it.num > 1) { it.num--; renderCartItem(); } else deleteItem(id); }
function increaseItem(id) { const it = cartItem.find(i => i.id === id); if (it) { it.num++; renderCartItem(); } }
function deleteItem(id) { const idx = cartItem.findIndex(i => i.id === id); if (idx !== -1) { cartItem.splice(idx, 1); renderCartItem(); } }

function renderTotal() { totalPrice = 0; cartItem.forEach(i => totalPrice += i.price * i.num); if (totalPriceEle) totalPriceEle.textContent = totalPrice; renderChange(); judgeTicketShortage(); }

// deposit inputs
const depositInput = document.querySelector('.pay-how-detail-cash .deposit-input-area input'); if (depositInput) { clampNumberInputToZero(depositInput); depositInput.addEventListener('input', function () { depositMain = Number(this.value) || 0; renderChange(); }); }
const cashForTicketDepositInput = document.querySelector('.cash-for-ticket .for-ticket-deposit-input-area input'); if (cashForTicketDepositInput) { clampNumberInputToZero(cashForTicketDepositInput); cashForTicketDepositInput.addEventListener('input', function () { depositAdditional = Number(this.value) || 0; renderChange(); renderTicketShortagePrice(); }); }

function renderChange() {
    // main の預り金は depositMain のみとする（模擬券用の depositAdditional は別扱い）
    const depositPrice = (depositMain || 0);
    const change = depositPrice - (totalPrice || 0);
    if (change < 0) {
        if (depositMsg) { depositMsg.classList.add('is-displayed'); depositMsg.textContent = '預り金が不足しています'; }
        if (mainChangeResult) mainChangeResult.style.color = 'var(--red)';
    } else {
        if (depositMsg) { depositMsg.classList.remove('is-displayed'); }
        if (mainChangeResult) mainChangeResult.style.color = 'var(--blue)';
    }
    if (changePriceEle) changePriceEle.textContent = change;
    // cash-for-ticket 側更新
    if (cashForTicket) {
        const forTicketChangePrice = cashForTicket.querySelector('.for-ticket-change-price');
        const forTicketChangeResult = cashForTicket.querySelector('.for-ticket-change-result');
        const forTicketShortageMsg = cashForTicket.querySelector('.for-ticket-deposit-shortage-msg');
        // remaining = total - ticketTotal
        const remaining = (totalPrice || 0) - (ticketTotalPrice || 0);
        // display = depositAdditional - remaining (正ならお釣り、負なら不足)
        const forTicketDisplay = (depositAdditional || 0) - (remaining > 0 ? remaining : 0);
        if (forTicketChangePrice) forTicketChangePrice.textContent = forTicketDisplay;
        if (forTicketChangeResult) {
            forTicketChangeResult.textContent = `￥ ${forTicketDisplay}`;
            if (forTicketDisplay < 0) forTicketChangeResult.style.color = 'var(--red)';
            else forTicketChangeResult.style.color = 'var(--blue)';
        }
        if (forTicketShortageMsg) {
            if (forTicketDisplay < 0) { forTicketShortageMsg.textContent = '預り金が不足しています'; forTicketShortageMsg.classList.add('is-displayed'); }
            else { forTicketShortageMsg.textContent = ''; forTicketShortageMsg.classList.remove('is-displayed'); }
        }
    }
    // execute ボタンの状態を更新
    updateExecutePayButtonState();
}

// 模擬券
const ticket100Input = document.querySelector('.ticket100-input'); const ticket200Input = document.querySelector('.ticket200-input'); if (ticket100Input) ticket100Input.addEventListener('input', () => { ticket100 = Number(ticket100Input.value) || 0; updateTicketTotal(ticket100 * 100 + ticket200 * 200); }); if (ticket200Input) ticket200Input.addEventListener('input', () => { ticket200 = Number(ticket200Input.value) || 0; updateTicketTotal(ticket100 * 100 + ticket200 * 200); });

const ticketTotalPriceEle = $('.ticket-total-price');
const ticketShortageAreaEle = $('.ticket-shortage-area');
const cashForTicketOverlay = (() => { const el = document.createElement('div'); el.className = 'ticket-shortage-overlay'; if (cashForTicket) { cashForTicket.style.position = 'relative'; cashForTicket.appendChild(el); } return el; })();
const ticketShortageAreaOverlay = (() => { const el = document.createElement('div'); el.className = 'ticket-shortage-overlay'; if (ticketShortageAreaEle) { ticketShortageAreaEle.style.position = 'relative'; ticketShortageAreaEle.appendChild(el); } return el; })();
const ticketShortagePriceEle = $('.ticket-shortage-price');
function updateTicketTotal(value) { ticketTotalPrice = value; if (ticketTotalPriceEle) ticketTotalPriceEle.textContent = ticketTotalPrice; judgeTicketShortage(); }
function renderTicketShortagePrice() {
    if (!ticketShortagePriceEle) return;
    const baseShortage = (ticketTotalPrice || 0) - (totalPrice || 0); // 負なら不足
    const shortageEl = $('.ticket-shortage');
    let displayValue;

    if (baseShortage >= 0) {
        // 模擬券だけで足りている
        displayValue = 0;
    } else if (addPayHowSelected === 'qr') {
        // QR追加選択時は不足0
        displayValue = 0;
    } else if (addPayHowSelected === 'cash') {
        // 現金追加選択時：残不足 = baseShortage + depositAdditional（0より大きくはしない）
        const remaining = baseShortage + (depositAdditional || 0);
        displayValue = Math.min(remaining, 0);
    } else {
        displayValue = baseShortage;
    }

    ticketShortagePriceEle.textContent = displayValue;
    if (shortageEl) {
        shortageEl.style.color = displayValue < 0 ? 'var(--red)' : 'var(--blue)';
    }
}

function judgeTicketShortage() {
    const shortage = (ticketTotalPrice || 0) - (totalPrice || 0); // 正なら余剰、負なら不足
    if (shortage < 0) {
        // 不足あり：オーバーレイ非表示
        ticketShortageAreaOverlay.style.display = 'none';
        cashForTicketOverlay.style.display = 'none';
    } else {
        // 不足なし：オーバーレイ表示＋追加支払いリセット
        ticketShortageAreaOverlay.style.display = 'block';
        cashForTicketOverlay.style.display = 'block';
        initAddPayHowBtns();
        addPayHowSelected = null;
        if (cashForTicket) cashForTicket.style.display = 'none';
    }
    renderTicketShortagePrice();
    updateExecutePayButtonState();
}

// pay-how ボタン無効化
function updatePayButtonsState() { const disabled = cartItem.length === 0; payHowBtns.forEach(btn => { if (disabled) { btn.setAttribute('disabled', ''); btn.classList.add('is-disabled'); } else { btn.removeAttribute('disabled'); btn.classList.remove('is-disabled'); } }); }

// 会計実行ボタンの有効化ロジック
const executePayBtn = document.querySelector('.execute-pay-btn');
async function onExecute() {
    // createOrder に渡す items（cartItem の id/num を store_product_no/quantity に変換）
    const orderItems = cartItem.map(item => ({
        store_product_no: item.id,
        quantity: item.num
    }));

    // 支払い方法ごとに payment_method オブジェクトを組み立てる
    let paymentMethod;
    if (currentPayHow === 'cash') {
        paymentMethod = { cash: depositMain, ticket_100: 0, ticket_200: 0, emoney: 0 };
    } else if (currentPayHow === 'ticket') {
        const remaining = (totalPrice || 0) - (ticketTotalPrice || 0);
        const shortagePay = remaining > 0 ? remaining : 0;
        paymentMethod = {
            cash: addPayHowSelected === 'cash' ? depositAdditional : 0,
            ticket_100: ticket100,
            ticket_200: ticket200,
            emoney: addPayHowSelected === 'qr' ? shortagePay : 0
        };
    } else if (currentPayHow === 'qr') {
        paymentMethod = { cash: 0, ticket_100: 0, ticket_200: 0, emoney: totalPrice };
    } else {
        paymentMethod = { cash: 0, ticket_100: 0, ticket_200: 0, emoney: 0 };
    }

    // ボタン連打防止（通信中は無効化）
    if (executePayBtn) {
        executePayBtn.classList.remove('is-available');
        executePayBtn.onclick = null;
    }

    try {
        const result = await createOrder(orderItems, totalPrice, [paymentMethod]);
        console.log('注文成功:', result);

        // --- ここから画面リセット処理 ---
        cartItem.length = 0;           // カートを空に
        depositMain = 0;
        depositAdditional = 0;
        ticket100 = 0;
        ticket200 = 0;
        ticketTotalPrice = 0;
        currentPayHow = null;
        addPayHowSelected = null;

        if (ticket100Input) ticket100Input.value = 0;
        if (ticket200Input) ticket200Input.value = 0;
        if (depositInput) depositInput.value = '';
        if (cashForTicketDepositInput) cashForTicketDepositInput.value = '';

        initPayHowBtn();      // 支払方法ボタンの選択状態を解除
        initPayHowDetail();   // 支払方法詳細エリアを非表示
        initAddPayHowBtns();  // 模擬券追加支払ボタンの選択状態を解除
        if (cashForTicket) cashForTicket.style.display = 'none';

        renderCartItem();     // カート表示・合計・お釣り・ボタン状態などを再計算して更新

        // 会計完了後の最新在庫数を反映
        try {
            await loadItems();
        } catch (reloadErr) {
            console.error('在庫数の再取得に失敗しました:', reloadErr);
        }

        showSuccessToast('会計が完了しました');
    } catch (err) {
        console.error('注文失敗:', err);
        showErrorToast(err.message || '注文に失敗しました');
        // 失敗時はボタンを再度有効化できるよう状態を再評価
        updateExecutePayButtonState();
    }
}

function updateExecutePayButtonState() {
    if (!executePayBtn) return;
    // デフォルト無効
    executePayBtn.classList.remove('is-available');
    executePayBtn.onclick = null;

    // カートが空なら無条件で無効
    if (cartItem.length === 0) return;

    // 条件判定に必要な値を計算
    const mainChange = ((depositMain || 0) - (totalPrice || 0));
    const shortage = (ticketTotalPrice || 0) - (totalPrice || 0); // 正なら模擬券が余分、負なら不足
    // remaining = total - ticketTotalPrice
    const remaining = (totalPrice || 0) - (ticketTotalPrice || 0);
    // forTicketDisplay は模擬券追加の預り金表示（depositAdditional - remaining）
    const forTicketDisplay = (depositAdditional || 0) - (remaining > 0 ? remaining : 0);

    let available = false;

    if (currentPayHow === 'cash') {
        // 現金選択でお釣りが0以上
        if (mainChange >= 0) available = true;
    } else if (currentPayHow === 'ticket') {
        // 模擬券選択
        // 模擬券の不足額が無い（shortage >= 0） -> 会計可能
        if (shortage >= 0) available = true;
        else {
            // 不足がある場合、追加支払が現金でその現金側でお釣りが0以上
            if (addPayHowSelected === 'cash') {
                if (forTicketDisplay >= 0) available = true; // 模擬券側でお釣りが0以上
            }
            // あるいは追加支払が QR の場合は可
            if (addPayHowSelected === 'qr') available = true;
        }
    } else if (currentPayHow === 'qr') {
        // QR 決済は常に可
        available = true;
    }

    if (available) {
        executePayBtn.classList.add('is-available');
        executePayBtn.onclick = onExecute;
    } else {
        executePayBtn.classList.remove('is-available');
        executePayBtn.onclick = null;
    }
}

// 初期
updatePayButtonsState(); renderTotal();

// デバッグ露出
window._testState = () => ({ totalPrice, depositMain, depositAdditional, ticketTotalPrice, cartItem });
// ファイル読み込み時の初期化は上で行っています。

const data=await getProducts()
console.log(data);

