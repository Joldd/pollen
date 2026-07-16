/**
 * Reaction to cometD notifications sent by pollen.game.php (via
 * notifyAllPlayers / notifyPlayer). Each function mirrors a `notif_xxx`
 * name and receives the Game instance plus the notification args.
 */

import { revealColumnScores } from "./ScoreSummary.js";

// game.gamedatas.board is only populated once at setup(); keep it in sync as
// cards move so later lookups (getCardByCoordinates, flippable highlighting)
// don't act on stale positions/visibility.
function upsertBoardCard(game, card, locationArg) {
  const board = game.gamedatas.board;
  const entry = { ...card, location_arg: locationArg };
  const index = board.findIndex((c) => c.id == card.id);
  if (index === -1) {
    board.push(entry);
  } else {
    board[index] = entry;
  }
}

// Finds the DOM element representing a card that's still sitting in a hand
// (about to fly to the board/bin/etc). Real players have a real, addressable
// element (id="card_<id>") only for their OWN cards — the opponent's hand is
// always generic placeholders. A spectator never has real card data for
// EITHER side, so both are placeholders there. Returns null if nothing usable
// was found.
function resolveHandCardElement(game, ownerPlayerNumber, cardId) {
  const isMine = ownerPlayerNumber == game.myPlayerNumber;

  if (isMine && !game.isSpectator) {
    return { element: document.getElementById(`card_${cardId}`), isPlaceholder: false };
  }

  const container = isMine ? game.elements.myCards : game.elements.opponentCards;
  return { element: container?.children[0], isPlaceholder: true };
}

export async function cardPlayed(game, args) {
  const { card, x, y, remaining_ap, is_hide, playable_positions } = args;

  game.playable_positions = playable_positions; // Update playable positions after a card is played
  game.remaining_ap = remaining_ap; // Update remaining action points
  upsertBoardCard(game, card, `${x}${y}${is_hide ? 1 : 0}`);

  // Get the target cell on the board
  let newY = y;
  if (!game.firstPlayer) {
    newY = 8 - parseInt(y); // Mirror Y coordinate for second player
  }
  const targetCell = document.getElementById(`card_${x}_${newY}`);
  if (!targetCell) {
    console.error("Target cell not found:", `card_${x}_${newY}`);
    return;
  }

  const color = card.type_arg[0] == 1 ? "bee" : "bumblebee";
  const { element: cardElement, isPlaceholder } = resolveHandCardElement(
    game,
    card.type_arg[0],
    card.id,
  );

  if (!cardElement) {
    console.error("Card element not found for cardPlayed:", card.id);
    return;
  }

  if (isPlaceholder) {
    if (!is_hide) {
      cardElement.classList.remove(color); // Remove the back class (e.g., bee)
      cardElement.classList.add(color + (card.type_arg % 100)); // e.g., bee3, bumblebee2...
    }
    await game.slide(cardElement, targetCell);
  } else {
    if (cardElement.cardSelectHandler) {
      cardElement.removeEventListener("click", cardElement.cardSelectHandler);
      delete cardElement.cardSelectHandler;
    }

    // Animate the card moving from hand to board
    await game.slide(cardElement, targetCell);
    if (is_hide) {
      // Flip the card face down after moving it to the board
      await game.boardRenderer.flipCardFaceDown(cardElement, color);
    }
  }
}

export async function cardMoved(game, args) {
  const {
    cardToMove,
    cardMovement,
    cardToSwap,
    x,
    y,
    playable_positions,
    remaining_ap,
    old_x,
    old_y,
  } = args;

  const color = cardToMove.type_arg[0] == 1 ? "bee" : "bumblebee";

  game.playable_positions = playable_positions; // Update playable positions after a card is moved
  game.remaining_ap = remaining_ap; // Update remaining action points

  upsertBoardCard(game, cardToMove, `${x}${y}${cardToMove.location_arg[2]}`);
  if (cardToSwap) {
    upsertBoardCard(
      game,
      cardToSwap,
      `${old_x}${old_y}${cardToSwap.location_arg[2]}`,
    );
  }

  // Get the target cell on the board
  let realOldY = old_y;
  let realY = y;
  if (!game.firstPlayer) {
    realOldY = 8 - parseInt(old_y); // Mirror Y coordinate for second player
    realY = 8 - parseInt(y); // Mirror Y coordinate for second player
  }
  const cardElement = document.getElementById(`card_${old_x}_${realOldY}`)
    .children[0]; // Assuming the card to move is the first child of the cell
  const targetCell = document.getElementById(`card_${x}_${realY}`);

  if (!cardElement) {
    console.error("Card element not found:", `card_${old_x}_${realOldY}`);
    return;
  }
  // Animate the card moving from hand to board
  if (!cardToSwap)
    await game.slide(cardElement, targetCell);
  else {
    const cardToSwapX = cardToSwap.location_arg[0];
    let cardToSwapY = cardToSwap.location_arg[1];
    const cardToMoveX = cardMovement.location_arg[0];
    let cardToMoveY = cardMovement.location_arg[1];
    if (!game.firstPlayer) {
      cardToSwapY = 8 - parseInt(cardToSwapY); // Mirror Y coordinate for second player
      cardToMoveY = 8 - parseInt(cardToMoveY); // Mirror Y coordinate for second player
    }
    const cardToSwapElement = document.getElementById(
      `card_${cardToSwapX}_${cardToSwapY}`,
    ).children[0];
    const cardToMoveElement = document.getElementById(
      `card_${cardToMoveX}_${cardToMoveY}`,
    ).children[0];
    const targetSwap = cardToSwapElement.parentElement;
    const targetMove = cardElement.parentElement;
    await game.slide(cardElement, targetSwap);
    await game.slide(cardToSwapElement, targetMove);
  }

  // Throw the card movement to the bin
  let bin = document.getElementById("bin");
  const { element: cardElementMovement, isPlaceholder } = resolveHandCardElement(
    game,
    cardMovement.type_arg[0],
    cardMovement.id,
  );
  if (!cardElementMovement) {
    console.error("Card element not found:", `card_${cardMovement.id}`);
    return;
  }
  if (isPlaceholder) {
    cardElementMovement.classList.remove(color); // Remove the back class (e.g., bee)
    cardElementMovement.classList.add(color + "Move"); // movement card
  }

  // Animate the card moving from board to bin
  await game.slide(cardElementMovement, bin);
}

