(function () {
  "use strict";

  const services = [
    { id: "tarefa-sp", name: "Tarefa SP", description: "Atividades realizadas com atenção e correção.", icon: "✓", accent: "#18bc75", active: true, popular: true, options: [{ label: "Por atividade", price: 99 }, { label: "Todas as disponíveis", price: 499 }] },
    { id: "redacao-paulista", name: "Redação Paulista", description: "Envie a foto do caderno durante o atendimento.", icon: "✎", accent: "#d94df0", active: true, popular: false, options: [{ label: "Por redação", price: 999 }] },
    { id: "leia-sp", name: "LeiaSP", description: "Livro completo com respostas das perguntas.", icon: "L", accent: "#ffb224", active: true, popular: false, options: [{ label: "Por livro", price: 1499 }] },
    { id: "speak", name: "SPEak", description: "Unidades concluídas com opção de certificado.", icon: "S", accent: "#64a8ff", active: true, popular: false, options: [{ label: "Por unidade", price: 499 }, { label: "Completo + certificado", price: 999 }] },
    { id: "khan-academy", name: "Khan Academy", description: "Unidades ou o 3º bimestre completo.", icon: "K", accent: "#13c2a3", active: true, popular: false, options: [{ label: "Por unidade", price: 499 }, { label: "3º bimestre completo", price: 999 }] },
    { id: "expansao-noturno", name: "Expansão Noturno", description: "Escolha uma disciplina ou todas disponíveis.", icon: "☾", accent: "#ffc857", active: true, popular: false, options: [{ label: "Por disciplina", price: 899 }, { label: "Todas disponíveis", price: 1499 }] }
  ];

  window.DEFAULT_CONFIG = {
    brand: "Nota Certa",
    heroEyebrow: "ATENDIMENTO RÁPIDO E SEGURO",
    heroTitle: "Suas tarefas em dia, sem complicação.",
    heroSubtitle: "Escolha o serviço, envie os detalhes e receba a confirmação direto no WhatsApp. Preço claro antes de pedir.",
    announcement: "Pedidos abertos • Atendimento todos os dias",
    whatsapp: "5511974984104",
    accent: "#725cff",
    services: services,
    coupons: [{ code: "PRIMEIRA10", percent: 10, active: true }],
    seals: ["Pedido registrado", "Preço transparente", "Atendimento no WhatsApp"],
    faqs: [
      { question: "Como faço meu pedido?", answer: "Escolha um serviço, selecione o pacote e preencha seus dados. O pedido será registrado e a conversa continuará no WhatsApp." },
      { question: "Quando começa o serviço?", answer: "Depois da análise dos detalhes e da sua confirmação pelo WhatsApp." },
      { question: "Posso usar cupom?", answer: "Sim. Digite o código no pedido e o desconto aparecerá antes do envio." }
    ]
  };

  window.money = function (cents) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(cents || 0) / 100);
  };

  window.safeConfig = function (value) {
    return value && typeof value === "object" ? Object.assign({}, window.DEFAULT_CONFIG, value) : JSON.parse(JSON.stringify(window.DEFAULT_CONFIG));
  };

  window.escapeHtml = function (value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char];
    });
  };
})();
