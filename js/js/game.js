function rollDice() {
  let result = Math.floor(Math.random() * 6) + 1;
  document.getElementById("dice").innerText = result;
}
