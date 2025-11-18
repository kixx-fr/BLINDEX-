/* ===========================
  CONFIG "PRO"
=========================== */
const SCRIPT_URL = document.body.dataset.apiUrl;
const PAGE_SIZE = 12;
const BANNER_MODE = 'text';
const BANNER_TEXT = `Livraison gratuite selon la zone — Offre limitée !`;
const LOGO_SUBTEXT = `Nouveautés chaque semaine !`;
// CORRIGÉ: Mis à "" (vide). Mettez votre lien "embed" pour l'afficher.
const YOUTUBE_EMBED_URL = ""; 

// Noms de service
const SERVICE_EXPRESS_ID = "Guadeloupe_Express";
const SERVICE_STANDARD_ID = "Guadeloupe_Standard";
const COMMUNES_ELIGIBLES_EXPRESS = ["Les Abymes", "Baie-Mahault", "Le Gosier", "Morne-à-l'Eau"];

// Seuils commerciaux
const SHIPPING_THRESHOLD = 70.00;
const LOW_STOCK_THRESHOLD = 5;

/* ===========================
  GLOBAL VARS
=========================== */
let productsOriginal = [];
let productsAll = [];
let currentPage = 1;
let cart = [];
let shippingRules = []; 
let COMMUNES_DATA = {};
let currentToastTimer;
let imageMap = {};

/* ===========================
  UTILITIES
=========================== */
function formatPrice(v){ return Number(v||0).toFixed(2) + ' €'; }
function calcFourTimes(total){ return (total >= 30.00) ? (total/4).toFixed(2) : null; }
function sanitizeInput(str) { if (!str) return ''; return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]); }
function sanitizeForHtmlId(str) {
  if (!str) return 'id-undefined';
  return 'id-' + String(str).replace(/[^a-zA-Z0-9_-]/g, '_');
}

/* ===========================
  FONCTIONS DE MODALES & UX
=========================== */

function showToast(message, isError = false) {
  const toast = document.getElementById('toast-notification');
  if (!toast) return;
  toast.textContent = message;
  toast.style.backgroundColor = isError ? 'var(--red)' : 'var(--anthracite)';
  clearTimeout(currentToastTimer);
  toast.classList.add('show');
  currentToastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function showErrorModal(message) {
  document.getElementById('alert-message').textContent = message;
  document.getElementById('alert-modal').classList.remove('hidden');
}

function showConfirm(message, onConfirm) {
  const modal = document.getElementById('confirm-modal');
  modal.querySelector('#confirm-message').textContent = message;
  const btnYes = document.getElementById('confirm-yes');
  const btnNo = document.getElementById('confirm-no');
  const newBtnYes = btnYes.cloneNode(true);
  btnYes.parentNode.replaceChild(newBtnYes, btnYes);
  const newBtnNo = btnNo.cloneNode(true);
  btnNo.parentNode.replaceChild(newBtnNo, btnNo);
  newBtnYes.onclick = () => { modal.classList.add('hidden'); onConfirm(); };
  newBtnNo.onclick = () => { modal.classList.add('hidden'); };
  modal.classList.remove('hidden');
}

function showTextModal(modalId) {
  document.getElementById(modalId)?.classList.remove('hidden');
}

function showIframeModal(url, title) {
  const modal = document.getElementById('iframe-modal');
  modal.querySelector('#iframe-title').textContent = title;
  modal.querySelector('#iframe-content').src = url;
  modal.classList.remove('hidden');
}

function showProductPreviewModal(modelId) {
  const product = productsOriginal.find(p => p.modelBaseId === modelId);
  if (!product) return;

  const modal = document.getElementById('product-preview-modal');
  const titleEl = document.getElementById('preview-title');
  const descEl = document.getElementById('preview-description');
  const mainImgEl = document.getElementById('preview-main-image');
  const thumbsContainerEl = document.getElementById('preview-thumbs');

  titleEl.textContent = product.masterNameBase || 'Produit';
  descEl.textContent = product.description || '';
  mainImgEl.src = product.imageUrls[0];
  
  thumbsContainerEl.innerHTML = '';
  product.imageUrls.forEach((url, index) => {
    const thumbImg = document.createElement('img');
    thumbImg.src = url;
    thumbImg.alt = `Aperçu ${index + 1}`;
    thumbImg.className = 'preview-thumb';
    if (index === 0) {
      thumbImg.classList.add('active');
    }
    thumbImg.addEventListener('click', () => {
      mainImgEl.src = url;
      thumbsContainerEl.querySelectorAll('.preview-thumb').forEach(t => t.classList.remove('active'));
      thumbImg.classList.add('active');
    });
    thumbsContainerEl.appendChild(thumbImg);
  });

  modal.classList.remove('hidden');
}


/* ===========================
  CHARGEMENT INITIAL
=========================== */
async function loadProducts(){
  if(!SCRIPT_URL){ 
    showErrorModal('ERREUR: Le SCRIPT_URL est manquant ou vide dans index.html.'); 
    return; 
  }
  
  try{
    const resp = await fetch(`${SCRIPT_URL}?action=getProduits`);
    const textData = await resp.text(); 
    let data;

    try { data = JSON.parse(textData); } 
    catch (jsonErr) {
      console.error("ERREUR CRITIQUE JSON PARSE.", textData.substring(0, 500) + "...");
      document.getElementById('catalogue').innerHTML = `<p class="muted text-center col-span-full" style="color: red; font-weight: bold;">ERREUR FATALE: La connexion a échoué (403/405). Vérifiez les permissions "Tout le monde" de l'App Script.<br><button id="retry-load" class="btn-primary mt-4">Réessayer</button></p>`;
      document.getElementById('retry-load')?.addEventListener('click', loadProducts);
      return; 
    }
    
    if(!data.success){ 
      showErrorModal(`ERREUR: Le script Google a retourné une erreur: ${data.error || 'Erreur inconnue'}`);
      return; 
    }
    
    productsOriginal = data.products || [];
    shippingRules = data.shippingRules || [];
    COMMUNES_DATA = data.communes || {};
    
    productsOriginal.forEach(p=>{
      p.imageUrls = Array.isArray(p.imageUrls) ? p.imageUrls.slice(0,7) : [];
      if(p.imageUrl && p.imageUrl.trim() && !p.imageUrls.includes(p.imageUrl)) p.imageUrls.unshift(p.imageUrl);
      if(!p.imageUrls || p.imageUrls.length===0) p.imageUrls = ['https://placehold.co/420x300/f0f0f0/ccc?text=Image+Indisponible'];
      p.imageUrl = p.imageUrls[0]; 
      imageMap[p.modelBaseId] = p.imageUrls;
      
      p.sizes = Array.isArray(p.sizes) ? p.sizes : (p.variants || []);
      if(!p.sizes.length && (p.price || p.stock)) {
          p.sizes = [{ fullId: p.modelBaseId, size:'Unique', price: p.price || 0, stock: p.stock || 0 }];
      }
      p.sizes.forEach(s => s.stock = Number(s.stock || 0));
    });

    populateFilters();
    applyFiltersAndRender();
    updateCartDisplays();
    
  } catch(e){ 
    console.error('loadProducts Network/Fetch Error:', e); 
    document.getElementById('catalogue').innerHTML = `<p class="muted text-center col-span-full" style="color: red; font-weight: bold;">ERREUR RÉSEAU: La connexion au script Google a échoué. Vérifiez votre SCRIPT_URL.<br><button id="retry-load" class="btn-primary mt-4">Réessayer</button></p>`;
    document.getElementById('retry-load')?.addEventListener('click', loadProducts);
  }
}

/* ===========================
  FILTRES (Desktop & Mobile)
=========================== */

function populateFilters(){
  const sizes = new Set();
  const categories = new Set();
  productsOriginal.forEach(p=> {
    (p.sizes||[]).forEach(s=> {
      if (s.size && String(s.size).trim() !== '') {
        sizes.add(String(s.size).trim());
      }
    });
    if (p._category && String(p._category).trim() !== '') {
      categories.add(String(p._category).trim());
    }
  });
  
  const sortedSizes = Array.from(sizes).sort();
  const sortedCategories = Array.from(categories).sort();
  
  const selSize = document.getElementById('filter-size');
  const selCat = document.getElementById('filter-category');
  selSize.innerHTML = '<option value="">Toutes tailles</option>';
  selCat.innerHTML = '<option value="">Toutes catégories</option>';
  sortedSizes.forEach(sz=> selSize.innerHTML += `<option value="${escapeHtml(sz)}">${escapeHtml(sz)}</option>`);
  sortedCategories.forEach(cat=> selCat.innerHTML += `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`);

  const contSize = document.getElementById('filter-size-mobile');
  const contCat = document.getElementById('filter-category-mobile');
  contSize.innerHTML = '';
  contCat.innerHTML = '';
  
  sortedSizes.forEach(sz => {
    contSize.innerHTML += `<button class="filter-btn" data-filter="size" data-value="${escapeHtml(sz)}">${escapeHtml(sz)}</button>`;
  });
  sortedCategories.forEach(cat => {
    contCat.innerHTML += `<button class="filter-btn" data-filter="category" data-value="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`;
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget;
      const filterType = target.dataset.filter;
      const value = target.dataset.value;
      
      document.getElementById(`filter-${filterType}`).value = value;
      document.querySelectorAll(`.filter-btn[data-filter="${filterType}"]`).forEach(b => b.classList.remove('active'));
      target.classList.add('active');
      
      applyFiltersAndRender();
      document.getElementById('filter-overlay').classList.remove('open');
    });
  });
}

