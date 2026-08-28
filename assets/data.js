(function () {
  "use strict";

  const services = [
    { id: "tarefa-sp", name: "Tarefa SP", description: "Atividades pesquisadas, realizadas e revisadas manualmente.", icon: "✓", accent: "#18bc75", active: true, popular: true, videoUrl: "", options: [{ label: "Por atividade", price: 99 }, { label: "Todas as disponíveis", price: 499 }] },
    { id: "redacao-paulista", name: "Redação Paulista", description: "Produção manual com pesquisa de apoio e revisão.", icon: "✎", accent: "#d94df0", active: true, popular: false, videoUrl: "", options: [{ label: "Por redação", price: 999 }] },
    { id: "leia-sp", name: "LeiaSP", description: "Leitura, pesquisa e respostas feitas manualmente.", icon: "L", accent: "#ffb224", active: true, popular: false, videoUrl: "", options: [{ label: "Por livro", price: 1499 }] },
    { id: "speak", name: "SPEak", description: "Unidades concluídas manualmente, com opção de certificado.", icon: "S", accent: "#64a8ff", active: true, popular: false, videoUrl: "", options: [{ label: "Por unidade", price: 499 }, { label: "Completo + certificado", price: 999 }] },
    { id: "khan-academy", name: "Khan Academy", description: "Resolução manual de unidades ou do bimestre completo.", icon: "K", accent: "#13c2a3", active: true, popular: false, videoUrl: "", options: [{ label: "Por unidade", price: 499 }, { label: "3º bimestre completo", price: 999 }] },
    { id: "expansao-noturno", name: "Expansão Noturno", description: "Atividades feitas à mão, por disciplina ou em conjunto.", icon: "☾", accent: "#ffc857", active: true, popular: false, videoUrl: "", options: [{ label: "Por disciplina", price: 899 }, { label: "Todas disponíveis", price: 1499 }] }
  ];

  window.DEFAULT_CONFIG = {
    brand: "XTask",
    heroEyebrow: "ECONOMIZE TEMPO • EXECUÇÃO MANUAL",
    heroTitle: "Falta tempo? A XTask agiliza suas tarefas.",
    heroSubtitle: "Enquanto você cuida do que importa, cada atividade é pesquisada, realizada e revisada manualmente. Sem robôs, sem automações e sem scripts.",
    announcement: "Pedidos abertos • Atendimento todos os dias",
    whatsapp: "5511974984104",
    accent: "#725cff",
    services: services,
    coupons: [{ code: "PRIMEIRA10", percent: 10, active: true }],
    seals: ["Execução 100% manual", "Pesquisa e revisão", "Mais tempo para você"],
    faqs: [
      { question: "Como faço meu pedido?", answer: "Escolha um serviço, selecione o pacote e preencha seus dados. O pedido será registrado e a conversa continuará no WhatsApp." },
      { question: "Quando começa o serviço?", answer: "Depois da análise dos detalhes e da sua confirmação pelo WhatsApp." },
      { question: "A XTask usa scripts?", answer: "Não. Cada tarefa é feita manualmente, com pesquisa de apoio e revisão. Não utilizamos scripts, robôs ou automações para executar as atividades." },
      { question: "Como o trabalho é realizado?", answer: "Primeiro lemos as instruções, depois pesquisamos o conteúdo, realizamos a atividade manualmente e revisamos antes da finalização." },
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
