import { getSalesSummary } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnNiti = document.getElementById('btn-niti');
    const btnZen = document.getElementById('btn-zen');

    const cardNiti = document.querySelector('.analysis-card-niti');
    const cardZen = document.querySelector('.analysis-card-zen');

    const dateInput = document.getElementById('niti-date-input');

    // 一度読み込んだタブは再取得しない（日別は日付が変わったら再取得する）
    let zenLoaded = false;
    let loadedNitiDate = null;

    // ---- ユーティリティ ----
    function formatCurrency(n) {
        return `¥ ${Number(n ?? 0).toLocaleString()}`;
    }

    function todayStr() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function setLoading(suffix, isLoading) {
        document.getElementById(`${suffix}-loading`).style.display = isLoading ? 'block' : 'none';
        document.getElementById(`${suffix}-content`).style.display = isLoading ? 'none' : 'block';
    }

    function showError(suffix, message) {
        const errEl = document.getElementById(`${suffix}-error`);
        errEl.textContent = message;
        errEl.style.display = message ? 'block' : 'none';
    }

    function renderProducts(suffix, salesByProduct) {
        const grid = document.getElementById(`products-grid-${suffix}`);
        grid.innerHTML = '';

        if (!salesByProduct || salesByProduct.length === 0) {
            grid.innerHTML = '<div class="product-item empty-message">該当する売上がありません</div>';
            return;
        }

        salesByProduct.forEach(p => {
            const item = document.createElement('div');
            item.className = 'product-item';
            item.innerHTML = `
                <div class="product-info">
                    <div class="product-name">${p.product_name}</div>
                    <div class="product-qty">${p.quantity}個</div>
                </div>
                <div class="product-price">${formatCurrency(p.amount)}</div>
            `;
            grid.appendChild(item);
        });
    }

    function renderSummary(suffix, data) {
        document.getElementById(`total-revenue-${suffix}`).textContent = formatCurrency(data.total_revenue);
        document.getElementById(`total-orders-${suffix}`).textContent = `${data.total_orders ?? 0}件`;

        const pb = data.payment_breakdown || {};
        document.getElementById(`cash-amount-${suffix}`).textContent = formatCurrency(pb.cash);
        document.getElementById(`ticket-breakdown-${suffix}`).innerHTML =
            `100円券<br>${pb.ticket_100_count ?? 0}枚<br>200円券<br>${pb.ticket_200_count ?? 0}枚`;
        document.getElementById(`ticket-amount-${suffix}`).textContent = formatCurrency(pb.ticket_amount);
        document.getElementById(`emoney-amount-${suffix}`).textContent = formatCurrency(pb.emoney);

        renderProducts(suffix, data.sales_by_product);
    }

    function renderTrend(salesByDay) {
        const tbody = document.getElementById('daily-trend-zen');
        tbody.innerHTML = '';

        if (!salesByDay || salesByDay.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3">データがありません</td></tr>';
            return;
        }

        salesByDay.forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${d.date}</td>
                <td class="num">${d.total_orders}件</td>
                <td class="num">${formatCurrency(d.total_revenue)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // ---- データ取得 ----
    async function loadNiti(date) {
        setLoading('niti', true);
        showError('niti', '');
        try {
            const data = await getSalesSummary(date);
            renderSummary('niti', data);
            loadedNitiDate = date;
        } catch (e) {
            showError('niti', e.message || '売上集計の取得に失敗しました');
        } finally {
            setLoading('niti', false);
        }
    }

    async function loadZen() {
        setLoading('zen', true);
        showError('zen', '');
        try {
            const data = await getSalesSummary();
            renderSummary('zen', data);
            renderTrend(data.sales_by_day);
            zenLoaded = true;
        } catch (e) {
            showError('zen', e.message || '売上集計の取得に失敗しました');
        } finally {
            setLoading('zen', false);
        }
    }

    // ---- タブ切り替え ----
    btnNiti.addEventListener('click', () => {
        btnNiti.classList.add('active');
        btnZen.classList.remove('active');

        cardNiti.style.display = 'block';
        cardZen.style.display = 'none';

        if (loadedNitiDate !== dateInput.value) {
            loadNiti(dateInput.value);
        }
    });

    btnZen.addEventListener('click', () => {
        btnZen.classList.add('active');
        btnNiti.classList.remove('active');

        cardNiti.style.display = 'none';
        cardZen.style.display = 'block';

        if (!zenLoaded) {
            loadZen();
        }
    });

    // ---- 日付変更 ----
    dateInput.addEventListener('change', () => {
        loadNiti(dateInput.value);
    });

    // ---- 初期表示（日別・今日） ----
    dateInput.value = todayStr();
    loadNiti(dateInput.value);
});