/**
 * CORRIGÉ (Phase 1): Logique de filtre entièrement réécrite pour être robuste.
 */
function applyFiltersAndRender(){
  const sizeValue = document.getElementById('filter-size').value;
  const categoryValue = document.getElementById('filter-category').value;
  const queryValue = document.getElementById('search').value.trim().toLowerCase();
  
  productsAll = productsOriginal.filter(p => {
    // Par défaut, on suppose que le produit correspond
    let matchesCategory = true;
    let matchesSize = true;
    let matchesQuery = true;

    // 1. Vérification de la catégorie (si un filtre est appliqué)
    if (categoryValue) {
      matchesCategory = (p._category && p._category.trim() === categoryValue);
    }

    // 2. Vérification de la taille (si un filtre est appliqué)
    if (sizeValue) {
      // .some() vérifie si AU MOINS UNE taille correspond
      matchesSize = (p.sizes || []).some(s => s.size && s.size.trim() === sizeValue);
    }

    // 3. Vérification de la recherche (si une recherche est effectuée)
    if (queryValue) {
      matchesQuery = (
        (p.masterNameBase || '').toLowerCase().includes(queryValue) || 
        (p.description || '').toLowerCase().includes(queryValue) || 
        (p.modelBaseId || '').toLowerCase().includes(queryValue)
      );
    }

    // Le produit n'est affiché que s'il correspond aux TROIS conditions
    return matchesCategory && matchesSize && matchesQuery;
  });
  
  renderPage(1);
  renderPagination();
}

function clearFilters() {
  document.getElementById('filter-size').value = '';
  document.getElementById('filter-category').value = '';
  document.getElementById('search').value = '';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  applyFiltersAndRender();
}

/* ===========================
  GESTION DES FICHES PRODUITS
=========================== */

function updateCardDynamicDisplay(safeId, selectElement) {
  if (!selectElement || selectElement.selectedIndex === -1) {
    return;
  }
  
  const opt = selectElement.options[selectElement.selectedIndex];
  const price = parseFloat(opt.dataset.price) || 0;
  const stock = parseInt(opt.dataset.stock || 0);
  
  const card = selectElement.closest('.product-card');
  if (!card) return;

  const priceEl = card.querySelector('.price');
  if (priceEl) {
    priceEl.textContent = formatPrice(price);
  }

  const pay4El = card.querySelector(`#pay4_${safeId}`);
  const pay4 = calcFourTimes(price);
  if (pay4El) {
    if (pay4) {
      pay4El.innerHTML = 'Payez 4× ' + pay4 + ' €';
      pay4El.style.display = 'inline-block';
    } else {
      pay4El.style.display = 'none';
    }
  }

  const qtyValueEl = card.querySelector(`#qtyval_${safeId}`);
  if (qtyValueEl) {
    qtyValueEl.textContent = '1';
  }
  
  const btnDecrease = card.querySelector('.qty-btn[data-action="decrease"]');
  if (btnDecrease) {
    btnDecrease.disabled = true;
  }

  const btnIncrease = card.querySelector('.qty-btn[data-action="increase"]');
  if (btnIncrease) {
    btnIncrease.disabled = stock <= 1;
  }

  const addBtn = card.querySelector('.add-btn');
  if (addBtn) {
      if (stock <= 0) {
          addBtn.disabled = true;
          addBtn.textContent = 'Épuisé';
      } else {
          addBtn.disabled = false;
          addBtn.textContent = '+ Ajouter';
      }
  }
}

