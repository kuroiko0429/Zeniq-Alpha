import { describe, test, expect } from "bun:test";
import {
    calcCartTotal,
    calcMainChange,
    calcTicketRemaining,
    calcTicketCashChange,
    calcTicketShortage,
    calcTicketShortageDisplay,
    isExecutePayAvailable,
    buildPaymentMethod
} from "./pos-calc.js";

describe("calcCartTotal", () => {
    test("空のカートは0", () => {
        expect(calcCartTotal([])).toBe(0);
    });

    test("複数商品・複数個数の合計を計算する", () => {
        const cart = [
            { price: 500, num: 2 },
            { price: 300, num: 1 }
        ];
        expect(calcCartTotal(cart)).toBe(1300);
    });
});

describe("calcMainChange", () => {
    test("預り金がちょうどならお釣りは0", () => {
        expect(calcMainChange(1000, 1000)).toBe(0);
    });

    test("預り金が多ければお釣りは正", () => {
        expect(calcMainChange(1500, 1000)).toBe(500);
    });

    test("預り金が不足していれば負の値（不足額）になる", () => {
        expect(calcMainChange(800, 1000)).toBe(-200);
    });
});

describe("calcTicketShortage / calcTicketRemaining", () => {
    test("模擬券だけで足りている場合、shortageは0以上", () => {
        expect(calcTicketShortage(1200, 1000)).toBe(200);
    });

    test("模擬券が不足している場合、shortageは負", () => {
        expect(calcTicketShortage(600, 1000)).toBe(-400);
    });

    test("remainingはtotalからticket分を引いた値（不足時は正）", () => {
        expect(calcTicketRemaining(1000, 600)).toBe(400);
    });
});

describe("calcTicketCashChange", () => {
    test("追加現金が不足分ちょうどならお釣りは0", () => {
        expect(calcTicketCashChange(400, 400)).toBe(0);
    });

    test("remainingが0以下（模擬券だけで足りている）ならremainingを0扱いする", () => {
        // remaining=-200（模擬券が200円余っている）でも、追加現金はそのまま加点される
        expect(calcTicketCashChange(100, -200)).toBe(100);
    });

    test("追加現金が不足分より少なければ負の値", () => {
        expect(calcTicketCashChange(100, 400)).toBe(-300);
    });
});

describe("calcTicketShortageDisplay", () => {
    test("模擬券だけで足りていれば0", () => {
        const result = calcTicketShortageDisplay({
            ticketTotalPrice: 1200, totalPrice: 1000, addPayHowSelected: null, depositAdditional: 0
        });
        expect(result).toBe(0);
    });

    test("不足していてもQR追加選択時は0", () => {
        const result = calcTicketShortageDisplay({
            ticketTotalPrice: 600, totalPrice: 1000, addPayHowSelected: 'qr', depositAdditional: 0
        });
        expect(result).toBe(0);
    });

    test("不足＋現金追加で不足分ちょうど払えば0", () => {
        const result = calcTicketShortageDisplay({
            ticketTotalPrice: 600, totalPrice: 1000, addPayHowSelected: 'cash', depositAdditional: 400
        });
        expect(result).toBe(0);
    });

    test("不足＋現金追加だが払いきれていなければ残不足（負の値）", () => {
        const result = calcTicketShortageDisplay({
            ticketTotalPrice: 600, totalPrice: 1000, addPayHowSelected: 'cash', depositAdditional: 100
        });
        expect(result).toBe(-300);
    });

    test("不足＋現金追加で払いすぎても0でクランプされる（マイナスのお釣りは出さない）", () => {
        const result = calcTicketShortageDisplay({
            ticketTotalPrice: 600, totalPrice: 1000, addPayHowSelected: 'cash', depositAdditional: 1000
        });
        expect(result).toBe(0);
    });

    test("追加支払い未選択なら素の不足額をそのまま返す", () => {
        const result = calcTicketShortageDisplay({
            ticketTotalPrice: 600, totalPrice: 1000, addPayHowSelected: null, depositAdditional: 0
        });
        expect(result).toBe(-400);
    });
});

