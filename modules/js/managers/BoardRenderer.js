/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * pollen implementation : © Julien Coutouly julien.coutouly@gmail.com
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * Builds and updates all the DOM for the table: board grid, hands, objective
 * cards, deck counters, opponent info and the bin. Owns `game.elements`,
 * the cache of the main DOM nodes other managers read from.
 */
export class BoardRenderer {
  constructor(game) {
    this.game = game;
  }

  render(gamedatas) {
    const game = this.game;

    game.bga.gameArea.getElement().insertAdjacentHTML(
      "beforeend",
      `
        <div id="opponentHand" class="pln-hand">
          <div id="opponentObjective"></div>
          <div id="opponentCards" class="pln-theCards"></div>
          <div id="opponentDeck"></div>
        </div>
        <div id="board">
          <div id="bin" class="pln-card"></div>
        </div>
        <div id="myHand" class="pln-hand">
          <div id="myObjective"></div>
          <div id="myCards" class="pln-theCards"></div>
          <div id="myDeck"></div>
        </div>
        `,
    );

    game.elements = {
      board: document.getElementById("board"),
      myCards: document.getElementById("myCards"),
      myObjective: document.getElementById("myObjective"),
      myDeck: document.getElementById("myDeck"),
      opponentCards: document.getElementById("opponentCards"),
      opponentObjective: document.getElementById("opponentObjective"),
      opponentDeck: document.getElementById("opponentDeck"),
      bin: document.getElementById("bin"),
    };
    const { board, myCards, myObjective, myDeck, opponentCards, opponentObjective, opponentDeck, bin } =
      game.elements;

    const flowersMap = {};
    gamedatas.flowers.forEach((flower) => {
      flowersMap[`${flower.x}_${flower.y}`] = flower.type;
    });
    for (let y = 1; y <= 7; y++) {
      const row = document.createElement("div");
      row.classList.add("pln-cards");
      if (y === 4) row.id = "flowers";
      board.appendChild(row);

      for (let x = 1; x <= 5; x++) {
        const isFlower = y === 4;
        const key = `${x}_${y}`;
        const flowerType = flowersMap[key] || "";
        const className = isFlower
          ? `pln-flower${flowerType} pln-card`
          : "pln-position pln-card";

        row.insertAdjacentHTML(
          "afterbegin",
          `<div id="card_${x}_${y}" class="${className}"></div>`,
        );
      }
    }

    this.attachObjectiveModal(myObjective);

    // Setting up player boards
    Object.values(gamedatas.players).forEach((player) => {
      game.bga.playerPanels.getElement(player.id).insertAdjacentHTML(
        "beforeend",
        `
                <span id="energy-player-counter-${player.id}"></span> Energy
            `,
      );
      const counter = new ebg.counter();
      counter.create(`energy-player-counter-${player.id}`, {
        value: player.energy,
        playerCounter: "energy",
        playerId: player.id,
      });
    });

    const playerColor = game.myPlayerNumber === 1 ? "pln-bee" : "pln-bumblebee";

    // Display player's hand — a spectator has no real hand data (neither
    // player's cards are visible to them), so their "my hand" renders the
    // same generic way an opponent's hand does: backs + counts.
    if (gamedatas.is_spectator) {
      this.renderMyHandAsSpectator(gamedatas.my_hand_info, playerColor);
    } else {
      for (let card_id in gamedatas.hand) {
        const card = gamedatas.hand[card_id];
        this.addCardToHand(card, playerColor);
      }
    }

    // Display cards on the board
    if (gamedatas.board) {
      gamedatas.board.forEach((card) => {
        const boardX = card.location_arg[0];
        let boardY = card.location_arg[1];

        const isVisible = card.location_arg[2] == 0;
        if (!game.firstPlayer) {
          boardY = 8 - parseInt(boardY); // Mirror Y coordinate for second player
        }
        const cell = document.getElementById(`card_${boardX}_${boardY}`);
        const color = card.type_arg[0] == 1 ? "pln-bee" : "pln-bumblebee";
        const myCard = color === playerColor ? "pln-myCard" : "";
        const number = isVisible ? card.type_arg % 100 : "";
        const cardId = color === playerColor ? "card_" + card.id : "";
        if (cell) {
          const cardDiv = `<div id="${cardId}" class="pln-card pln-${card.type} ${color}${number} ${myCard}">
                         </div>`;
          cell.insertAdjacentHTML("afterbegin", cardDiv);
        }
      });
    }

    // Display objective card
    if (gamedatas.objective) {
      this.displayObjectiveCard(gamedatas.objective);
    }

    const myDeckDiv = `<div class="pln-card ${playerColor}"><div id="my_deck_count">${gamedatas.deckCount}</div></div>`;
    myDeck.insertAdjacentHTML("beforeend", myDeckDiv);
    // Display deck count
    this.updateDeckCounter(gamedatas.deckCount);

    // Display opponent info
    if (gamedatas.opponent) {
      this.updateOpponentInfo(gamedatas.opponent, playerColor);
    }

    // Display last thrown card in the bin
    if (gamedatas.last_thrown) {
      const lastThrownCard = gamedatas.last_thrown;
      const color = lastThrownCard.card_type_arg[0] == 1 ? "pln-bee" : "pln-bumblebee";
      const type =
        lastThrownCard.card_type === "movement"
          ? "Move"
          : lastThrownCard.card_type_arg % 100;
      const cardDiv = `<div class="pln-card pln-${lastThrownCard.card_type} ${color}${type}">
                         </div>`;
      bin.insertAdjacentHTML("afterbegin", cardDiv);
    }

    this.attachTooltips();
  }

