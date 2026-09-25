import { requireAuth, getStoreName, getIsAdmin, logoutWithConfirm } from './auth.js';

// 未ログインならログイン画面へ強制的に戻す
requireAuth();

const body = document.querySelector("body");
const headerEle = document.createElement('header');
headerEle.setAttribute("id", "header");
headerEle.innerHTML = `
            <div class="header-container header-content">
                <div class="header-brand">
                    <span class="m3-icon header-brand-icon">storefront</span>
                    <span class="header-brand-text">Zeniq</span>
                </div>

                <nav class="header-nav">
                    <ul>
                        <li><a href="index.html"><span class="m3-icon">point_of_sale</span><span>POSレジ</span></a></li>
                        <li><a href="items.html"><span class="m3-icon">inventory_2</span><span>商品管理</span></a></li>
                        <li><a href="orders.html"><span class="m3-icon">receipt_long</span><span>会計履歴</span></a></li>
                        <li><a href="sales.html"><span class="m3-icon">monitoring</span><span>売上分析</span></a></li>
                        ${getIsAdmin() ? '<li><a href="admin.html"><span class="m3-icon">admin_panel_settings</span><span>管理画面</span></a></li>' : ''}
                    </ul>
                </nav>

                <div class="header-right">
                    <div class="header-store-name">
                        <span class="m3-icon m3-icon-fill">storefront</span>
                        ${getStoreName() ?? ''}
                    </div>
                    <button class="header-logout" id="header-logout-btn">
                        <span class="m3-icon">logout</span>
                        <span>ログアウト</span>
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