describe("isExecutePayAvailable", () => {
    const cart = [{ price: 1000, num: 1 }];

    test("カートが空なら常に不可", () => {
        expect(isExecutePayAvailable({
            cartItem: [], currentPayHow: 'qr', depositMain: 0, totalPrice: 0,
            ticketTotalPrice: 0, addPayHowSelected: null, depositAdditional: 0
        })).toBe(false);
    });

    test("現金選択でお釣りが0以上なら可", () => {
        expect(isExecutePayAvailable({
            cartItem: cart, currentPayHow: 'cash', depositMain: 1000, totalPrice: 1000,
            ticketTotalPrice: 0, addPayHowSelected: null, depositAdditional: 0
        })).toBe(true);
    });

    test("現金選択で預り金不足なら不可", () => {
        expect(isExecutePayAvailable({
            cartItem: cart, currentPayHow: 'cash', depositMain: 500, totalPrice: 1000,
            ticketTotalPrice: 0, addPayHowSelected: null, depositAdditional: 0
        })).toBe(false);
    });

    test("模擬券だけで足りていれば可", () => {
        expect(isExecutePayAvailable({
            cartItem: cart, currentPayHow: 'ticket', depositMain: 0, totalPrice: 1000,
            ticketTotalPrice: 1000, addPayHowSelected: null, depositAdditional: 0
        })).toBe(true);
    });

    test("模擬券不足・追加支払い未選択なら不可", () => {
        expect(isExecutePayAvailable({
            cartItem: cart, currentPayHow: 'ticket', depositMain: 0, totalPrice: 1000,
            ticketTotalPrice: 600, addPayHowSelected: null, depositAdditional: 0
        })).toBe(false);
    });

    test("模擬券不足・現金追加で不足分を満たせば可", () => {
        expect(isExecutePayAvailable({
            cartItem: cart, currentPayHow: 'ticket', depositMain: 0, totalPrice: 1000,
            ticketTotalPrice: 600, addPayHowSelected: 'cash', depositAdditional: 400
        })).toBe(true);
    });

    test("模擬券不足・現金追加が足りていなければ不可", () => {
        expect(isExecutePayAvailable({
            cartItem: cart, currentPayHow: 'ticket', depositMain: 0, totalPrice: 1000,
            ticketTotalPrice: 600, addPayHowSelected: 'cash', depositAdditional: 100
        })).toBe(false);
    });

    test("模擬券不足・QR追加なら可", () => {
        expect(isExecutePayAvailable({
            cartItem: cart, currentPayHow: 'ticket', depositMain: 0, totalPrice: 1000,
            ticketTotalPrice: 600, addPayHowSelected: 'qr', depositAdditional: 0
        })).toBe(true);
    });

    test("QR決済は常に可", () => {
        expect(isExecutePayAvailable({
            cartItem: cart, currentPayHow: 'qr', depositMain: 0, totalPrice: 1000,
            ticketTotalPrice: 0, addPayHowSelected: null, depositAdditional: 0
        })).toBe(true);
    });

    test("支払方法未選択なら不可", () => {
        expect(isExecutePayAvailable({
            cartItem: cart, currentPayHow: null, depositMain: 1000, totalPrice: 1000,
            ticketTotalPrice: 0, addPayHowSelected: null, depositAdditional: 0
        })).toBe(false);
    });
});

describe("buildPaymentMethod", () => {
    test("現金選択時はcashのみセットする", () => {
        const pm = buildPaymentMethod({
            currentPayHow: 'cash', depositMain: 1000, ticket100: 0, ticket200: 0,
            addPayHowSelected: null, depositAdditional: 0, totalPrice: 1000, ticketTotalPrice: 0
        });
        expect(pm).toEqual({ cash: 1000, ticket_100: 0, ticket_200: 0, emoney: 0 });
    });

    test("模擬券だけで足りる場合はemoneyもcashも0", () => {
        const pm = buildPaymentMethod({
            currentPayHow: 'ticket', depositMain: 0, ticket100: 10, ticket200: 0,
            addPayHowSelected: null, depositAdditional: 0, totalPrice: 1000, ticketTotalPrice: 1000
        });
        expect(pm).toEqual({ cash: 0, ticket_100: 10, ticket_200: 0, emoney: 0 });
    });

    test("模擬券不足＋現金追加ならcashに追加支払額を入れる", () => {
        const pm = buildPaymentMethod({
            currentPayHow: 'ticket', depositMain: 0, ticket100: 6, ticket200: 0,
            addPayHowSelected: 'cash', depositAdditional: 400, totalPrice: 1000, ticketTotalPrice: 600
        });
        expect(pm).toEqual({ cash: 400, ticket_100: 6, ticket_200: 0, emoney: 0 });
    });

    test("模擬券不足＋QR追加ならemoneyに不足分（shortagePay）を入れる", () => {
        const pm = buildPaymentMethod({
            currentPayHow: 'ticket', depositMain: 0, ticket100: 6, ticket200: 0,
            addPayHowSelected: 'qr', depositAdditional: 0, totalPrice: 1000, ticketTotalPrice: 600
        });
        expect(pm).toEqual({ cash: 0, ticket_100: 6, ticket_200: 0, emoney: 400 });
    });

    test("QR決済選択時はemoneyに合計金額を入れる", () => {
        const pm = buildPaymentMethod({
            currentPayHow: 'qr', depositMain: 0, ticket100: 0, ticket200: 0,
            addPayHowSelected: null, depositAdditional: 0, totalPrice: 1000, ticketTotalPrice: 0
        });
        expect(pm).toEqual({ cash: 0, ticket_100: 0, ticket_200: 0, emoney: 1000 });
    });

    test("支払方法未選択なら全て0", () => {
        const pm = buildPaymentMethod({
            currentPayHow: null, depositMain: 0, ticket100: 0, ticket200: 0,
            addPayHowSelected: null, depositAdditional: 0, totalPrice: 1000, ticketTotalPrice: 0
        });
        expect(pm).toEqual({ cash: 0, ticket_100: 0, ticket_200: 0, emoney: 0 });
    });
});
