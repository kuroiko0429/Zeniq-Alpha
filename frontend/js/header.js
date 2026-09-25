import { requireAuth, getStoreName, getIsAdmin, logoutWithConfirm } from './auth.js';

// 未ログインならログイン画面へ強制的に戻す
requireAuth();

const body = document.querySelector("body");
const headerEle = document.createElement('header');
headerEle.setAttribute("id", "header");
headerEle.innerHTML = `
            <div class="header-container header-content">
                <nav class="header-nav">
                    <ul>
                        <li><a href="index.html">POSレジ</a></li>
                        <li><a href="items.html">商品管理</a></li>
                        <li><a href="orders.html">会計履歴</a></li>
                        <li><a href="sales.html">売上分析</a></li>
                        ${getIsAdmin() ? '<li><a href="admin.html">管理画面</a></li>' : ''}
                    </ul>
                </nav>

                <div class="header-right">
                    <div class="header-store-name">
                        ${getStoreName() ?? ''}
                    </div>
                    <button class="header-logout" id="header-logout-btn">
                        ログアウト
                    </button>
                </div>
            </div>
            `;


const url = location.pathname;
let filename = url.split('/').pop();
if (filename === "") {
    filename = "index.html"
}
const a = headerEle.querySelectorAll('.header-nav a');
a.forEach((ele) => {
    const href = ele.getAttribute("href");
    if (href === filename) {
        ele.classList.add("header-current-page");
        ele.removeAttribute("href");
    }
})
body.prepend(headerEle);

// ログアウトボタンのクリックイベントを紐付け
document.getElementById('header-logout-btn').addEventListener('click', () => {
    logoutWithConfirm();
});