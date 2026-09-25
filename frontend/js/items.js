import { getProducts, createProduct, updateProduct, deleteProduct } from './api.js';

// HTMLエスケープ（商品名にHTML特殊文字が含まれていても安全に表示するため）
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  const productGrid = document.querySelector('.product-grid');

  const addContainer = document.querySelector('.add-product-container');
  const addBtn = addContainer?.querySelector('.add-product-btn');
  const addPanel = addContainer?.querySelector('.add-panel');
  const addSaveBtn = addContainer?.querySelector('.js-add-save');
  const addCancelBtn = addContainer?.querySelector('.js-add-cancel');
  const addNameInput = addContainer?.querySelector('.js-add-name');
  const addPriceInput = addContainer?.querySelector('.js-add-price');
  const addStockInput = addContainer?.querySelector('.js-add-stock');

  // 1つの商品カード（表示用カード＋編集パネル）のHTMLを生成
  function createCardHTML(product) {
    const avatarIndex = (Number(product.store_product_no) % 4) + 1;
    const stock = Number(product.stock);
    const isLowStock = stock <= 10;
    return `
        <div class="product-card">
            <div class="product-avatar m3-avatar m3-avatar-${avatarIndex}">
                <span class="m3-icon m3-icon-fill">storefront</span>
            </div>
            <div class="product-info">
                <div class="product-name">${escapeHTML(product.name)}</div>
                <div class="product-price">¥${Number(product.price).toLocaleString()}</div>
                <div class="product-stock${isLowStock ? ' is-low' : ''}">
                    <span class="m3-icon">${isLowStock ? 'warning' : 'inventory_2'}</span>
                    在庫数：${stock.toLocaleString()}
                </div>
            </div>
            <div class="product-actions">
                <button type="button" class="card-btn btn-edit" title="編集">
                    <span class="m3-icon">edit</span>
                </button>
                <button type="button" class="card-btn btn-delete" title="削除">
                    <span class="m3-icon">delete</span>
                </button>
            </div>
        </div>
        <div class="edit-panel">
            <h2 class="modal-title">商品の編集</h2>
            <div class="form-group">
                <label>商品名</label>
                <input type="text" value="${escapeHTML(product.name)}" class="modal-input js-input-name">
            </div>
            <div class="form-group">
                <label>価格（円）</label>
                <input type="number" value="${product.price}" class="modal-input js-input-price">
            </div>
            <div class="form-group">
                <label>在庫数</label>
                <input type="number" value="${product.stock}" class="modal-input js-input-stock">
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-cancel">キャンセル</button>
                <button type="button" class="btn-save">編集</button>
            </div>
        </div>
    `;
  }

  // 商品1件分のカード要素を作成し、イベントを紐づける
  function buildCardElement(product) {
    const container = document.createElement('div');
    container.className = 'product-card-container';
    container.dataset.storeProductNo = product.store_product_no;
    container.innerHTML = createCardHTML(product);
    bindCardEvents(container, product);
    return container;
  }

  // サーバーから商品一覧を取得して描画し直す
  async function renderProducts() {
    try {
      const products = await getProducts();
      productGrid.innerHTML = '';
      products.forEach((product, index) => {
        const card = buildCardElement(product);
        card.classList.add('m3-enter');
        card.style.animationDelay = `${Math.min(index, 12) * 40}ms`;
        productGrid.appendChild(card);
      });
    } catch (err) {
      showErrorToast(err.message || '商品の取得に失敗しました');
    }
  }

  // 1枚のカードに編集／削除のイベントを紐づける
  function bindCardEvents(container, product) {
    const editBtn = container.querySelector('.btn-edit');
    const deleteBtn = container.querySelector('.btn-delete');
    const panel = container.querySelector('.edit-panel');
    const nameInput = panel.querySelector('.js-input-name');
    const priceInput = panel.querySelector('.js-input-price');
    const stockInput = panel.querySelector('.js-input-stock');
    const saveBtn = panel.querySelector('.btn-save');
    const cancelBtn = panel.querySelector('.btn-cancel');

    // このカードが今どの商品を表しているかを保持（編集・削除時に参照する）
    let currentProduct = { ...product };

    // 編集パネル開閉
    editBtn.addEventListener('click', (e) => {
      e.preventDefault();
      nameInput.value = currentProduct.name;
      priceInput.value = currentProduct.price;
      stockInput.value = currentProduct.stock;
      panel.classList.toggle('show');
    });

    // キャンセルボタン
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      panel.classList.remove('show');
    });

    // 保存（編集）処理：APIを呼び出してDBを更新し、成功したら表示を更新する
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      const newName = nameInput.value.trim();
      const newPrice = priceInput.value.trim();
      const newStock = stockInput.value.trim();

      if (!newName || newPrice === '' || newStock === '') {
        showErrorToast('商品名・価格・在庫数をすべて入力してください。');
        return;
      }

      if (Number(newPrice) < 0 || Number(newStock) < 0) {
        showErrorToast('価格・在庫数にマイナスの値を入れないでください。');
        return;
      }

      const updateData = {
        name: newName,
        price: Number(newPrice),
        stock: Number(newStock)
      };

      saveBtn.disabled = true;
      try {
        const updated = await updateProduct(currentProduct.store_product_no, updateData);
        currentProduct = updated;

        container.querySelector('.product-name').textContent = updated.name;
        container.querySelector('.product-price').textContent = '¥' + Number(updated.price).toLocaleString();
        container.querySelector('.product-stock').textContent = '在庫数：' + Number(updated.stock).toLocaleString();

        panel.classList.remove('show');
        showSuccessToast("商品を更新しました。")
      } catch (err) {
        showErrorToast(err.message || '商品の更新に失敗しました');
      } finally {
        saveBtn.disabled = false;
      }
    });

    // 削除処理：APIを呼び出してDBから削除し、成功したらカードを取り除く
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        const confirmDelete = confirm('この商品を削除してもよろしいですか？');
        if (!confirmDelete) return;

        deleteBtn.disabled = true;
        try {
          await deleteProduct(currentProduct.store_product_no);
          container.remove();
          showSuccessToast("商品を削除しました。")
        } catch (err) {
          showErrorToast(err.message || '商品の削除に失敗しました');
        } finally {
          deleteBtn.disabled = false;
        }
      });
    }
  }

  // 追加パネルの開閉
  if (addBtn && addPanel) {
    addBtn.addEventListener('click', (e) => {
      e.preventDefault();
      addPanel.classList.toggle('show');
    });
  }

  // キャンセル：入力欄を空にして閉じる
  if (addCancelBtn) {
    addCancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (addNameInput) addNameInput.value = '';
      if (addPriceInput) addPriceInput.value = '';
      if (addStockInput) addStockInput.value = '';
      addPanel.classList.remove('show');
    });
  }

  // 追加処理：APIを呼び出してDBに登録し、成功したら一覧を再取得して表示する
  if (addSaveBtn) {
    addSaveBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      const nameValue = addNameInput ? addNameInput.value.trim() : '';
      const priceValue = addPriceInput ? addPriceInput.value.trim() : '';
      const stockValue = addStockInput ? addStockInput.value.trim() : '';

      if (!nameValue || priceValue === '' || stockValue === '') {
        showErrorToast('商品名・価格・在庫数を入力してください。');
        return;
      }

      if (Number(priceValue) < 0 || Number(stockValue) < 0) {
        showErrorToast('価格・在庫数にマイナスの値を入れないでください。');
        return;
      }

      const newProductData = {
        name: nameValue,
        price: Number(priceValue),
        stock: Number(stockValue)
      };

      addSaveBtn.disabled = true;
      try {
        await createProduct(newProductData);

        addNameInput.value = '';
        addPriceInput.value = '';
        addStockInput.value = '';
        addPanel.classList.remove('show');

        // store_product_noはサーバー側で採番されるため一覧を取り直す
        await renderProducts();

        showSuccessToast("商品を追加しました。")
      } catch (err) {
        showErrorToast(err.message || '商品の登録に失敗しました');
      } finally {
        addSaveBtn.disabled = false;
      }
    });
  }

  // 初期表示：サーバーから商品一覧を取得して描画
  renderProducts();
});