function handleQtyChange(safeId, delta) {
  const card = document.getElementById(`size_${safeId}`)?.closest('.product-card');
  if (!card) return;

  const qtyValueEl = card.querySelector(`#qtyval_${safeId}`);
  const sel = card.querySelector(`#size_${safeId}`);
  
  if (!qtyValueEl || !sel || sel.selectedIndex === -1) return;

  const opt = sel.options[sel.selectedIndex];
  const stock = parseInt(opt.dataset.stock || 0);
  
  let currentQty = parseInt(qtyValueEl.textContent, 10);
  let newQty = currentQty + delta;

  if (newQty < 1) newQty = 1;
  if (newQty > stock) newQty = stock;
  
  qtyValueEl.textContent = newQty;

  const btnDecrease = card.querySelector('.qty-btn[data-action="decrease"]');
  const btnIncrease = card.querySelector('.qty-btn[data-action="increase"]');

  if (btnDecrease) btnDecrease.disabled = (newQty <= 1);
  if (btnIncrease) btnIncrease.disabled = (newQty >= stock);
}

/* ===========================
  AFFICHAGE PRODUITS
=========================== */
function renderPage(page){
  currentPage = page;
  const start = (page-1)*PAGE_SIZE;
  const pageItems = productsAll.slice(start, start+PAGE_SIZE); 
  const container = document.getElementById('catalogue');
  container.innerHTML = ''; 
  
  if (pageItems.length === 0) {
      container.innerHTML = '<p class="muted text-center col-span-full">Aucun produit ne correspond à vos critères.<br><button id="clear-filters-main" class="btn-primary mt-4">Réinitialiser les filtres</button></p>';
      document.getElementById('clear-filters-main')?.addEventListener('click', clearFilters);
  }

  pageItems.forEach((prod)=>{
    const originalModelId = prod.modelBaseId;
    const safeId = sanitizeForHtmlId(originalModelId);

    let hasStock = false;
    let totalStock = 0;
    
    const sizeOptions = (prod.sizes || []).map(s=> {
      const stock = Number(s.stock || 0);
      totalStock += stock;
      const disabled = stock <= 0 ? 'disabled' : '';
      if (stock > 0) hasStock = true;
      const stockLabel = stock <= 0 ? ' (Épuisé)' : '';
      return `<option value="${escapeHtml(s.fullId)}" 
                      data-price="${Number(s.price||0)}" 
                      data-size="${escapeHtml(s.size)}" 
                      data-stock="${stock}" 
                      ${disabled}>
                ${escapeHtml(s.size)} — ${Number(s.price||0).toFixed(2)} €${stockLabel}
              </option>`
    }).join('');
    
    const firstAvailableSize = prod.sizes?.find(s => s.stock > 0) || prod.sizes?.[0];
    const basePrice = firstAvailableSize ? firstAvailableSize.price : 0;
    const baseStock = firstAvailableSize ? firstAvailableSize.stock : 0;
    
    const pay4 = calcFourTimes(basePrice);
    const thumbsHtml = prod.imageUrls.map((u, i)=> `<img src="${u}" class="thumb ${i===0?'active':''}" data-model-id="${safeId}" data-img-index="${i}" alt="vue ${i+1}" />`).join('');
    
    const categoryText = prod._category 
        ? `<div class="product-category">Catégorie : <button class="category-link" data-category="${escapeHtml(prod._category)}">${escapeHtml(prod._category)}</button></div>` : '';
    
    const badgeHtml = (totalStock > 0 && totalStock < LOW_STOCK_THRESHOLD) 
        ? `<div class="product-badge">Stock Limité !</div>` : '';

    const card = document.createElement('article');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="img-frame" role="button" aria-label="Aperçu rapide pour ${escapeHtml(prod.masterNameBase)}">
        ${badgeHtml}
        <img id="main-${safeId}" class="product-image" src="${escapeHtml(imageMap[originalModelId][0])}" alt="${escapeHtml(prod.masterNameBase||'Produit')}" data-model-id="${safeId}">
      </div>
      <div class="thumbs">${thumbsHtml}</div>
      
      <div class="product-meta">
        <div class="product-info-grow">
          <div class="product-title">${escapeHtml(prod.masterNameBase||'Produit')}</div>
          <div class="product-desc">${escapeHtml(prod.description||'')}</div>
          ${categoryText}
          <button type="button" class="muted text-sm underline" data-modal-iframe="https://gdt.kixx.fr" data-modal-title="Guide des Tailles">Guides des tailles</button>
        </div>
        
        <div>
          <div class="mt-2">
            <select id="size_${safeId}" class="form-input">${sizeOptions}</select>
          </div>
          <div class="price-row">
            <div>
              <div class="price">${formatPrice(basePrice)}</div>
              <div class="pay4-badge" id="pay4_${safeId}" style="margin-top: 4px; ${pay4 ? 'display:inline-block;' : 'display:none;'}">
                ${pay4 ? 'Payez 4× ' + pay4 + ' €' : ''}
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
              <div class="qty-selector" data-model-id="${safeId}">
                <button class="qty-btn" data-action="decrease" aria-label="Retirer 1" disabled>－</button>
                <span class="qty-value" id="qtyval_${safeId}">1</span>
                <button class="qty-btn" data-action="increase" aria-label="Ajouter 1" ${baseStock <= 1 ? 'disabled' : ''}>＋</button>
              </div>
              <button class="add-btn" data-original-model-id="${escapeHtml(originalModelId)}" ${!hasStock ? 'disabled' : ''}>
                ${!hasStock ? 'Épuisé' : '+ Ajouter'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(card);
    
    const sizeSelect = document.getElementById(`size_${safeId}`);
    if(sizeSelect) {
        sizeSelect.addEventListener('change', (ev) => updateCardDynamicDisplay(safeId, ev.target));
        updateCardDynamicDisplay(safeId, sizeSelect); 
    }
    card.querySelector('.qty-btn[data-action="decrease"]').addEventListener('click', (ev) => { ev.stopPropagation(); handleQtyChange(safeId, -1); });
    card.querySelector('.qty-btn[data-action="increase"]').addEventListener('click', (ev) => { ev.stopPropagation(); handleQtyChange(safeId, 1); });

    card.querySelectorAll('.thumb').forEach(t=>{
      t.addEventListener('click', (ev)=>{
        ev.stopPropagation(); 
        const model = ev.currentTarget.dataset.modelId; 
        const iIdx = Number(ev.currentTarget.dataset.imgIndex);
        const main = document.getElementById('main-' + model);
        const originalId = card.querySelector('.add-btn').dataset.originalModelId;
        
        if(main && originalId && imageMap[originalId] && imageMap[originalId][iIdx]){
          main.src = imageMap[originalId][iIdx];
          card.querySelectorAll(`.thumb[data-model-id="${model}"]`).forEach(x=>x.classList.remove('active'));
          ev.currentTarget.classList.add('active');
        }
      });
    });

    card.querySelector('.img-frame').addEventListener('click', (ev)=>{
      showProductPreviewModal(originalModelId);
    });

    card.querySelector('.add-btn').addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const buttonElement = ev.currentTarget;
      const originalModelId = buttonElement.dataset.originalModelId; 
      if (addToCartFromCard(originalModelId, buttonElement)) { 
        // Feedback
      }
    });
  }); 
}

