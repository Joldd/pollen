/**
 * Reveals the end-of-game column scoring directly on the board: two rows of
 * badges — the opponent's column tally above the flower row, mine below —
 * inserted column by column with a staggered reveal, then the final winner
 * is announced via the status bar.
 */

const COLUMN_DELAY_S = 0.4;

function createBadgeRow(id) {
  const row = document.createElement("div");
  row.className = "pln-cards";
  row.id = id;
  return row;
}

function createBadge(species, score, isWinner, points, delayIndex) {
  const badge = document.createElement("div");
  badge.className = `pln-score-badge ${species}${isWinner ? " pln-score-badge-winner" : ""}`;
  badge.style.animationDelay = `${delayIndex * COLUMN_DELAY_S}s`;
  badge.textContent = score;

  if (isWinner && points > 0) {
    const pointsTag = document.createElement("span");
    pointsTag.className = "pln-score-badge-points";
    pointsTag.textContent = `+${points}`;
    badge.appendChild(pointsTag);
  }

  return badge;
}

function createRowTotal(species, score) {
  const total = document.createElement("div");
  total.className = `pln-score-row-total ${species}`;
  total.textContent = `${_("Total")}: ${score}`;
  return total;
}

// Winner banner, level with the flower row / bin.
function renderWinnerBanner(game, playerNames, winnerPlayerNumber) {
  const board = game.elements.board;
  if (!board) return;

  const banner = document.createElement("div");
  banner.id = "scoreSummary";
  banner.textContent = winnerPlayerNumber
    ? _("Winner 🏆: ${winner}").replace("${winner}", playerNames[winnerPlayerNumber])
    : _("It's a tie!");

  board.appendChild(banner);
}

export function revealColumnScores(
  game,
  { columns, totals, player_names: playerNames, winner_player_number },
) {
  const flowersRow = document.getElementById("flowers");
  if (!flowersRow) return;

  const topRow = createBadgeRow("scoreRowTop");
  const bottomRow = createBadgeRow("scoreRowBottom");
  flowersRow.before(topRow);
  flowersRow.after(bottomRow);

  const myPlayerNumber = game.myPlayerNumber;
  const opponentPlayerNumber = myPlayerNumber === 1 ? 2 : 1;
  const myColor = myPlayerNumber === 1 ? "pln-bee" : "pln-bumblebee";
  const opponentColor = myPlayerNumber === 1 ? "pln-bumblebee" : "pln-bee";

  // Insert in the SAME order (x=1..5 via "afterbegin") as BoardRenderer's
  // grid loop, so a badge ends up under/over the flower cell it belongs to.
  // That insertion order happens to render right-to-left visually, so the
  // reveal delay (left-to-right, x=5 first) is computed separately.
  for (let x = 1; x <= 5; x++) {
    const col = columns[x - 1];
    const myScore = myPlayerNumber === 1 ? col.bee_score : col.bumblebee_score;
    const opponentScore =
      myPlayerNumber === 1 ? col.bumblebee_score : col.bee_score;
    const delayIndex = 5 - x;

    const opponentBadge = createBadge(
      opponentColor,
      opponentScore,
      col.winner === opponentPlayerNumber,
      col.points,
      delayIndex,
    );
    const myBadge = createBadge(
      myColor,
      myScore,
      col.winner === myPlayerNumber,
      col.points,
      delayIndex,
    );

    topRow.insertAdjacentElement("afterbegin", opponentBadge);
    bottomRow.insertAdjacentElement("afterbegin", myBadge);
  }

  const totalDelay = `${5 * COLUMN_DELAY_S}s`;
  const opponentTotal = createRowTotal(opponentColor, totals[opponentPlayerNumber]);
  opponentTotal.style.animationDelay = totalDelay;
  topRow.appendChild(opponentTotal);

  const myTotal = createRowTotal(myColor, totals[myPlayerNumber]);
  myTotal.style.animationDelay = totalDelay;
  bottomRow.appendChild(myTotal);

  const revealDurationMs = (5 * COLUMN_DELAY_S + 0.6) * 1000;
  setTimeout(() => {
    const winnerText = winner_player_number
      ? _("${winner} wins with ${points} points!")
          .replace("${winner}", playerNames[winner_player_number])
          .replace("${points}", totals[winner_player_number])
      : _("It's a tie!");
    game.bga.statusBar.setTitle(winnerText);

    renderWinnerBanner(game, playerNames, winner_player_number);
  }, revealDurationMs);
}
