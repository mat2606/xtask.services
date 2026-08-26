(function () {
  "use strict";
  const db = window.APP_FIREBASE.db;
  const state = { config: window.safeConfig(), service: null, optionIndex: 0 };
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
    document.title = state.config.brand + " | Sala do Futuro";
    renderSeals(); renderServices(); renderFaqs();
  }

  function renderSeals() {
    const icons = ["✓", "♢", "●"];
    $("#seals").innerHTML = (state.config.seals || []).map((seal, index) => `<div><i>${icons[index % icons.length]}</i><strong>${window.escapeHtml(seal)}</strong></div>`).join("");
  }

  function renderServices() {
    const services = (state.config.services || []).filter((service) => service.active);
    $("#serviceGrid").innerHTML = services.map((service, index) => `<article class="service-card${service.popular ? " popular" : ""}" style="--service:${window.escapeHtml(service.accent || "#725cff")}">${service.popular ? '<b class="popular-badge">MAIS PEDIDO</b>' : ""}<div class="service-top"><i>${window.escapeHtml(service.icon)}</i><span>0${index + 1}</span></div><h3>${window.escapeHtml(service.name)}</h3><p>${window.escapeHtml(service.description)}</p><div class="prices">${(service.options || []).map((option) => `<div><span>✓ ${window.escapeHtml(option.label)}</span><strong>${window.money(option.price)}</strong></div>`).join("")}</div><button class="outline-button" data-service="${window.escapeHtml(service.id)}" type="button">Escolher serviço →</button></article>`).join("");
    document.querySelectorAll("[data-service]").forEach((button) => button.addEventListener("click", () => openOrder(button.dataset.service)));
  }

  function renderFaqs() {
    $("#faqList").innerHTML = (state.config.faqs || []).map((faq, index) => `<details${index === 0 ? " open" : ""}><summary>${window.escapeHtml(faq.question)}<i>+</i></summary><p>${window.escapeHtml(faq.answer)}</p></details>`).join("");
  }

  function openOrder(serviceId) {
    state.service = state.config.services.find((item) => item.id === serviceId); state.optionIndex = 0;
    if (!state.service) return;
    $("#modalTitle").textContent = state.service.name;
    $("#optionList").innerHTML = state.service.options.map((option, index) => `<label class="order-option${index === 0 ? " selected" : ""}"><input type="radio" name="option" value="${index}"${index === 0 ? " checked" : ""}><span>${window.escapeHtml(option.label)}</span><strong>${window.money(option.price)}</strong></label>`).join("");
    document.querySelectorAll('input[name="option"]').forEach((input) => input.addEventListener("change", () => { state.optionIndex = Number(input.value); document.querySelectorAll(".order-option").forEach((label) => label.classList.toggle("selected", label.contains(input) && input.checked)); updateTotal(); }));
    $("#orderModal").classList.add("open"); $("#orderModal").setAttribute("aria-hidden", "false"); document.body.classList.add("no-scroll"); updateTotal();
  }

  function closeOrder() { $("#orderModal").classList.remove("open"); $("#orderModal").setAttribute("aria-hidden", "true"); document.body.classList.remove("no-scroll"); }
  function couponData() { const code = $("#coupon").value.trim().toUpperCase(); return (state.config.coupons || []).find((item) => item.active && item.code.toUpperCase() === code); }
  function totalData() { const option = state.service.options[state.optionIndex]; const coupon = couponData(); const discount = coupon ? Math.round(option.price * coupon.percent / 100) : 0; return { option, coupon, discount, total: Math.max(0, option.price - discount) }; }
  function updateTotal() { if (!state.service) return; const data = totalData(); $("#orderTotal").textContent = window.money(data.total); const value = $("#coupon").value.trim(); $("#couponMessage").textContent = data.coupon ? data.coupon.percent + "% aplicado" : value ? "Cupom não encontrado" : ""; $("#couponMessage").className = data.coupon ? "valid" : ""; }

  async function submitOrder(event) {
    event.preventDefault();
    const name = $("#customerName").value.trim(); const whatsapp = $("#customerWhatsapp").value.replace(/\D/g, "");
    if (name.length < 2 || whatsapp.length < 10) { showToast("Confira seu nome e WhatsApp.", true); return; }
    const data = totalData(); const button = $("#submitOrder"); button.disabled = true; button.textContent = "Registrando pedido...";
    try {
      const orderRef = db.ref("orders").push(); const orderCode = orderRef.key.slice(-6).toUpperCase();
      await orderRef.set({ customerName: name, customerWhatsapp: whatsapp, serviceId: state.service.id, serviceName: state.service.name, optionLabel: data.option.label, basePrice: data.option.price, discount: data.discount, totalPrice: data.total, coupon: data.coupon ? data.coupon.code : "", details: $("#details").value.trim(), status: "novo", createdAt: firebase.database.ServerValue.TIMESTAMP });
      const message = [`Olá! Acabei de fazer o pedido #${orderCode} pelo site.`, `Nome: ${name}`, `Serviço: ${state.service.name} — ${data.option.label}`, `Total: ${window.money(data.total)}`, $("#details").value.trim() ? `Detalhes: ${$("#details").value.trim()}` : ""].filter(Boolean).join("\n");
      const destination = String(state.config.whatsapp || window.APP_FIREBASE.whatsapp).replace(/\D/g, "");
      showToast("Pedido registrado. Abrindo o WhatsApp...");
      window.location.href = `https://wa.me/${destination}?text=${encodeURIComponent(message)}`;
    } catch (error) { console.error(error); showToast("Não foi possível registrar. Confira as regras do Firebase.", true); }
    finally { button.disabled = false; button.textContent = "Enviar pedido pelo WhatsApp →"; }
  }

  $("#year").textContent = new Date().getFullYear();
  $("#themeButton").addEventListener("click", () => { const dark = !document.documentElement.classList.contains("dark"); document.documentElement.classList.toggle("dark", dark); localStorage.setItem("nota-theme", dark ? "dark" : "light"); $("#themeButton").textContent = dark ? "☀" : "☾"; });
  if (localStorage.getItem("nota-theme") === "dark" || (!localStorage.getItem("nota-theme") && matchMedia("(prefers-color-scheme: dark)").matches)) { document.documentElement.classList.add("dark"); $("#themeButton").textContent = "☀"; }
  $("#menuButton").addEventListener("click", () => $("#menu").classList.toggle("open"));
  $("#menu").querySelectorAll("a").forEach((link) => link.addEventListener("click", () => $("#menu").classList.remove("open")));
  document.querySelectorAll("[data-close]").forEach((item) => item.addEventListener("click", closeOrder));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeOrder(); });
  $("#coupon").addEventListener("input", updateTotal); $("#orderForm").addEventListener("submit", submitOrder);
  applyConfig(window.DEFAULT_CONFIG);
  db.ref("config").on("value", (snapshot) => { if (snapshot.exists()) applyConfig(snapshot.val()); }, (error) => { console.warn("Configuração padrão em uso", error); });
})();