/* --------------------------
    PAGINATION
    -------------------------- */
function renderPagination(){
  const totalPages = Math.max(1, Math.ceil(productsAll.length / PAGE_SIZE));
  const pag = document.getElementById('pagination');
  pag.innerHTML = '';
  if (totalPages <= 1) return;
  for(let i=1;i<=totalPages;i++){
    const btn = document.createElement('button');
    btn.textContent = i;
    if(i===currentPage) btn.classList.add('active');
    btn.addEventListener('click', ()=>{ renderPage(i); renderPagination(); window.scrollTo({top:0, behavior:'smooth'}); });
    pag.appendChild(btn);
  }
}

/* ===========================
  PANIER (LOGIQUE)
=========================== */
// ... (Toute la logique du panier (addToCartFromCard, updateCartDisplays, changeQty, updateIncentiveBar, etc.) 
// reste identique à la version précédente. Collez-la ici.)
// ...

function addToCartFromCard(modelBaseId, buttonElement){
  const safeId = sanitizeForHtmlId(modelBaseId);

  const qtyValEl = document.getElementById(`qtyval_${safeId}`);
  const quantityToAdd = parseInt(qtyValEl ? qtyValEl.textContent : 1, 10) || 1;
  
  if(quantityToAdd <= 0) {
    showErrorModal('Veuillez ajouter au moins 1 article.');
    return false;
  }
  
  const sel = document.getElementById(`size_${safeId}`);
  if(!sel || sel.selectedIndex === -1 || sel.options.length === 0) { 
    showErrorModal('Veuillez sélectionner une taille.'); return false; 
  }
  const opt = sel.options[sel.selectedIndex];
  if (opt.disabled) { showErrorModal('Cette taille est épuisée.'); return false; }
  
  const id = opt.value;
  const price = parseFloat(opt.dataset.price) || 0;
  const sizeLabel = opt.dataset.size || 'Taille non définie';
  const stock = parseInt(opt.dataset.stock || 0);
  
  const product = productsOriginal.find(p=>p.modelBaseId===modelBaseId);
  const title = (product || {}).masterNameBase || modelBaseId;
  const imageUrl = (product || {}).imageUrl || (imageMap[modelBaseId] ? imageMap[modelBaseId][0] : '');
  
  const existing = cart.find(c=>c.id===id);
  const currentQtyInCart = existing ? existing.quantity : 0;
  
  if (stock === 0) { showErrorModal(`Ce produit est épuisé.`); return false; }
  
  if (currentQtyInCart + quantityToAdd > stock) { 
    showErrorModal(`Stock insuffisant pour "${title} - ${sizeLabel}".\nStock disponible : ${stock} (vous en avez ${currentQtyInCart} dans le panier)`); 
    return false; 
  }
  
  if(existing) { existing.quantity += quantityToAdd; } 
  else { cart.push({ id, modelBaseId, price, quantity: quantityToAdd, sizeLabel, title, stock: stock, imageUrl: imageUrl }); }
  
  updateCartDisplays(true);
  if (qtyValEl) qtyValEl.textContent = "1"; 
  updateCardDynamicDisplay(safeId, sel);
  
  if (buttonElement) {
    const hasStock = (product.sizes || []).some(s => s.stock > 0);
    const originalText = hasStock ? '+ Ajouter' : 'Épuisé';
    
    buttonElement.textContent = '✓ Ajouté !';
    buttonElement.classList.add('add-ok');
    setTimeout(() => {
      buttonElement.textContent = originalText;
      buttonElement.classList.remove('add-ok');
      
      const currentStock = parseInt(opt.dataset.stock || 0);
      if(currentStock <= 0) {
        buttonElement.textContent = 'Épuisé';
        buttonElement.disabled = true;
      } else {
        buttonElement.textContent = '+ Ajouter';
        buttonElement.disabled = false;
      }
    }, 1500);
  } else {
    showToast(`✓ ${title} ajouté au panier!`);
  }
  
  return true;
}

