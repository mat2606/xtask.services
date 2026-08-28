(function () {
  "use strict";

  const firebaseConfig = {
    apiKey: "AIzaSyDrFzBVcyVqbrRnocbv6EgLiLhmsezZq10",
    authDomain: "nimaflix-2fccc.firebaseapp.com",
    databaseURL: "https://nimaflix-2fccc-default-rtdb.firebaseio.com",
    projectId: "nimaflix-2fccc",
    storageBucket: "nimaflix-2fccc.firebasestorage.app",
    messagingSenderId: "683940420467",
    appId: "1:683940420467:web:ad09222032efd79e11c306",
    measurementId: "G-T3WNC532RD"
  };

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  try { firebase.analytics(); } catch (_) { /* Analytics pode não funcionar em localhost. */ }

  window.APP_FIREBASE = {
    db: firebase.database(),
    auth: firebase.auth(),
    storage: typeof firebase.storage === "function" ? firebase.storage() : null,
    adminEmail: "mp1589530@gmail.com",
    whatsapp: "5511974984104"
  };
})();
