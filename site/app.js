"use strict";
(function (root) {
  const doc = root.document;
  const Shop = root.Shop;
  const { core, store, config } = Shop;
  const { actions } = store;

  const CATEGORY_KEYS = Object.freeze({
    "Ингредиенты": "ingredients",
    "Зелья": "potions",
    "Свитки": "scrolls",
    "Артефакты": "artifacts"
  });
  const PROMO_MESSAGES = Object.freeze({
    empty: "Введите промокод",
    unknown: "Такого промокода нет",
    already_applied: "Промокод уже применён"
  });
  const MINUS = "−";

  const reducedMotion = root.matchMedia("(prefers-reduced-motion: reduce)");
  const darkQuery = root.matchMedia("(prefers-color-scheme: dark)");

  const find = (selector, scope = doc) => scope.querySelector(selector);
  const byTestId = (id, scope = doc) => find(`[data-testid="${id}"]`, scope);

  const el = {
    skipLink: find(".skip-link"),
    storefront: find("#storefront"),
    modeBadge: byTestId("mode-badge"),
    themeToggle: byTestId("theme-toggle"),
    cartToggle: byTestId("cart-toggle"),
    cartCount: byTestId("cart-count"),
    cartToggleTotal: find("[data-cart-toggle-total]"),
    filters: find("[data-filters]"),
    search: byTestId("search-input"),
    category: byTestId("category-select"),
    sort: byTestId("sort-select"),
    reset: byTestId("filters-reset"),
    tabs: [byTestId("view-all"), byTestId("view-favorites")],
    catalogPanel: find("#catalog-panel"),
    favoritesCount: byTestId("favorites-count"),
    resultsCount: byTestId("results-count"),
    catalogHeading: find("#catalog-heading"),
    catalog: byTestId("catalog"),
    emptyResults: byTestId("empty-results"),
    emptyTitle: find("[data-empty-title]"),
    emptyText: find("[data-empty-text]"),
    emptyAction: find("[data-empty-action]"),
    cart: byTestId("cart"),
    cartTitle: find("#cart-title"),
    cartMeta: find("[data-cart-meta]"),
    cartClose: byTestId("cart-close"),
    cartEmpty: byTestId("cart-empty"),
    cartLines: find("[data-cart-lines]"),
    promoForm: find("[data-promo-form]"),
    promoInput: byTestId("promo-input"),
    promoMessage: byTestId("promo-message"),
    promoRemove: byTestId("promo-remove"),
    subtotal: byTestId("cart-subtotal"),
    discount: byTestId("cart-discount"),
    total: byTestId("cart-total"),
    stamp: find("[data-stamp]"),
    checkout: byTestId("checkout"),
    checkoutNote: find("[data-checkout-note]"),
    toasts: find("[data-toasts]"),
    orderDialog: byTestId("order-confirmation"),
    orderId: byTestId("order-id"),
    orderTotal: byTestId("order-total"),
    orderClose: byTestId("order-close"),
    cardTemplate: find("#product-card-template"),
    lineTemplate: find("#cart-line-template"),
    toastTemplate: find("#toast-template")
  };

  const cardNodes = new Map();
  const lineNodes = new Map();
  let previousCount = 0;
  let shownError = null;
  let renderedCategories = "";
  let catalogScroll = 0;

  function plural(count, forms) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) {
      return forms[0];
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return forms[1];
    }
    return forms[2];
  }

  function countGoods(count) {
    return `${count} ${plural(count, ["товар", "товара", "товаров"])}`;
  }

  function initials(name) {
    return name
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join("");
  }

  function setText(node, text) {
    if (node.textContent !== text) {
      node.textContent = text;
    }
  }

  function setAmount(row, text) {
    setText(find("[data-amount]", row), text);
  }

  function setImage(image, product) {
    const src = product.image ? `./${String(product.image).replace(/^\.?\//, "")}` : "";
    if (image.getAttribute("src") !== src) {
      image.closest(".product-figure")?.classList.toggle("is-broken", !src);
      image.setAttribute("src", src);
    }
  }

  function stockInfo(product) {
    if (product.stock <= 0) {
      return { text: "Нет в наличии", level: "none" };
    }
    if (product.stock <= 5) {
      return { text: `Осталось ${product.stock}`, level: "low" };
    }
    return { text: `В наличии: ${product.stock}`, level: "ok" };
  }

  function createCard(product) {
    const node = el.cardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.productId = product.id;
    const image = byTestId("product-image", node);
    const figure = find(".product-figure", node);
    image.addEventListener("error", () => figure.classList.add("is-broken"));
    image.addEventListener("load", () => figure.classList.remove("is-broken"));
    Shop.productView?.mount(find(".model-stage", figure), product.id, product.name);
    return node;
  }

  function updateCard(node, product, position, line, isFavorite) {
    node.dataset.category = CATEGORY_KEYS[product.category] ?? "potions";
    node.dataset.inStock = String(product.stock > 0);
    setText(byTestId("product-name", node), product.name);
    setText(byTestId("product-price", node), core.formatPrice(product.price));
    setText(find("[data-description]", node), product.description ?? "");
    setText(find("[data-category]", node), product.category);
    setText(find("[data-number]", node), `№ ${String(position).padStart(2, "0")}`);
    setText(find(".product-fallback", node), initials(product.name));

    const image = byTestId("product-image", node);
    image.alt = product.name;
    setImage(image, product);

    const stock = stockInfo(product);
    const stockNode = byTestId("product-stock", node);
    setText(stockNode, stock.text);
    stockNode.dataset.level = stock.level;

    const add = byTestId("add-to-cart", node);
    const maxQty = core.maxQuantityFor(product, config.maxQuantity);
    const atLimit = Boolean(line) && line.qty >= maxQty;
    add.disabled = maxQty === 0 || atLimit;
    setText(add, maxQty === 0 ? "Нет в наличии" : "Добавить");
    add.setAttribute("aria-label", maxQty === 0 ? `Нет в наличии: ${product.name}` : `Добавить в корзину: ${product.name}`);

    const inCart = find("[data-in-cart]", node);
    inCart.hidden = !line;
    setText(inCart, line ? (atLimit ? `В корзине: ${line.qty}, это весь остаток` : `В корзине: ${line.qty}`) : "");

    const favorite = byTestId("favorite-toggle", node);
    favorite.setAttribute("aria-pressed", String(isFavorite));
    favorite.setAttribute("aria-label", `В избранное: ${product.name}`);
  }

  function syncChildren(container, nodes) {
    const current = [...container.children];
    const unchanged = current.length === nodes.length && current.every((node, index) => node === nodes[index]);
    if (!unchanged) {
      container.replaceChildren(...nodes);
    }
  }

  function renderCatalog(state) {
    const positions = new Map(state.products.map((product, index) => [product.id, index + 1]));
    const linesById = new Map(state.cart.lines.map((line) => [line.id, line]));
    const favorites = new Set(state.favorites);
    const nodes = state.visibleProducts.map((product) => {
      let node = cardNodes.get(product.id);
      if (!node) {
        node = createCard(product);
        cardNodes.set(product.id, node);
      }
      updateCard(node, product, positions.get(product.id) ?? 0, linesById.get(product.id), favorites.has(product.id));
      return node;
    });
    syncChildren(el.catalog, nodes);
    el.catalog.setAttribute("aria-busy", String(state.status === "loading"));
    renderEmptyResults(state);
  }

  function renderEmptyResults(state) {
    const isEmpty = state.visibleProducts.length === 0 && state.status !== "loading" && state.products.length > 0;
    el.emptyResults.hidden = !isEmpty;
    if (!isEmpty) {
      return;
    }
    const noFavorites = state.filters.view === "favorites" && state.favorites.length === 0;
    setText(el.emptyTitle, noFavorites ? "В избранном пока пусто" : "Ничего не найдено");
    setText(el.emptyText, noFavorites ? "Нажмите на сердечко у товара, чтобы сохранить его здесь." : "Проверьте написание или сбросьте фильтры.");
    setText(el.emptyAction, noFavorites ? "Показать все товары" : "Сбросить фильтры");
    el.emptyAction.dataset.intent = noFavorites ? "show-all" : "reset";
  }

  function createLine(id) {
    const node = el.lineTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.productId = id;
    return node;
  }

  function updateLine(node, line) {
    const { product } = line;
    setText(byTestId("cart-line-name", node), product.name);
    setText(byTestId("cart-line-qty", node), String(line.qty));
    setText(byTestId("cart-line-total", node), core.formatPrice(line.lineTotal));
    setText(find("[data-unit]", node), `${core.formatPrice(product.price)} за шт.`);
    const thumb = find(".cart-line-thumb", node);
    const src = product.image ? `./${String(product.image).replace(/^\.?\//, "")}` : "";
    if (thumb.getAttribute("src") !== src) {
      thumb.setAttribute("src", src);
    }
    const decrease = byTestId("qty-decrease", node);
    const increase = byTestId("qty-increase", node);
    decrease.disabled = line.qty <= 1;
    increase.disabled = line.qty >= line.maxQty;
    decrease.setAttribute("aria-label", `Уменьшить количество: ${product.name}`);
    increase.setAttribute("aria-label", `Увеличить количество: ${product.name}`);
    byTestId("remove-from-cart", node).setAttribute("aria-label", `Удалить из корзины: ${product.name}`);
  }

  function renderCart(state) {
    const { cart } = state;
    const nodes = cart.lines.map((line) => {
      let node = lineNodes.get(line.id);
      if (!node) {
        node = createLine(line.id);
        lineNodes.set(line.id, node);
      }
      updateLine(node, line);
      return node;
    });
    const present = new Set(cart.lines.map((line) => line.id));
    [...lineNodes.keys()].filter((id) => !present.has(id)).forEach((id) => lineNodes.delete(id));
    syncChildren(el.cartLines, nodes);

    const isEmpty = cart.lines.length === 0;
    el.cartLines.hidden = isEmpty;
    el.cartEmpty.hidden = !isEmpty;
    setText(el.cartMeta, isEmpty ? "Пока пусто" : `${countGoods(cart.count)} в корзине`);

    setAmount(el.subtotal, core.formatPrice(cart.subtotal));
    setAmount(el.total, core.formatPrice(cart.total));
    el.discount.hidden = !cart.promo;
    el.promoRemove.hidden = !cart.promo;
    el.stamp.hidden = !cart.promo;
    if (cart.promo) {
      setAmount(el.discount, `${MINUS}${core.formatPrice(cart.discount)}`);
      setText(find(".stamp-value", el.stamp), `${MINUS}${cart.promo.percent}%`);
      setText(find(".stamp-code", el.stamp), cart.promo.code);
    }

    const online = state.mode === "api";
    el.checkout.hidden = !online || isEmpty;
    el.checkout.disabled = state.checkoutPending;
    setText(el.checkout, state.checkoutPending ? "Оформляем…" : "Оформить заказ");
    el.checkoutNote.hidden = online || isEmpty;

    setText(el.cartCount, String(cart.count));
    setText(el.cartToggleTotal, core.formatPrice(cart.total));
    el.cartToggle.setAttribute("aria-label", `Корзина: ${countGoods(cart.count)} на ${core.formatPrice(cart.total)}`);
    if (cart.count > previousCount) {
      el.cartToggle.classList.remove("is-bumped");
      void el.cartToggle.offsetWidth;
      el.cartToggle.classList.add("is-bumped");
    }
    previousCount = cart.count;
  }

  function renderCategories(categories) {
    const signature = categories.join("|");
    if (signature === renderedCategories) {
      return;
    }
    renderedCategories = signature;
    const options = categories.map((category) => {
      const option = doc.createElement("option");
      option.value = category;
      option.textContent = category;
      return option;
    });
    el.category.replaceChildren(el.category.options[0], ...options);
  }

  function renderFilters(state) {
    const { filters } = state;
    renderCategories(state.categories);
    if (el.search.value !== filters.query && doc.activeElement !== el.search) {
      el.search.value = filters.query;
    }
    el.category.value = filters.category;
    el.sort.value = filters.sort;
    el.reset.disabled = !filters.query && !filters.category && filters.sort === "default";
    el.tabs.forEach((tab) => {
      const selected = tab.dataset.view === filters.view;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    el.catalogPanel.setAttribute("aria-labelledby", filters.view === "favorites" ? "tab-favorites" : "tab-all");
    setText(el.favoritesCount, String(state.favorites.length));
    setText(el.resultsCount, state.status === "loading" ? "Ищем…" : `Найдено: ${state.visibleProducts.length}`);
  }

  function renderMode(state) {
    const online = state.mode === "api";
    el.modeBadge.dataset.mode = state.mode;
    setText(el.modeBadge, online ? "Каталог с сервера" : "Офлайн-каталог");
    el.modeBadge.title = online ? "Каталог, поиск и заказы работают через API" : "Каталог встроен в страницу, корзина хранится в браузере";
  }

  function captureFocus() {
    const active = doc.activeElement;
    if (!active || active === doc.body) {
      return null;
    }
    return {
      element: active,
      testid: active.dataset?.testid ?? null,
      productId: active.closest("[data-product-id]")?.dataset.productId ?? null,
      region: el.cart.contains(active) ? "cart" : el.catalogPanel.contains(active) ? "catalog" : null
    };
  }

  function restoreFocus(focus) {
    if (!focus || !focus.region) {
      return;
    }
    const { element } = focus;
    if (doc.contains(element) && !element.disabled) {
      if (doc.activeElement !== element) {
        element.focus({ preventScroll: true });
      }
      return;
    }
    const scope = focus.region === "cart" ? el.cart : el.catalogPanel;
    const row = focus.productId ? find(`[data-product-id="${CSS.escape(focus.productId)}"]`, scope) : null;
    const sameControl = row && focus.testid ? byTestId(focus.testid, row) : null;
    const fallback = row ? find("button:not(:disabled)", row) : null;
    const target = [sameControl, fallback].find((candidate) => candidate && !candidate.disabled) ?? (focus.region === "cart" ? el.cartTitle : el.catalogHeading);
    target.focus({ preventScroll: true });
  }

  function render(state) {
    const focus = captureFocus();
    renderMode(state);
    renderFilters(state);
    renderCatalog(state);
    renderCart(state);
    restoreFocus(focus);
    if (state.error && state.error !== shownError) {
      showToast(state.error);
    }
    shownError = state.error;
  }

  function showToast(message, { undo = null } = {}) {
    const node = el.toastTemplate.content.firstElementChild.cloneNode(true);
    setText(find(".toast-text", node), message);
    let timer = 0;
    const dismiss = () => {
      root.clearTimeout(timer);
      node.classList.add("is-leaving");
      root.setTimeout(() => node.remove(), 200);
    };
    if (undo) {
      const button = byTestId("toast-undo", node);
      button.hidden = false;
      button.addEventListener("click", () => {
        undo();
        dismiss();
      }, { once: true });
    }
    el.toasts.append(node);
    while (el.toasts.children.length > 3) {
      el.toasts.firstElementChild.remove();
    }
    timer = root.setTimeout(dismiss, undo ? 6000 : 2600);
  }

  function productName(id) {
    return store.getState().products.find((product) => product.id === id)?.name ?? "Товар";
  }

  function renderScreen() {
    const showCart = root.location.hash === "#cart";
    if (showCart === !el.cart.hidden) return;

    if (showCart) catalogScroll = root.scrollY;
    el.storefront.hidden = showCart;
    el.cart.hidden = !showCart;
    doc.body.dataset.screen = showCart ? "cart" : "catalog";
    el.skipLink.setAttribute("href", showCart ? "#cart" : "#main");
    el.cartToggle.setAttribute("aria-expanded", String(showCart));

    root.scrollTo(0, showCart ? 0 : catalogScroll);
    (showCart ? el.cartTitle : el.cartToggle).focus({ preventScroll: true });
  }

  function onCartToggle() {
    if (!el.cart.hidden) return;
    root.history.pushState({ shopCart: true }, "", "#cart");
    renderScreen();
  }

  function closeCart() {
    if (el.cart.hidden) return;
    if (root.history.state?.shopCart) {
      root.history.back();
      return;
    }
    root.history.replaceState(null, "", "#catalog-heading");
    renderScreen();
    el.catalogHeading.scrollIntoView();
    el.catalogHeading.focus({ preventScroll: true });
  }

  function animatePress(event) {
    const control = event.target.closest("button, .hero-link");
    if (!control || control.disabled || reducedMotion.matches) return;
    control.animate(
      [{ transform: "scale(0.96)" }, { transform: "scale(1.015)", offset: 0.55 }, { transform: "scale(1)" }],
      { duration: 220, easing: "cubic-bezier(0.2, 0.75, 0.25, 1)" }
    );
  }

  function onCatalogClick(event) {
    const button = event.target.closest("[data-action]");
    const card = button?.closest("[data-product-id]");
    if (!button || !card) {
      return;
    }
    const id = card.dataset.productId;
    if (button.dataset.action === "add") {
      actions.add(id);
      Shop.productView?.cast(find(".model-stage", card));
      showToast(`«${productName(id)}» в корзине`);
    }
    if (button.dataset.action === "favorite") {
      actions.toggleFavorite(id);
      button.classList.remove("is-popped");
      void button.offsetWidth;
      button.classList.add("is-popped");
    }
  }

  function onCartClick(event) {
    const button = event.target.closest("[data-action]");
    const row = button?.closest("[data-product-id]");
    if (!button || !row) {
      return;
    }
    const id = row.dataset.productId;
    const { action } = button.dataset;
    if (action === "increment") {
      actions.increment(id);
    }
    if (action === "decrement") {
      actions.decrement(id);
    }
    if (action === "remove") {
      const line = store.getState().cart.lines.find((entry) => entry.id === id);
      actions.remove(id);
      if (line) {
        showToast(`«${line.product.name}» удалено из корзины`, {
          undo: () => {
            actions.add(id);
            actions.setQty(id, line.qty);
          }
        });
      }
    }
  }

  function onPromoSubmit(event) {
    event.preventDefault();
    const result = actions.applyPromo(el.promoInput.value);
    el.promoMessage.dataset.state = result.ok ? "success" : "error";
    if (!result.ok) {
      setText(el.promoMessage, PROMO_MESSAGES[result.reason]);
      return;
    }
    setText(el.promoMessage, `Промокод ${result.code} применён: ${MINUS}${result.percent}%`);
    el.promoInput.value = "";
    el.stamp.classList.remove("is-stamping");
    void el.stamp.offsetWidth;
    el.stamp.classList.add("is-stamping");
  }

  function onPromoRemove() {
    actions.removePromo();
    el.promoMessage.dataset.state = "";
    setText(el.promoMessage, "Промокод убран");
    el.promoInput.focus();
  }

  async function onCheckout() {
    const result = await actions.checkout();
    if (result.ok) {
      setText(el.orderId, result.order.id);
      setText(el.orderTotal, core.formatPrice(result.order.total));
      el.promoMessage.dataset.state = "";
      setText(el.promoMessage, "");
      el.orderDialog.showModal();
      return;
    }
    showToast(result.error.message);
  }

  function onTabKeydown(event) {
    const index = el.tabs.indexOf(event.currentTarget);
    const keys = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: el.tabs.length - 1 - index };
    if (!(event.key in keys)) {
      return;
    }
    event.preventDefault();
    const next = el.tabs[(index + keys[event.key] + el.tabs.length) % el.tabs.length];
    actions.setFilters({ view: next.dataset.view });
    next.focus();
  }

  function effectiveTheme() {
    return doc.documentElement.dataset.theme ?? (darkQuery.matches ? "dark" : "light");
  }

  function renderTheme() {
    const dark = effectiveTheme() === "dark";
    el.themeToggle.setAttribute("aria-pressed", String(dark));
  }

  function saveTheme(theme) {
    try {
      root.localStorage.setItem(config.storageKeys.theme, theme);
      return true;
    } catch {
      return false;
    }
  }

  function onThemeToggle() {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    doc.documentElement.dataset.theme = next;
    saveTheme(next);
    renderTheme();
  }

  function bindEvents() {
    el.filters.addEventListener("submit", (event) => event.preventDefault());
    el.search.addEventListener("input", () => actions.setFilters({ query: el.search.value }));
    el.category.addEventListener("change", () => actions.setFilters({ category: el.category.value }));
    el.sort.addEventListener("change", () => actions.setFilters({ sort: el.sort.value }));
    el.reset.addEventListener("click", () => {
      actions.resetFilters();
      el.search.focus();
    });
    el.tabs.forEach((tab) => {
      tab.addEventListener("click", () => actions.setFilters({ view: tab.dataset.view }));
      tab.addEventListener("keydown", onTabKeydown);
    });
    el.emptyAction.addEventListener("click", () => {
      if (el.emptyAction.dataset.intent === "show-all") {
        actions.setFilters({ view: "all" });
      } else {
        actions.resetFilters();
      }
      el.catalogHeading.focus();
    });
    el.catalog.addEventListener("click", onCatalogClick);
    el.cartLines.addEventListener("click", onCartClick);
    el.promoForm.addEventListener("submit", onPromoSubmit);
    el.promoRemove.addEventListener("click", onPromoRemove);
    el.checkout.addEventListener("click", onCheckout);
    el.cartToggle.addEventListener("click", onCartToggle);
    el.cartClose.addEventListener("click", closeCart);
    root.addEventListener("popstate", renderScreen);
    root.addEventListener("hashchange", renderScreen);
    doc.addEventListener("click", animatePress);
    el.orderClose.addEventListener("click", () => el.orderDialog.close());
    el.themeToggle.addEventListener("click", onThemeToggle);
    darkQuery.addEventListener("change", renderTheme);
    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !el.orderDialog.open) closeCart();
    });
  }

  async function loadCatalog() {
    const online = Shop.api ? await Shop.api.detect() : false;
    if (online) {
      try {
        return { products: await Shop.api.getProducts(), mode: "api" };
      } catch {
        return { products: Shop.catalog.products, mode: "static" };
      }
    }
    return { products: Shop.catalog.products, mode: "static" };
  }

  async function boot() {
    renderTheme();
    bindEvents();
    renderScreen();
    store.subscribe(render);
    const { products, mode } = await loadCatalog();
    store.init({ products, mode });
    if (mode === "api") {
      store.setSearchProvider((filters) => Shop.api.getProducts(filters));
    }
  }

  boot();
})(window);