function updateCartDisplays(openCart=false){
  const totalItems = cart.reduce((s,i)=>s+i.quantity,0);
  document.getElementById('cart-count').textContent = totalItems;
  const container = document.getElementById('cart-items');
  if (!container) return;
  container.innerHTML = '';
  let subtotal = 0;
  
  if(cart.length===0) {
      container.innerHTML = '<div class="muted text-center py-8"><svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>Votre panier est vide</div>';
  }
  
  [...cart].forEach(item=>{ 
    subtotal += item.price * item.quantity;
    const row = document.createElement('div');
    row.className = 'flex gap-3 mb-3 pb-3 border-b';
    const imgHtml = item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" class="w-20 h-20 object-cover rounded-lg border">` : `<div class="w-20 h-20 bg-gray-100 rounded-lg"></div>`;

    row.innerHTML = `
      ${imgHtml}
      <div class="flex-1 flex justify-between">
        <div class="flex flex-col justify-center">
          <div class="font-bold text-sm leading-tight">${escapeHtml(item.title)}</div>
          <div class="muted text-sm">${escapeHtml(item.sizeLabel)}</div>
          <div class="muted text-sm">${Number(item.price).toFixed(2)} € / unité</div>
        </div>
        <div class="flex flex-col gap-2 items-end justify-center">
          <div class="qty-selector" style="transform: scale(0.9);">
            <button type="button" onclick="changeQty('${item.id}', -1)" class="qty-btn" title="Retirer un article" ${item.quantity <= 1 ? 'disabled' : ''}>－</button>
            <span class="qty-value">${item.quantity}</span>
            <button type="button" onclick="changeQty('${item.id}', 1)" class="qty-btn" title="Ajouter un article" ${item.quantity >= item.stock ? 'disabled' : ''}>＋</button>
          </div>
          <div class="font-bold text-base">${formatPrice(item.price*item.quantity)}</div>
        </div>
      </div>`;
    container.appendChild(row);
  });
  
  document.getElementById('cart-subtotal').textContent = formatPrice(subtotal);
  
  const shippingInfo = computeShipping(subtotal);
  const shippingCost = shippingInfo.cost;
  const shippingName = shippingInfo.name;
  
  const zone = document.getElementById('zoneLivraison')?.value || '';
  const shippingEl = document.getElementById('cart-shipping');
  
  if (zone === '' && subtotal > 0) { shippingEl.textContent = 'À calculer'; } 
  else { shippingEl.textContent = formatPrice(shippingCost); }
  
  const shippingNameEl = document.getElementById('cart-shipping-name');
  if (shippingNameEl) {
    if (shippingName && shippingCost > 0) {
      shippingNameEl.textContent = shippingName.replace(/_/g, ' ');
      shippingNameEl.classList.remove('hidden');
    } else if (shippingName && shippingCost === 0 && subtotal > 0) {
      shippingNameEl.textContent = "Livraison Gratuite";
      shippingNameEl.classList.remove('hidden');
    } else {
      shippingNameEl.textContent = '';
      shippingNameEl.classList.add('hidden');
    }
  }

  const total = subtotal + shippingCost;
  document.getElementById('cart-total').textContent = formatPrice(total);
  document.getElementById('total-display').textContent = formatPrice(total); 
  
  const fourEach = calcFourTimes(total);
  document.getElementById('four-times-display').textContent = fourEach ? `ou 4× ${fourEach} €` : '—'; 
  
  const cartFourTimesEl = document.getElementById('cart-four-times-display');
  if (cartFourTimesEl) {
    if (fourEach) {
      cartFourTimesEl.textContent = `Payez en 4× ${fourEach} € avec PayPal`;
      cartFourTimesEl.classList.remove('hidden');
    } else {
      cartFourTimesEl.textContent = '';
      cartFourTimesEl.classList.add('hidden');
    }
  }
  
  updateIncentiveBar(subtotal);
  renderPayPalOverlay(total);
  if(openCart) openCartOverlay();
}

function changeQty(id, delta){
  const it = cart.find(c=>c.id===id);
  if(!it) return;
  const newQty = it.quantity + delta;
  if (newQty <= 0) {
    cart = cart.filter(c=>c.id!==id);
  } else {
    const stock = it.stock;
    if (newQty > stock) {
      showErrorModal(`Stock insuffisant. Maximum : ${stock}`);
      it.quantity = stock;
    } else {
      it.quantity = newQty;
    }
  }
  updateCartDisplays();
}

function updateIncentiveBar(subtotal) {
  const bar = document.getElementById('cart-shipping-incentive-bar');
  if (!bar) return;
  
  if (subtotal === 0) {
    bar.style.display = 'none';
    return;
  }
  
  bar.style.display = 'block';
  const remaining = SHIPPING_THRESHOLD - subtotal;
  
  if (remaining > 0) {
    bar.innerHTML = `Plus que <strong>${formatPrice(remaining)}</strong> pour la livraison gratuite !`;
    bar.classList.remove('is-free');
  } else {
    bar.innerHTML = `<strong>Félicitations !</strong> Vous bénéficiez de la livraison gratuite.`;
    bar.classList.add('is-free');
  }
}

/* --------------------------
  LIVRAISON
-------------------------- */
function computeShipping(subtotal = null){
  let rateId = document.getElementById('zoneLivraison')?.value || '';
  const currentSubtotal = (subtotal !== null) ? subtotal : cart.reduce((s,i)=>s + i.price*i.quantity, 0);
  const defaultReturn = { cost: 0.00, name: '' };
  if (rateId === '' || currentSubtotal === 0) return defaultReturn; 

  if (rateId === SERVICE_EXPRESS_ID) {
    const domSel = document.getElementById('dom-postal');
    let communeName = '';
    if (domSel && domSel.value && !domSel.value.includes('-- Choisir')) {
      communeName = domSel.options[domSel.selectedIndex].text.split('—')[1]?.trim() || '';
    }
    if (!communeName || !COMMUNES_ELIGIBLES_EXPRESS.includes(communeName)) {
      if(communeName) { 
        showErrorModal(`Désolé, la commune "${communeName}" n'est pas éligible au service Express 24h. Nous appliquons le tarif Standard.`);
      }
      rateId = SERVICE_STANDARD_ID; 
    }
  }

  if (shippingRules.length > 0) {
    for (let i = 1; i < shippingRules.length; i++) {
      const row = shippingRules[i];
      if (!row || !row[1]) continue; 
      const [_, rowRateId, cout, seuilMin, seuilMax] = row.map((val, idx) => idx >= 2 ? parseFloat(val) : val);
      if (rowRateId === rateId && currentSubtotal >= seuilMin && currentSubtotal <= seuilMax) {
        return { cost: cout, name: rowRateId }; 
      }
    }
  }
  
  console.warn(`Aucune règle de livraison trouvée pour Service: ${rateId} et Sous-total: ${currentSubtotal}`);
  return defaultReturn; 
}