export async function cardsDrawn(game, args) {
  game.boardRenderer.updateDeckCounter(args.deck_count);
  if (args.cards.length > 0) {
    const color = args.cards[0].type_arg[0] == 1 ? "bee" : "bumblebee";
    args.cards.forEach(async (card) => {
      await game.boardRenderer.addCardToHand(card, color);
    });
  }
}

export async function cardsDrawnOpponent(game, args) {
  if (game.playerTurn.isCurrentPlayerActive) {
    return;
  }

  // For a real player this is always the opponent (their own draw arrives
  // via the private "cardsDrawn" notification instead, which returns above).
  // A spectator has no such private notification for either side, so this
  // must pick the correct section based on who actually drew.
  const isMine = args.player_number == game.myPlayerNumber;
  const deckEl = isMine ? game.elements.myDeck : game.elements.opponentDeck;
  const cardsEl = isMine ? game.elements.myCards : game.elements.opponentCards;

  if (args.count > 0) {
    const backColor = deckEl.children[0].classList.contains("bumblebee")
      ? "bumblebee"
      : "bee";
    for (let i = 0; i < args.count; i++) {
      const cardElement = document.createElement("div");
      cardElement.classList.add("card", backColor);
      deckEl.appendChild(cardElement);
      await game.slide(cardElement, cardsEl);
    }
  }

  // Update (and possibly clear) the deck pile only after the fly-in
  // animations above have used it as their source.
  if (isMine) {
    game.boardRenderer.updateDeckCounter(args.deck_count);
  } else {
    game.boardRenderer.updateOpponentDeckCounter(args.deck_count);
  }
}

export async function cardThrown(game, args) {
  const { card } = args;
  const color = card.type_arg[0] == 1 ? "bee" : "bumblebee";
  let bin = document.getElementById("bin");
  if (!bin) {
    console.error("Bin element not found");
    return;
  }

  const { element: cardElement, isPlaceholder } = resolveHandCardElement(
    game,
    card.type_arg[0],
    card.id,
  );
  if (!cardElement) {
    console.error("Card element not found:", `card_${card.id}`);
    return;
  }
  if (isPlaceholder) {
    const type = card.type === "movement" ? "Move" : card.type_arg % 100;
    cardElement.classList.remove(color); // Remove the back class (e.g., bee)
    cardElement.classList.add(color + type); // e.g., bee3, bumblebee2...
  }

  // Animate the card moving from board to bin
  await game.slide(cardElement, bin);
}

export async function cardFlipped(game, args) {
  const { card, x, y, remaining_ap, playable_positions } = args;

  game.remaining_ap = remaining_ap;
  game.playable_positions = playable_positions;
  upsertBoardCard(game, card, `${x}${y}0`);

  let cellY = y;
  if (!game.firstPlayer) {
    cellY = 8 - parseInt(y); // Mirror Y coordinate for second player
  }
  const cell = document.getElementById(`card_${x}_${cellY}`);
  const cardElement = cell?.children[0];
  if (!cardElement) {
    console.error("Card element not found for flip:", `card_${x}_${cellY}`);
    return;
  }

  const color = card.type_arg[0] == 1 ? "bee" : "bumblebee";
  const value = card.type_arg % 100;

  await game.boardRenderer.flipCardFaceUp(cardElement, color, color + value);
}

export async function scoreComputed(game, args) {
  const { board, objectives } = args;

  // Reveal any card still marked face-down with its true value before
  // showing the score breakdown.
  const flips = [];
  board.forEach((card) => {
    if (card.location_arg[2] != 1) return; // already face up

    const x = parseInt(card.location_arg[0]);
    let y = parseInt(card.location_arg[1]);
    if (!game.firstPlayer) {
      y = 8 - y; // Mirror Y coordinate for second player
    }
    const cell = document.getElementById(`card_${x}_${y}`);
    const cardElement = cell?.children[0];
    if (!cardElement) return;

    const color = card.type_arg[0] == 1 ? "bee" : "bumblebee";
    const value = card.type_arg % 100;
    flips.push(game.boardRenderer.flipCardFaceUp(cardElement, color, color + value));
  });

  // Reveal the opponent's objective card, still shown as its back. A
  // spectator never saw either objective face-up, so reveal both for them.
  const opponentPlayerNumber = game.myPlayerNumber === 1 ? 2 : 1;
  const playerNumbersToReveal = game.isSpectator
    ? [game.myPlayerNumber, opponentPlayerNumber]
    : [opponentPlayerNumber];

  playerNumbersToReveal.forEach((playerNumber) => {
    const isMine = playerNumber == game.myPlayerNumber;
    const container = isMine ? game.elements.myObjective : game.elements.opponentObjective;
    const objectiveCard = container?.querySelector(".card.objectiveBack");
    const objectiveType = objectives[playerNumber];
    if (objectiveCard && objectiveType != null) {
      flips.push(
        game.boardRenderer.flipCardFaceUp(
          objectiveCard,
          "objectiveBack",
          `objective${objectiveType}`,
        ),
      );
    }
  });

  await Promise.all(flips);

  revealColumnScores(game, args);
}
