/**
 * ripple.js
 * Material 3 の「リップル」クリックフィードバックを、素のJSで実装する。
 * イベント委譲（documentへの1つのリスナー）で実装しているため、
 * pos.js / items.js / orders.js 等が動的に生成するボタンやカードにも
 * 追加の初期化なしで自動的に効く。
 *
 * 使い方: <script src="js/ripple.js"></script> をどのページにも読み込むだけ。
 * 対象セレクタは RIPPLE_SELECTOR を参照。
 */
(function () {
    const RIPPLE_SELECTOR = [
        'button:not(:disabled)',
        '.item-list > div',
        '.header-nav a:not(.header-current-page)'
    ].join(', ');

    document.addEventListener('click', (event) => {
        const target = event.target.closest(RIPPLE_SELECTOR);
        if (!target) return;

        // クリック位置を計算するため、対象要素の位置決めコンテキストを整える
        const computed = getComputedStyle(target);
        if (computed.position === 'static') {
            target.style.position = 'relative';
        }
        if (computed.overflow === 'visible') {
            target.style.overflow = 'hidden';
        }

        const rect = target.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 1.4;
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        const wave = document.createElement('span');
        wave.className = 'm3-ripple-wave';
        wave.style.width = `${size}px`;
        wave.style.height = `${size}px`;
        wave.style.left = `${x}px`;
        wave.style.top = `${y}px`;

        target.appendChild(wave);
        wave.addEventListener('animationend', () => wave.remove(), { once: true });
    });
})();
