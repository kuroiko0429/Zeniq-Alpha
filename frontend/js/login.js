import { login, register } from './api.js';
import { isLoggedIn } from './auth.js';

// エイリアス
const $ = (selector) => document.querySelector(selector);
const $all = (selector) => document.querySelectorAll(selector);

// すでにログイン済みならログイン画面を飛ばす
if (isLoggedIn()) {
    location.href = 'index.html';
}

// const switchLogin = $('#switch-login');
// const switchRegister = $('#switch-register');
const forLogin = $all('.for-login');
// const forRegister = $all('.for-register');

function initialize() {
    switchLogin.classList.remove('selected');
    switchRegister.classList.remove('selected');
    forLogin.forEach((ele) => {
        ele.style.display = 'none';
    });
    forRegister.forEach((ele) => {
        ele.style.display = 'none';
    });
}

// // タブ切り替え
// switchLogin.addEventListener('click', function () {
//     initialize();
//     this.classList.add('selected');
//     forLogin.forEach((ele) => {
//         ele.style.display = 'block';
//     });
// });
// switchRegister.addEventListener('click', function () {
//     initialize();
//     this.classList.add('selected');
//     forRegister.forEach((ele) => {
//         ele.style.display = 'block';
//     });
// });

// ログイン処理
const loginForm = $('#login-form');
const loginError = $('#login-error');
const loginSubmit = $('#login-submit');

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginError.hidden = true;

    const username = $('#login-username').value.trim();
    const password = $('#login-password').value;

    loginSubmit.disabled = true;
    try {
        await login(username, password);
        location.href = 'index.html';
    } catch (err) {
        loginError.textContent = err.message || 'ログインに失敗しました';
        loginError.hidden = false;
    } finally {
        loginSubmit.disabled = false;
    }
});

// 新規登録処理
// 注意: バックエンド仕様上、現時点では運営本部アカウントでログインしていないと
// 新規登録できない（誰でも自由に登録できるわけではない）。
// const registerForm = $('#register-form');
// const registerError = $('#register-error');
// const registerSubmit = $('#register-submit');

// registerForm.addEventListener('submit', async (event) => {
//     event.preventDefault();
//     registerError.hidden = true;

//     const name = $('#register-name').value.trim();
//     const username = $('#register-username').value.trim();
//     const password = $('#register-password').value;

//     registerSubmit.disabled = true;
//     try {
//         await register(name, username, password);
//         alert('店舗を登録しました。作成したユーザー名でログインしてください。');
//         switchLogin.click();
//         registerForm.reset();
//     } catch (err) {
//         registerError.textContent = err.message || '新規登録に失敗しました';
//         registerError.hidden = false;
//     } finally {
//         registerSubmit.disabled = false;
//     }
// });
