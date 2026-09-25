// pos-calc.js
//
// POSレジ画面（pos.js）の会計金額計算・お釣り計算・模擬券不足判定・
// 支払方法（payment_method）組み立てロジックを、DOM操作から切り離した
// 純粋関数として切り出したモジュール。
//
// pos.js からはこのモジュールの関数を呼び出すだけにし、金額計算の
// ロジック自体はここに集約する。DOM/fetchに依存しないため、
// pos-calc.test.js で（ブラウザ起動なしに）単体テストできる。

/**
 * カート内商品の合計金額を計算する。
 * @param {{price: number, num: number}[]} cartItem
 * @returns {number}
 */
export function calcCartTotal(cartItem) {
    return cartItem.reduce((sum, item) => sum + item.price * item.num, 0);
}

/**
 * 現金支払い（メインの預り金）でのお釣りを計算する。
 * 負の値は預り金不足を意味する。
 * @param {number} depositMain
 * @param {number} totalPrice
 * @returns {number}
 */
export function calcMainChange(depositMain, totalPrice) {
    return (depositMain || 0) - (totalPrice || 0);
}

/**
 * 模擬券だけで合計金額をまかなった場合の残額（合計 − 模擬券換算額）を計算する。
 * 正の値は模擬券だけでは不足していることを意味する。
 * @param {number} totalPrice
 * @param {number} ticketTotalPrice
 * @returns {number}
 */
export function calcTicketRemaining(totalPrice, ticketTotalPrice) {
    return (totalPrice || 0) - (ticketTotalPrice || 0);
}

/**
 * 模擬券不足分を現金で追加支払いする場合のお釣りを計算する。
 * 負の値は追加の預り金がまだ不足していることを意味する。
 * @param {number} depositAdditional 追加支払いとして入力された現金
 * @param {number} remaining calcTicketRemaining() の結果
 * @returns {number}
 */
export function calcTicketCashChange(depositAdditional, remaining) {
    return (depositAdditional || 0) - (remaining > 0 ? remaining : 0);
}

/**
 * 模擬券の過不足（模擬券換算額 − 合計金額）を計算する。
 * 正の値は模擬券が余っている（＝模擬券だけで足りる）ことを、
 * 負の値は不足していることを意味する。
 * @param {number} ticketTotalPrice
 * @param {number} totalPrice
 * @returns {number}
 */
export function calcTicketShortage(ticketTotalPrice, totalPrice) {
    return (ticketTotalPrice || 0) - (totalPrice || 0);
}

/**
 * 「模擬券不足額」表示欄に出す値を計算する。
 * 模擬券だけで足りている場合、または追加支払いがQR決済の場合は 0。
 * 追加支払いが現金の場合は、その現金でどこまで不足を埋められたかを返す
 * （0以下。0未満ならまだ不足がある）。
 * それ以外（追加支払い未選択）は素の不足額（0以下）をそのまま返す。
 *
 * @param {object} params
 * @param {number} params.ticketTotalPrice
 * @param {number} params.totalPrice
 * @param {'cash'|'qr'|null} params.addPayHowSelected
 * @param {number} params.depositAdditional
 * @returns {number}
 */
export function calcTicketShortageDisplay({ ticketTotalPrice, totalPrice, addPayHowSelected, depositAdditional }) {
    const baseShortage = calcTicketShortage(ticketTotalPrice, totalPrice);
    if (baseShortage >= 0) return 0;
    if (addPayHowSelected === 'qr') return 0;
    if (addPayHowSelected === 'cash') {
        const remaining = baseShortage + (depositAdditional || 0);
        return Math.min(remaining, 0);
    }
    return baseShortage;
}

/**
 * 現在の入力状態から「会計するボタン」を有効化してよいかを判定する。
 *
 * - 現金: お釣りが0以上（預り金が足りている）
 * - 模擬券: 模擬券だけで足りているか、追加支払い（現金/QR）で不足を埋められている
 * - QR決済: 常に可
 *
 * @param {object} params
 * @param {{price: number, num: number}[]} params.cartItem
 * @param {'cash'|'ticket'|'qr'|null} params.currentPayHow
 * @param {number} params.depositMain
 * @param {number} params.totalPrice
 * @param {number} params.ticketTotalPrice
 * @param {'cash'|'qr'|null} params.addPayHowSelected
 * @param {number} params.depositAdditional
 * @returns {boolean}
 */
export function isExecutePayAvailable({
    cartItem,
    currentPayHow,
    depositMain,
    totalPrice,
    ticketTotalPrice,
    addPayHowSelected,
    depositAdditional
}) {
    if (!cartItem || cartItem.length === 0) return false;

    if (currentPayHow === 'cash') {
        return calcMainChange(depositMain, totalPrice) >= 0;
    }

    if (currentPayHow === 'ticket') {
        const shortage = calcTicketShortage(ticketTotalPrice, totalPrice);
        if (shortage >= 0) return true;

        if (addPayHowSelected === 'cash') {
            const remaining = calcTicketRemaining(totalPrice, ticketTotalPrice);
            return calcTicketCashChange(depositAdditional, remaining) >= 0;
        }
        if (addPayHowSelected === 'qr') return true;
        return false;
    }

    if (currentPayHow === 'qr') return true;

    return false;
}

/**
 * 注文作成API（POST /api/orders）に渡す payment_method オブジェクトを組み立てる。
 * @param {object} params
 * @param {'cash'|'ticket'|'qr'|null} params.currentPayHow
 * @param {number} params.depositMain
 * @param {number} params.ticket100
 * @param {number} params.ticket200
 * @param {'cash'|'qr'|null} params.addPayHowSelected
 * @param {number} params.depositAdditional
 * @param {number} params.totalPrice
 * @param {number} params.ticketTotalPrice
 * @returns {{cash: number, ticket_100: number, ticket_200: number, emoney: number}}
 */
export function buildPaymentMethod({
    currentPayHow,
    depositMain,
    ticket100,
    ticket200,
    addPayHowSelected,
    depositAdditional,
    totalPrice,
    ticketTotalPrice
}) {
    if (currentPayHow === 'cash') {
        return { cash: depositMain, ticket_100: 0, ticket_200: 0, emoney: 0 };
    }

    if (currentPayHow === 'ticket') {
        const remaining = calcTicketRemaining(totalPrice, ticketTotalPrice);
        const shortagePay = remaining > 0 ? remaining : 0;
        return {
            cash: addPayHowSelected === 'cash' ? depositAdditional : 0,
            ticket_100: ticket100,
            ticket_200: ticket200,
            emoney: addPayHowSelected === 'qr' ? shortagePay : 0
        };
    }

    if (currentPayHow === 'qr') {
        return { cash: 0, ticket_100: 0, ticket_200: 0, emoney: totalPrice };
    }

    return { cash: 0, ticket_100: 0, ticket_200: 0, emoney: 0 };
}
