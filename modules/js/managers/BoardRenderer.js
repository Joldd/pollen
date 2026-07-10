/**
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
        <div id="opponentHand" class="hand">
          <div id="opponentObjective"></div>
          <div id="opponentCards" class="theCards"></div>
          <div id="opponentDeck"></div>
        </div>
        <div id="board">
          <div id="bin" class="card"></div>
        </div>
        <div id="myHand" class="hand">
          <div id="myObjective"></div>
          <div id="myCards" class="theCards"></div>
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
      row.classList.add("cards");
      if (y === 4) row.id = "flowers";
      board.appendChild(row);

      for (let x = 1; x <= 5; x++) {
        const isFlower = y === 4;
        const key = `${x}_${y}`;
        const flowerType = flowersMap[key] || "";
        const className = isFlower
          ? `flower${flowerType} card`
          : "position card";

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

    const playerColor = game.myPlayerNumber === 1 ? "bee" : "bumblebee";

    // Display player's hand
    for (let card_id in gamedatas.hand) {
      const card = gamedatas.hand[card_id];
      this.addCardToHand(card, playerColor);
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
        const color = card.type_arg[0] == 1 ? "bee" : "bumblebee";
        const myCard = color === playerColor ? "myCard" : "";
        const number = isVisible ? card.type_arg % 100 : "";
        const cardId = color === playerColor ? "card_" + card.id : "";
        if (cell) {
          const cardDiv = `<div id="${cardId}" class="card ${card.type} ${color}${number} ${myCard}">
                         </div>`;
          cell.insertAdjacentHTML("afterbegin", cardDiv);
        }
      });
    }

    // Display objective card
    if (gamedatas.objective) {
      this.displayObjectiveCard(gamedatas.objective);
    }

    const myDeckDiv = `<div class="card ${playerColor}"><div id="my_deck_count">${gamedatas.deckCount}</div></div>`;
    myDeck.insertAdjacentHTML("beforeend", myDeckDiv);
    // Display deck count
    this.updateDeckCounter(gamedatas.deckCount);

    // Display opponent info
    if (gamedatas.opponent) {
      this.updateOpponentInfo(gamedatas.opponent, playerColor);
    }

    // Display last thrown card in the bin
    console.log("Last thrown card:", gamedatas.last_thrown);
    if (gamedatas.last_thrown) {
      const lastThrownCard = gamedatas.last_thrown;
      const color = lastThrownCard.card_type_arg[0] == 1 ? "bee" : "bumblebee";
      const type =
        lastThrownCard.card_type === "movement"
          ? "Move"
          : lastThrownCard.card_type_arg % 100;
      const cardDiv = `<div class="card ${lastThrownCard.card_type} ${color}${type}">
                         </div>`;
      bin.insertAdjacentHTML("afterbegin", cardDiv);
    }
  }

  attachObjectiveModal(myObjective) {
    myObjective.addEventListener("click", () => {
      const cardObjective = myObjective.children[0];
      const computedStyle = window.getComputedStyle(cardObjective);
      const bgImage = computedStyle.backgroundImage;
      const imageUrl = bgImage.replace(/url\(['"]?/, "").replace(/['"]?\)/, "");

      const modal = document.createElement("div");
      modal.className = "modal";

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
      "card",
      card.type,
      playerColor + cardContent,
      "myCard",
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
                          class="card objective${objectiveNumber}">
                    </div>`;

    // Place in your objective card zone
    this.game.elements.myObjective.insertAdjacentHTML("beforeend", cardDiv);
  }

  updateDeckCounter(count) {
    document.getElementById("my_deck_count").textContent = count;
  }

  updateOpponentInfo(opponentData, playerColor) {
    const { opponentCards, opponentDeck, opponentObjective } = this.game.elements;
    const opponentColor = playerColor === "bee" ? "bumblebee" : "bee";
    for (let i = 0; i < opponentData.hand_count; i++) {
      const cardDiv = `<div class="card ${opponentColor}"></div>`;
      opponentCards.insertAdjacentHTML("beforeend", cardDiv);
    }
    const deckDiv = `<div class="card ${opponentColor}"><div id="opponent_deck_count">${opponentData.deck_count}</div></div>`;
    opponentDeck.insertAdjacentHTML("beforeend", deckDiv);

    const objective = `<div class="card objectiveBack"></div>`;
    opponentObjective.insertAdjacentHTML("beforeend", objective);
  }

  flipCardFaceDown(cardElement, deckClass) {
    return new Promise((resolve) => {
      cardElement.classList.add("card-flipping");

      // At the halfway point of the animation, switch the card face to the back
      setTimeout(() => {
        // Remove all specific card classes (e.g., bee3, bee2...)
        // and add the back class (e.g., bee)
        const cardClasses = [...cardElement.classList];
        cardClasses.forEach((cls) => {
          if (cls !== deckClass && cls.startsWith(deckClass.slice(0, 3))) {
            cardElement.classList.remove(cls);
          }
        });
        cardElement.classList.add(deckClass); // add 'bee'
      }, 300); // 300ms = half of 600ms

      cardElement.addEventListener(
        "animationend",
        () => {
          cardElement.classList.remove("card-flipping");
          resolve();
        },
        { once: true },
      );
    });
  }

  async throwCardToBin() {
    const game = this.game;
    if (!game.cardSelected) {
      console.log("Please select a card to throw.");
      return;
    }

    const cardElement = game.cardSelected;
    const binElement = game.elements.bin;

    await game.slide(cardElement, binElement);
  }
}
