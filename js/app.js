function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(page).classList.add('active');
}

// ouvrir jeu
function openGame() {
  document.getElementById("app").style.display = "none";
  document.getElementById("game").style.display = "block";
}

// fermer jeu
function closeGame() {
  document.getElementById("game").style.display = "none";
  document.getElementById("app").style.display = "block";
}
