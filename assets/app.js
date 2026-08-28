(function () {
  "use strict";
  const db = window.APP_FIREBASE.db;
  const state = { config: window.safeConfig(), service: null, optionIndex: 0, items: [] };
  const $ = (selector) => document.querySelector(selector);

  function showToast(message, error) {
    const toast = $("#toast"); toast.textContent = message; toast.className = "toast show" + (error ? " error" : "");
    clearTimeout(showToast.timer); showToast.timer = setTimeout(() => { toast.className = "toast"; }, 3800);
  }

  function applyConfig(config) {
    state.config = window.safeConfig(config);
    document.documentElement.style.setProperty("--accent", state.config.accent || "#725cff");
    $("#brand").textContent = state.config.brand; $("#footerBrand").textContent = state.config.brand;
    $("#announcement").textContent = state.config.announcement; $("#heroEyebrow").textContent = "✦ " + state.config.heroEyebrow;
    $("#heroTitle").textContent = state.config.heroTitle; $("#heroSubtitle").textContent = state.config.heroSubtitle;
    $("#siteFavicon").href = state.config.faviconUrl || window.APP_FIREBASE.faviconUrl;
    document.title = state.config.brand + " | Sala do Futuro";
    renderSeals(); renderServices(); renderFaqs();
  }

  function renderSeals() {
    const icons = ["✓", "♢", "●"];
    $("#seals").innerHTML = (state.config.seals || []).map((seal, index) => `<div><i>${icons[index % icons.length]}</i><strong>${window.escapeHtml(seal)}</strong></div>`).join("");
  }

  function renderServices() {
    const services = (state.config.services || []).filter((service) => service.active);
    $("#serviceGrid").innerHTML = services.map((service, index) => `<article class="service-card${service.popular ? " popular" : ""}" style="--service:${window.escapeHtml(service.accent || "#725cff")}">${service.popular ? '<b class="popular-badge">MAIS PEDIDO</b>' : ""}<div class="service-top"><i>${window.escapeHtml(service.icon)}</i><span>0${index + 1}</span></div><h3>${window.escapeHtml(service.name)}</h3><p>${window.escapeHtml(service.description)}</p><div class="prices">${(service.options || []).map((option) => `<div><span>✓ ${window.escapeHtml(option.label)}</span><strong>${window.money(option.price)}</strong></div>`).join("")}</div><button class="outline-button" data-service="${window.escapeHtml(service.id)}" type="button">＋ Adicionar ao pedido</button></article>`).join("");
    document.querySelectorAll("[data-service]").forEach((button) => button.addEventListener("click", () => openAdd(button.dataset.service)));
  }

  function renderFaqs() {
    $("#faqList").innerHTML = (state.config.faqs || []).map((faq, index) => `<details${index === 0 ? " open" : ""}><summary>${window.escapeHtml(faq.question)}<i>+</i></summary><p>${window.escapeHtml(faq.answer)}</p></details>`).join("");
  }

  function openModal(id) { $(id).classList.add("open"); $(id).setAttribute("aria-hidden", "false"); document.body.classList.add("no-scroll"); }
  function closeModal(id) { $(id).classList.remove("open"); $(id).setAttribute("aria-hidden", "true"); if (!document.querySelector(".modal.open")) document.body.classList.remove("no-scroll"); }

  function openAdd(serviceId) {
    state.service = state.config.services.find((item) => item.id === serviceId); state.optionIndex = 0;
    if (!state.service || !state.service.options.length) return;
    $("#addModalTitle").textContent = state.service.name;
    $("#itemQuantity").value = "1";
    $("#optionList").innerHTML = state.service.options.map((option, index) => `<label class="order-option${index === 0 ? " selected" : ""}"><input type="radio" name="option" value="${index}"${index === 0 ? " checked" : ""}><span>${window.escapeHtml(option.label)}</span><strong>${window.money(option.price)}</strong></label>`).join("");
    document.querySelectorAll('input[name="option"]').forEach((input) => input.addEventListener("change", () => { state.optionIndex = Number(input.value); document.querySelectorAll(".order-option").forEach((label) => label.classList.toggle("selected", label.contains(input) && input.checked)); }));
    closeModal("#orderModal"); openModal("#addModal");
  }

  function quantityValue() { return Math.min(99, Math.max(1, Number($("#itemQuantity").value) || 1)); }

  function addItem() {
    if (!state.service) return;
    const option = state.service.options[state.optionIndex]; const quantity = quantityValue();
    const existing = state.items.find((item) => item.serviceId === state.service.id && item.optionLabel === option.label && item.unitPrice === Number(option.price));
    if (existing) existing.quantity = Math.min(99, existing.quantity + quantity);
    else state.items.push({ serviceId: state.service.id, serviceName: state.service.name, optionLabel: option.label, unitPrice: Number(option.price), quantity: quantity });
    closeModal("#addModal"); renderOrder(); showToast(`${state.service.name} adicionado ao pedido.`);
  }

  function subtotal() { return state.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0); }
  function couponData() { const code = $("#coupon").value.trim().toUpperCase(); return (state.config.coupons || []).find((item) => item.active && item.code.toUpperCase() === code); }
  function totalData() { const basePrice = subtotal(); const coupon = couponData(); const discount = coupon ? Math.round(basePrice * coupon.percent / 100) : 0; return { basePrice, coupon, discount, total: Math.max(0, basePrice - discount) }; }

  function renderOrder() {
    const totalQuantity = state.items.reduce((sum, item) => sum + item.quantity, 0);
    $("#orderDock").classList.toggle("show", state.items.length > 0);
    $("#dockCount").textContent = totalQuantity + (totalQuantity === 1 ? " item adicionado" : " itens adicionados");
    $("#dockTotal").textContent = window.money(subtotal());
    $("#selectedItems").innerHTML = state.items.length ? state.items.map((item, index) => `<article class="selected-item"><div><strong>${window.escapeHtml(item.serviceName)}</strong><small>${window.escapeHtml(item.optionLabel)} · ${window.money(item.unitPrice)} cada</small></div><div class="selected-item-actions"><span>${item.quantity}×</span><strong>${window.money(item.unitPrice * item.quantity)}</strong><button type="button" data-remove-item="${index}" aria-label="Remover item">×</button></div></article>`).join("") : '<div class="empty-order">Nenhum serviço adicionado.</div>';
    document.querySelectorAll("[data-remove-item]").forEach((button) => button.addEventListener("click", () => { state.items.splice(Number(button.dataset.removeItem), 1); renderOrder(); if (!state.items.length) closeModal("#orderModal"); }));
    $("#submitOrder").disabled = !state.items.length;
    updateTotal();
  }

  function updateTotal() {
    const data = totalData(); $("#orderTotal").textContent = window.money(data.total); const value = $("#coupon").value.trim();
    $("#couponMessage").textContent = data.coupon ? data.coupon.percent + "% aplicado" : value ? "Cupom não encontrado" : ""; $("#couponMessage").className = data.coupon ? "valid" : "";
  }

  function openOrder() { if (!state.items.length) { showToast("Adicione pelo menos um serviço.", true); return; } renderOrder(); openModal("#orderModal"); }

  async function submitOrder(event) {
    event.preventDefault();
    const name = $("#customerName").value.trim(); const whatsapp = $("#customerWhatsapp").value.replace(/\D/g, "");
    if (!state.items.length) { showToast("Adicione pelo menos um serviço.", true); return; }
    if (name.length < 2 || whatsapp.length < 10) { showToast("Confira seu nome e WhatsApp.", true); return; }
    const data = totalData(); const button = $("#submitOrder"); const details = $("#details").value.trim(); button.disabled = true; button.textContent = "Registrando pedido...";
    const items = state.items.map((item) => Object.assign({}, item, { lineTotal: item.unitPrice * item.quantity }));
    try {
      const orderRef = db.ref("orders").push(); const orderCode = orderRef.key.slice(-6).toUpperCase();
      await orderRef.set({ customerName: name, customerWhatsapp: whatsapp, serviceId: items.length === 1 ? items[0].serviceId : "pedido-multiplo", serviceName: items.length === 1 ? items[0].serviceName : items.length + " serviços", optionLabel: items.length === 1 ? items[0].optionLabel : "Pedido com vários serviços", items: items, basePrice: data.basePrice, discount: data.discount, totalPrice: data.total, coupon: data.coupon ? data.coupon.code : "", details: details, status: "novo", schemaVersion: 2, createdAt: Date.now() });
      const itemLines = items.map((item, index) => `${index + 1}. ${item.serviceName} — ${item.optionLabel} (${item.quantity}×) — ${window.money(item.lineTotal)}`);
      const message = [`Olá! Acabei de fazer o pedido #${orderCode} pelo site.`, `Nome: ${name}`, "", "Serviços:", ...itemLines, "", `Subtotal: ${window.money(data.basePrice)}`, data.coupon ? `Cupom ${data.coupon.code}: -${window.money(data.discount)}` : "", `Total: ${window.money(data.total)}`, details ? `Detalhes: ${details}` : ""].filter(Boolean).join("\n");
      const destination = String(state.config.whatsapp || window.APP_FIREBASE.whatsapp).replace(/\D/g, "");
      state.items = []; renderOrder(); showToast("Pedido registrado. Abrindo o WhatsApp...");
      window.location.href = `https://wa.me/${destination}?text=${encodeURIComponent(message)}`;
    } catch (error) { console.error(error); const denied = String(error && (error.code || error.message) || "").toLowerCase().includes("permission"); showToast(denied ? "Pedido bloqueado pelo Firebase. Publique as regras incluídas no ZIP." : "Não foi possível registrar o pedido. Tente novamente.", true); }
    finally { button.disabled = false; button.textContent = "Enviar tudo pelo WhatsApp →"; }
  }

  $("#year").textContent = new Date().getFullYear();
  $("#themeButton").addEventListener("click", () => { const dark = !document.documentElement.classList.contains("dark"); document.documentElement.classList.toggle("dark", dark); localStorage.setItem("nota-theme", dark ? "dark" : "light"); $("#themeButton").textContent = dark ? "☀" : "☾"; });
  if (localStorage.getItem("nota-theme") === "dark" || (!localStorage.getItem("nota-theme") && matchMedia("(prefers-color-scheme: dark)").matches)) { document.documentElement.classList.add("dark"); $("#themeButton").textContent = "☀"; }
  $("#menuButton").addEventListener("click", () => $("#menu").classList.toggle("open"));
  $("#menu").querySelectorAll("a").forEach((link) => link.addEventListener("click", () => $("#menu").classList.remove("open")));
  document.querySelectorAll("[data-close-add]").forEach((item) => item.addEventListener("click", () => closeModal("#addModal")));
  document.querySelectorAll("[data-close-order]").forEach((item) => item.addEventListener("click", () => closeModal("#orderModal")));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeModal("#addModal"); closeModal("#orderModal"); } });
  $("#quantityMinus").addEventListener("click", () => { $("#itemQuantity").value = String(Math.max(1, quantityValue() - 1)); });
  $("#quantityPlus").addEventListener("click", () => { $("#itemQuantity").value = String(Math.min(99, quantityValue() + 1)); });
  $("#itemQuantity").addEventListener("change", () => $("#itemQuantity").value = String(quantityValue()));
  $("#addItem").addEventListener("click", addItem); $("#reviewOrder").addEventListener("click", openOrder); $("#addMore").addEventListener("click", () => { closeModal("#orderModal"); document.querySelector("#servicos").scrollIntoView({ behavior: "smooth" }); });
  $("#coupon").addEventListener("input", updateTotal); $("#orderForm").addEventListener("submit", submitOrder);
  applyConfig(window.DEFAULT_CONFIG); renderOrder();
  db.ref("config").on("value", (snapshot) => { if (snapshot.exists()) applyConfig(snapshot.val()); }, (error) => { console.warn("Configuração padrão em uso", error); });
})();
