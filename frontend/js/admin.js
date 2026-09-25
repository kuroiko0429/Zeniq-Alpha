import { register } from './api.js';
import { requireAdmin } from './auth.js';

// 管理者（is_admin）でなければトップ画面へ戻す
requireAdmin();

const $ = (selector) => document.querySelector(selector);

const registerForm = $('#register-form');
const registerError = $('#register-error');
const registerSubmit = $('#register-submit');

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    registerError.hidden = true;

    const name = $('#register-name').value.trim();
    const username = $('#register-username').value.trim();
    const password = $('#register-password').value;

    registerSubmit.disabled = true;
    try {
        const store = await register(name, username, password);
        showSuccessToast(`「${store.name}」を登録しました（ユーザー名: ${store.username}）`);
        registerForm.reset();
    } catch (err) {
        const message = err.message || '店舗登録に失敗しました';
        registerError.textContent = message;
        registerError.hidden = false;
        showErrorToast(message);
    } finally {
        registerSubmit.disabled = false;
    }
});
