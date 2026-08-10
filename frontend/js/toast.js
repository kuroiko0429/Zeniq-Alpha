/**
 * toast.js
 * 使い方:
 *   <script src="js/toast.js"></script>
 *   showSuccessToast('会計成功しました');
 *   showErrorToast('会計に失敗しました');
 *
 * CSSファイルの読み込みは不要です。このファイル単体で完結します。
 */
(function () {
  const STYLE_ID = 'toast-style';
  const CONTAINER_ID = 'toast-container';

  // ---- CSSをJSから注入 ----
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return; // 二重挿入防止

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CONTAINER_ID} {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform:translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.toast {
  font-size: 1rem;
  font-weight: 500;
  padding: 14px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  opacity: 0;
  transform: translateY(calc(100% + 10px));
  transition: opacity 0.25s ease, transform 0.25s ease;
  pointer-events: auto;
  max-width: 320px;
  word-break: break-word;
}

.toast.toast-show {
  opacity: 1;
  transform: translateY(0px);
}

.toast-success {
  color: #1DB756;
  background-color: #EBFFF3;
  border: 1px solid #1DB756;
}

.toast-error {
  color: #DF6161;
  background-color: #FFF2F2;
  border: 1px solid #DF6161;
}
`;
    document.head.appendChild(style);
  }

  // ---- トースト表示用のコンテナを取得 or 作成 ----
  function getContainer() {
    let container = document.getElementById(CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = CONTAINER_ID;
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * トーストを表示する共通関数
   * @param {string} message - 表示する文章
   * @param {'success'|'error'} type - トーストの種類
   * @param {number} duration - 表示時間(ms)
   */
  function showToast(message, type, duration = 2000) {
    injectStyle();
    const container = getContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // 表示アニメーション(次フレームでclass付与してtransitionを効かせる)
    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    // 一定時間後に消す
    setTimeout(() => {
      toast.classList.remove('toast-show');
      toast.addEventListener('transitionend', () => {
        toast.remove();
      }, { once: true });
    }, duration);
  }

  // ---- グローバルに公開 ----
  window.showSuccessToast = function (message, duration) {
    showToast(message, 'success', duration);
  };

  window.showErrorToast = function (message, duration) {
    showToast(message, 'error', duration);
  };
})();