/* --------------------------
  PANIER (OUVERTURE/FERMETURE)
-------------------------- */
const cartOverlayEl = document.getElementById('cart-overlay');
const filterOverlayEl = document.getElementById('filter-overlay');
function openCartOverlay(){ if(cartOverlayEl) { cartOverlayEl.classList.add('open'); cartOverlayEl.setAttribute('aria-hidden','false'); } }
function closeCartOverlay(){ if(cartOverlayEl) { cartOverlayEl.classList.remove('open'); cartOverlayEl.setAttribute('aria-hidden','true'); } }
function openFilterOverlay(){ if(filterOverlayEl) { filterOverlayEl.classList.add('open'); filterOverlayEl.setAttribute('aria-hidden','false'); } }
function closeFilterOverlay(){ if(filterOverlayEl) { filterOverlayEl.classList.remove('open'); filterOverlayEl.setAttribute('aria-hidden','true'); } }

/* --------------------------
  PAYPAL
-------------------------- */
function renderPayPalOverlay(totalValue){
  const container = document.getElementById('paypal-button-overlay');
  if (!container) return;
  container.innerHTML = '';
  if(cart.length===0){ container.style.display = 'none'; return; }
  
  container.style.display = 'block'; 
  const total = totalValue.toFixed(2);
  
  if (typeof paypal !== 'undefined' && typeof paypal.Buttons === 'function') {
      try {
        paypal.Buttons({
          style:{ layout:'vertical', color:'gold', shape:'rect', label:'pay' },
          createOrder: (data, actions) => {
            if (!validateQuickForm()) { return actions.reject(); }
            return actions.order.create({ purchase_units:[{ amount:{ value: total } }] });
          },
          onApprove: (data, actions) => {
            return actions.order.capture().then(details => {
              const payload = buildCreateOrderPayload('paypal', details);
              postCreateOrder(payload);
            });
          },
          onError: (err) => { console.error('PayPal error', err); showErrorModal('Une erreur PayPal est survenue.'); }
        }).render('#paypal-button-overlay');
      } catch (e) {
        console.error("Erreur de rendu PayPal: ", e);
        container.innerHTML = '<div class="muted" style="color: red;">Erreur chargement PayPal.</div>';
      }
  } else {
      container.innerHTML = '<div class="muted">Chargement du bouton PayPal...</div>';
  }
}

/* ===========================
  SOUMISSION COMMANDE
=========================== */
function validateQuickForm() {
    const quickForm = document.getElementById('quick-form');
    if (!quickForm || !quickForm.checkValidity()) {
        quickForm?.reportValidity();
        showErrorModal('Veuillez remplir tous les champs obligatoires (nom, email, adresse, etc.).');
        return false;
    }
    
    const rateId = document.getElementById('zoneLivraison')?.value || '';
    const needsCommune = (rateId === SERVICE_STANDARD_ID || rateId === SERVICE_EXPRESS_ID);
    const quickFormInputs = quickForm.elements;
    
    if (needsCommune && (!quickFormInputs['dom-postal'].value || quickFormInputs['dom-postal'].value.includes('-- Choisir'))) {
        quickFormInputs['dom-postal'].focus();
        showErrorModal('Veuillez sélectionner votre Code Postal et Commune.');
        return false;
    }
    if ((rateId.startsWith('France_') || rateId.startsWith('Corse_')) && (!quickFormInputs.codepostal.value.trim() || !quickFormInputs.commune.value.trim())) {
        quickFormInputs.codepostal.focus();
        showErrorModal('Veuillez remplir le Code Postal et la Commune.');
        return false;
    }
    if (!quickFormInputs.adresse.value || quickFormInputs.adresse.value.trim().length < 5) {
       quickFormInputs.adresse.focus();
       showErrorModal('Veuillez remplir votre adresse (N°, Rue, etc.)');
       return false;
    }
    
    if (typeof grecaptcha !== 'undefined' && grecaptcha.getResponse) {
      const token = grecaptcha.getResponse();
      if(!token) {
          showErrorModal('Veuillez compléter le reCAPTCHA.');
          return false;
      }
    }
    return true; 
}

function buildCreateOrderPayload(paymentMethod, paymentDetails){
  const quick = document.getElementById('quick-form');
  const prenom = sanitizeInput(quick.prenom?.value.trim() || '');
  const email = sanitizeInput(quick.email?.value.trim() || (paymentDetails?.payer?.email_address || '')); 
  const rateId = document.getElementById('zoneLivraison')?.value || '';
  let communeCP = '';
  
  if (rateId === SERVICE_STANDARD_ID || rateId === SERVICE_EXPRESS_ID) {
    const sel = document.getElementById('dom-postal');
    communeCP = sanitizeInput(sel?.options[sel.selectedIndex]?.value || '');
  } else if (rateId.startsWith('France_') || rateId.startsWith('Corse_')) {
    communeCP = `${sanitizeInput(quick.codepostal?.value.trim() || '')} ${sanitizeInput(quick.commune?.value.trim() || '')}`;
  }
  
  const subtotal = cart.reduce((s,i)=>s + i.price*i.quantity, 0);
  const shipping = computeShipping(subtotal).cost;
  const totalFinal = subtotal + shipping;
  
  return {
    action: 'createOrder',
    recaptchaResponse: (typeof grecaptcha !== 'undefined' && grecaptcha.getResponse ? grecaptcha.getResponse() : 'local_test') || 'local_test',
    productsJson: JSON.stringify(cart.map(c=> ({ id:c.id, quantity:c.quantity }))),
    totalFinal: totalFinal.toFixed(2),
    methodePaiement: paymentMethod,
    modeLivraison: rateId, 
    prenom: prenom,
    nom: sanitizeInput(quick.nom?.value.trim() || ''),
    telephone: sanitizeInput(quick.telephone?.value.trim() || ''),
    email: email, 
    adresse: sanitizeInput(quick.adresse?.value.trim() || ''),
    communeCP: communeCP, 
    nombreArticlesTotal: cart.reduce((s,i)=>s+i.quantity,0),
    recapText: cart.map(c=> `${c.quantity}x ${c.title} ${c.sizeLabel} (${(c.price).toFixed(2)}€)` ).join(' | ')
  };
}