  // Static, class/id-based tooltips for graphics whose meaning isn't
  // obvious at a glance. Bound once at setup — BGA's tooltip helpers use
  // event delegation, so they keep working for elements added later
  // (new hand cards, cards flying into the bin, etc.).
  attachTooltips() {
    const game = this.game;
    const tooltips = game.bga.gameui;
    if (!tooltips) return;

    tooltips.addTooltipToClass(
      "pln-movement",
      _("Movement card: move one of your cards on the board instead of playing a new one (1 AP on your side, 2 AP on the opponent's side)"),
      "",
    );
    tooltips.addTooltip("bin", _("Discarded and used cards"), "");
    tooltips.addTooltip("myDeck", _("Your remaining cards to draw"), "");
    tooltips.addTooltip("opponentDeck", _("Opponent's remaining cards to draw"), "");
    tooltips.addTooltip(
      "myObjective",
      _("Your objective card: matching flowers give a bonus point when you win their column. Click to enlarge."),
      "",
    );
  }

  attachObjectiveModal(myObjective) {
    myObjective.addEventListener("click", () => {
      const cardObjective = myObjective.children[0];
      const computedStyle = window.getComputedStyle(cardObjective);
      const bgImage = computedStyle.backgroundImage;
      const imageUrl = bgImage.replace(/url\(['"]?/, "").replace(/['"]?\)/, "");

      const modal = document.createElement("div");
      modal.className = "pln-modal";

      const title = document.createElement("h2");
      title.textContent = "Objective Card";
      modal.appendChild(title);

      const img = document.createElement("img");
      img.src = imageUrl;
      img.style.maxWidth = "90%";
      img.style.maxHeight = "90%";
      modal.appendChild(img);

      document.body.appendChild(modal);

      modal.addEventListener("click", () => {
        modal.remove();
      });

      document.addEventListener(
        "keydown",
        (e) => {
          if (e.key === "Escape") {
            modal.remove();
          }
        },
        { once: true },
      );
    });
  }

  async addCardToHand(card, playerColor) {
    const game = this.game;
    const { myDeck, myCards } = game.elements;

    // Decode card type_arg to get player color and value
    const value = card.type_arg % 100;
    let cardContent = "";
    if (card.type === "number") {
      cardContent = value;
    } else if (card.type === "movement") {
      cardContent = "Move"; // Movement icon
    }

    const cardElement = document.createElement("div");
    cardElement.classList.add(
      "pln-card",
      `pln-${card.type}`,
      playerColor + cardContent,
      "pln-myCard",
    );
    cardElement.id = `card_${card.id}`;

    const onCardSelectHandler = (e) => game.cardInteractions.onCardSelect(e);
    cardElement.cardSelectHandler = onCardSelectHandler;
    cardElement.addEventListener("click", onCardSelectHandler);
    myDeck.appendChild(cardElement);
    await game.slide(cardElement, myCards);
  }

  displayObjectiveCard(card) {
    // card.type_arg contains the objective number (1-10)
    const objectiveNumber = card.type_arg;

    const cardDiv = `<div id="objective_card_${card.id}"
                          class="pln-card pln-objective${objectiveNumber}">
                    </div>`;

    // Place in your objective card zone
    this.game.elements.myObjective.insertAdjacentHTML("beforeend", cardDiv);
  }

  updateDeckCounter(count) {
    this.setDeckDisplay(this.game.elements.myDeck, count);
  }

  updateOpponentDeckCounter(count) {
    this.setDeckDisplay(this.game.elements.opponentDeck, count);
  }

  // Once a deck is empty there's nothing left to show: clear the pile
  // instead of leaving a stale card back with a "0" badge on it.
  setDeckDisplay(deckContainer, count) {
    if (count <= 0) {
      deckContainer.innerHTML = "";
      return;
    }
    const countBadge = deckContainer.querySelector('[id$="_deck_count"]');
    if (countBadge) {
      countBadge.textContent = count;
    }
  }

  // Spectator-only: "my hand" has no real cards to show, so render it like
  // an opponent's hand (backs + count) instead of leaving it empty. The
  // deck pile itself is already handled generically via gamedatas.deckCount.
  renderMyHandAsSpectator(handInfo, playerColor) {
    const { myCards, myObjective } = this.game.elements;
    for (let i = 0; i < handInfo.hand_count; i++) {
      myCards.insertAdjacentHTML("beforeend", `<div class="pln-card ${playerColor}"></div>`);
    }
    if (handInfo.has_objective) {
      myObjective.insertAdjacentHTML("beforeend", `<div class="pln-card pln-objectiveBack"></div>`);
    }
  }

  updateOpponentInfo(opponentData, playerColor) {
    const { opponentCards, opponentDeck, opponentObjective } = this.game.elements;
    const opponentColor = playerColor === "pln-bee" ? "pln-bumblebee" : "pln-bee";
    for (let i = 0; i < opponentData.hand_count; i++) {
      const cardDiv = `<div class="pln-card ${opponentColor}"></div>`;
      opponentCards.insertAdjacentHTML("beforeend", cardDiv);
    }
    const deckDiv = `<div class="pln-card ${opponentColor}"><div id="opponent_deck_count">${opponentData.deck_count}</div></div>`;
    opponentDeck.insertAdjacentHTML("beforeend", deckDiv);

    const objective = `<div class="pln-card pln-objectiveBack"></div>`;
    opponentObjective.insertAdjacentHTML("beforeend", objective);
  }

  flipCardFaceDown(cardElement, deckClass) {
    return new Promise((resolve) => {
      cardElement.classList.add("pln-card-flipping");

      // At the halfway point of the animation, switch the card face to the back
      setTimeout(() => {
        // Remove all specific card classes (e.g., pln-bee3, pln-bee2...)
        // and add the back class (e.g., pln-bee)
        const cardClasses = [...cardElement.classList];
        cardClasses.forEach((cls) => {
          if (cls !== deckClass && cls.startsWith(deckClass)) {
            cardElement.classList.remove(cls);
          }
        });
        cardElement.classList.add(deckClass); // add 'pln-bee'
      }, 300); // 300ms = half of 600ms

      cardElement.addEventListener(
        "animationend",
        () => {
          cardElement.classList.remove("pln-card-flipping");
          resolve();
        },
        { once: true },
      );
    });
  }

  flipCardFaceUp(cardElement, backClass, revealedClass) {
    return new Promise((resolve) => {
      cardElement.classList.add("pln-card-flipping");

      // At the halfway point of the animation, reveal the true face
      setTimeout(() => {
        cardElement.classList.remove(backClass);
        cardElement.classList.add(revealedClass);
      }, 300); // 300ms = half of 600ms

      cardElement.addEventListener(
        "animationend",
        () => {
          cardElement.classList.remove("pln-card-flipping");
          resolve();
        },
        { once: true },
      );
    });
  }

  async throwCardToBin() {
    const game = this.game;
    if (!game.cardSelected) {
      return;
    }

    const cardElement = game.cardSelected;
    const binElement = game.elements.bin;

    await game.slide(cardElement, binElement);
  }
}