async function postCreateOrder(payload, buttonElement = null){
  try {
    const res = await fetch(SCRIPT_URL, { 
      method:'POST', 
      headers:{'Content-Type':'application/json'}, 
      body: JSON.stringify(payload) 
    });
    const data = await res.json();
    
    if(data.success){ 
      showConfirmationAndClear(payload.prenom, payload.methodePaiement);
    } else { 
      showErrorModal("Erreur validation commande: " + (data.error || 'Erreur inconnue')); 
      if(buttonElement) {
        buttonElement.disabled = false;
        buttonElement.classList.remove('btn-validate-ok');
      }
    }
  } catch(e) {
    console.error('postCreateOrder err', e); 
    showErrorModal('Erreur réseau (soumission commande).'); 
    if(buttonElement) {
      buttonElement.disabled = false;
      buttonElement.classList.remove('btn-validate-ok');
    }
  }
}

function showConfirmationAndClear(prenom, paymentMethod){
  const pop = document.getElementById('popup');
  document.getElementById('popup-prenom').textContent = escapeHtml(prenom) || '';
  
  const paymentInfoEl = document.getElementById('popup-payment-info');
  if (paymentMethod === 'virement') {
    paymentInfoEl.innerHTML = 'Veuillez procéder au virement en utilisant les informations suivantes: <br><strong>IBAN:</strong> IE85SUMU99036512267268<br><strong>Titulaire:</strong> R.Laskari / Kicks';
    paymentInfoEl.classList.remove('hidden');
  } else if (paymentMethod === 'sumup') {
    paymentInfoEl.textContent = 'Vous allez recevoir un lien de paiement sécurisé par email pour finaliser votre commande.';
    paymentInfoEl.classList.remove('hidden');
  } else {
    paymentInfoEl.textContent = 'Votre paiement a été reçu.';
    paymentInfoEl.classList.remove('hidden');
  }
  
  pop.classList.remove('hidden');
  let c = 10;
  document.getElementById('popup-count').textContent = c;
  const t = setInterval(()=>{ 
    c--; 
    document.getElementById('popup-count').textContent = c; 
    if(c<=0){ 
      clearInterval(t); 
      pop.classList.add('hidden'); 
      window.location.reload();
    } 
  }, 1000);
  
  cart = []; 
  document.getElementById('quick-form')?.reset();
  document.getElementById('zoneLivraison').value = '';
  document.getElementById('dom-postal-container').classList.add('hidden');
  document.getElementById('city-container').classList.add('hidden');
  
  updateCartDisplays();
  if (typeof grecaptcha !== 'undefined' && grecaptcha.reset) grecaptcha.reset();
  closeCartOverlay();
}

async function validateAndSubmit(paymentMethod, buttonElement) {
    if(cart.length===0) return showErrorModal('Votre panier est vide.');
    if (!validateQuickForm()) { return; }
    
    buttonElement.disabled = true;
    buttonElement.classList.add('btn-validate-ok');
    
    const payload = buildCreateOrderPayload(paymentMethod, null);
    await postCreateOrder(payload, buttonElement);
}

/* ===========================
  SOUMISSION AUTRES FORMULAIRES
=========================== */

async function handleNewsletterSignup(event) {
    event.preventDefault();
    const prenom = sanitizeInput(document.getElementById('newsletter-prenom').value.trim());
    const email = sanitizeInput(document.getElementById('newsletter-email').value.trim());
    const statusEl = document.getElementById('newsletter-status');
    const btn = document.getElementById('btn-newsletter');
    
    if (!prenom) { statusEl.textContent = 'Veuillez entrer votre prénom.'; return; }
    if (!email || !email.includes('@')) { statusEl.textContent = 'Veuillez entrer un email valide.'; return; }
    
    statusEl.textContent = 'Envoi...';
    btn.disabled = true;
    
    try {
        const payload = { action: 'addNewsletter', email: email, prenom: prenom };
        const res = await fetch(SCRIPT_URL, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const data = await res.json();
        
        if (data.success) {
            statusEl.textContent = 'Merci ' + escapeHtml(prenom) + ' ! Vous êtes bien inscrit.';
            document.getElementById('newsletter-form').reset();
        } else {
            statusEl.textContent = 'Erreur: ' + (data.error || 'Impossible de vous inscrire.');
        }
    } catch (e) { console.error('Newsletter Error:', e); statusEl.textContent = 'Erreur réseau. Veuillez réessayer.';
    } finally { btn.disabled = false; }
}

async function handleContactFormSubmit(event) {
    event.preventDefault();
    const prenom = sanitizeInput(document.getElementById('contact-prenom').value.trim());
    const email = sanitizeInput(document.getElementById('contact-email').value.trim());
    const message = sanitizeInput(document.getElementById('contact-message').value.trim());
    const statusEl = document.getElementById('contact-status');
    const btn = document.getElementById('btn-contact-submit');
    
    if (!prenom || !email || !message) { statusEl.textContent = 'Veuillez remplir tous les champs.'; return; }
    if (!email.includes('@')) { statusEl.textContent = 'Veuillez entrer un email valide.'; return; }
    
    statusEl.textContent = 'Envoi en cours...';
    btn.disabled = true;
    
    try {
        const payload = { action: 'handleContactForm', email: email, prenom: prenom, message: message };
        const res = await fetch(SCRIPT_URL, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const data = await res.json();
        
        if (data.success) {
            statusEl.textContent = 'Merci ' + escapeHtml(prenom) + ' ! Votre message a bien été envoyé.';
            document.getElementById('contact-form').reset(); 
        } else {
            statusEl.textContent = 'Erreur: ' + (data.error || 'Impossible d\'envoyer le message.');
        }
    } catch (e) { console.error('Contact Form Error:', e); statusEl.textContent = 'Erreur réseau. Veuillez réessayer.';
    } finally { btn.disabled = false; }
}

/* ===========================
  INITIALISATION (ÉCOUTEURS)
=========================== */
window.addEventListener('load', async ()=>{
  // Injection des textes configurés
  document.getElementById('banner-text').textContent = BANNER_TEXT;
  document.getElementById('logo-subtext').textContent = LOGO_SUBTEXT;
  document.getElementById('logo-subtext-mobile').textContent = LOGO_SUBTEXT;

  // Affichage de la vidéo YouTube si l'URL est définie
  if(YOUTUBE_EMBED_URL && YOUTUBE_EMBED_URL.trim() !== "") {
    const container = document.getElementById('youtube-embed-container');
    const iframe = document.getElementById('youtube-iframe');
    if(container && iframe) {
      iframe.src = YOUTUBE_EMBED_URL;
      container.classList.remove('hidden');
    }
  }

  await loadProducts(); // Charge le reste

  // --- Header ---
  document.getElementById('cart-float-btn')?.addEventListener('click', ()=> openCartOverlay());
  document.getElementById('close-cart')?.addEventListener('click', ()=> closeCartOverlay());
  window.addEventListener('scroll', () => {
    document.getElementById('site-header').classList.toggle('is-scrolling', window.scrollY > 10);
  }, { passive: true });

  // --- Filtres ---
  document.getElementById('search')?.addEventListener('input', applyFiltersAndRender);
  document.getElementById('filter-size')?.addEventListener('change', applyFiltersAndRender);
  document.getElementById('filter-category')?.addEventListener('change', applyFiltersAndRender);
  document.getElementById('mobile-filter-btn')?.addEventListener('click', openFilterOverlay);
  document.getElementById('close-filter')?.addEventListener('click', closeFilterOverlay);
  document.getElementById('clear-filters-mobile')?.addEventListener('click', () => {
    clearFilters();
    closeFilterOverlay();
  });
  
  document.querySelector('main.max-container').addEventListener('click', function(e) {
      if (e.target.classList.contains('category-link')) {
          e.preventDefault();
          const category = e.target.dataset.category;
          if (category) {
              document.getElementById('filter-category').value = category;
              document.querySelectorAll('.filter-btn[data-filter="category"]').forEach(b => b.classList.remove('active'));
              document.querySelector(`.filter-btn[data-filter="category"][data-value="${category}"]`)?.classList.add('active');
              applyFiltersAndRender();
              document.querySelector('section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
      }
  });

  // --- Panier ---
  const zoneLivraison = document.getElementById('zoneLivraison');
  if (zoneLivraison) {
    zoneLivraison.addEventListener('change', function(){
      const v = this.value; 
      const domContainer = document.getElementById('dom-postal-container');
      const domSel = document.getElementById('dom-postal');
      const cityContainer = document.getElementById('city-container');
      domSel.innerHTML = '<option value="">-- Choisir CP et Commune --</option>';
      
      const isGuadeloupeService = (v === SERVICE_STANDARD_ID || v === SERVICE_EXPRESS_ID);
      
      if(isGuadeloupeService){
        const communesList = COMMUNES_DATA['GUA'] || [];
        if (communesList.length === 0) {
          domSel.innerHTML = '<option value="">Erreur: communes non chargées</option>';
        }
        const sortedList = communesList.sort((a, b) => a.commune.localeCompare(b.commune));
        sortedList.forEach(it=> {
          const text = `${it.code} — ${it.commune}`;
          domSel.innerHTML += `<option value="${escapeHtml(text)}">${escapeHtml(text)}</option>`;
        });
        domContainer.classList.remove('hidden');
        cityContainer.classList.add('hidden');
      } 
      else if (v.startsWith('France_') || v.startsWith('Corse_')) {
        domContainer.classList.add('hidden');
        cityContainer.classList.remove('hidden');
      } 
      else {
        domContainer.classList.add('hidden');
        cityContainer.classList.add('hidden');
      }
      updateCartDisplays();
    });
  }
  document.getElementById('dom-postal')?.addEventListener('change', updateCartDisplays);

  // --- Boutons de Paiement ---
  document.getElementById('btn-submit-sumup').addEventListener('click', function() { validateAndSubmit('sumup', this); });
  document.getElementById('btn-submit-virement').addEventListener('click', function() { validateAndSubmit('virement', this); });
  document.getElementById('toggle-iban-button')?.addEventListener('click', ()=>{ document.getElementById('virement-info')?.classList.toggle('hidden'); });
  document.getElementById('btn-clear-cart')?.addEventListener('click', ()=>{
    showConfirm('Êtes-vous sûr de vouloir vider le panier ?', () => {
      cart=[]; 
      document.getElementById('zoneLivraison').value = ''; 
      document.getElementById('dom-postal-container').classList.add('hidden');
      document.getElementById('city-container').classList.add('hidden');
      updateCartDisplays(); 
    });
  });

  // --- Modals (Footer & autres) ---
  document.body.addEventListener('click', (e) => {
    // Ferme les modales texte/iframe
    if (e.target.classList.contains('modal-close-btn') || e.target.classList.contains('text-modal')) {
      e.target.closest('.modal-backdrop').classList.add('hidden');
    }
    // Ferme la modale d'aperçu produit (clic sur la croix OU sur le fond gris)
    if (e.target.classList.contains('product-preview-close') || e.target.id === 'product-preview-modal') {
       document.getElementById('product-preview-modal').classList.add('hidden');
    }
    // Ferme la modale d'alerte
    if (e.target.id === 'alert-modal-close') {
      document.getElementById('alert-modal').classList.add('hidden');
    }
    
    // Ouvre les modales texte (CGV, Cookies, etc.)
    const textModalTarget = e.target.closest('[data-modal-target]');
    if (textModalTarget) {
      e.preventDefault();
      showTextModal(textModalTarget.dataset.modalTarget);
    }
    
    // Ouvre les modales iframe (Guide des tailles, etc)
    const iframeModalTarget = e.target.closest('[data-modal-iframe]');
    if (iframeModalTarget) {
      e.preventDefault();
      showIframeModal(iframeModalTarget.dataset.modalIframe, iframeModalTarget.dataset.modalTitle);
    }
  });

  // --- Formulaires Footer ---
  document.getElementById('newsletter-form')?.addEventListener('submit', handleNewsletterSignup);
  document.getElementById('contact-form')?.addEventListener('submit', handleContactFormSubmit);
  
});