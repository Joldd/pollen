/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * pollen implementation : © <Your name here> <Your email address here>
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * Game.js
 *
 * pollen user interface script
 *
 * In this file, you are describing the logic of your user interface, in Javascript language.
 *
 */

/**
 * We create one State class per declared state on the PHP side, to handle all state specific code here.
 * onEnteringState, onLeavingState and onPlayerActivationChange are predefined names that will be called by the framework.
 * When executing code in this state, you can access the args using this.args
 */
class PlayerTurn {
  constructor(game, bga) {
    this.game = game;
    this.bga = bga;
    this.isCurrentPlayerActive = false;
    this.btnVisible = null;
    this.btnHide = null;
    this.btnConfirm = null;
    this.btnCancel = null;
    this.btnDestroy = null;
  }

  /**
   * This method is called each time we are entering the game state. You can use this method to perform some user interface changes at this moment.
   */
  onEnteringState(args, isCurrentPlayerActive) {
    this.isCurrentPlayerActive = isCurrentPlayerActive;
    // this.bga.statusBar.setTitle(
    //   isCurrentPlayerActive
    //     ? _("${you} must choose a card to play")
    //     : _("${actplayer} must choose a card to play"),
    // );
    this.bga.statusBar.addActionButton(
      _("Confirm"),
      () => this.onConfirm(false),
      {
        id: "button_confirm_id",
        color: "primary",
      },
    );
    this.bga.statusBar.addActionButton(
      _("Visible (-1 AP)"),
      () => this.onConfirm(false),
      {
        id: "button_visible_id",
        color: "primary",
      },
    );
    this.bga.statusBar.addActionButton(
      _("Hidden (-2 AP)"),
      () => this.onConfirm(true),
      {
        id: "button_hide_id",
        color: "primary",
      },
    );
    this.bga.statusBar.addActionButton(
      _("Throw the card (-1 AP)"),
      () => this.onDestroy(),
      {
        id: "button_destroy_id",
        color: "primary",
      },
    );
    this.bga.statusBar.addActionButton(_("Cancel"), () => this.onCancel(), {
      id: "button_cancel_id",
      color: "alert",
    });

    this.btnConfirm = document.getElementById("button_confirm_id");
    this.btnCancel = document.getElementById("button_cancel_id");
    this.btnVisible = document.getElementById("button_visible_id");
    this.btnHide = document.getElementById("button_hide_id");
    this.btnDestroy = document.getElementById("button_destroy_id");
    this.btnConfirm.style.display = "none";
    this.btnCancel.style.display = "none";
    this.btnVisible.style.display = "none";
    this.btnHide.style.display = "none";
    this.btnDestroy.style.display = "none";
  }

  /**
   * This method is called each time we are leaving the game state. You can use this method to perform some user interface changes at this moment.
   */
  onLeavingState(args, isCurrentPlayerActive) {
    this.bga.statusBar.removeActionButtons();
  }

  /**
   * This method is called each time the current player becomes active or inactive in a MULTIPLE_ACTIVE_PLAYER state. You can use this method to perform some user interface changes at this moment.
   * on MULTIPLE_ACTIVE_PLAYER states, you may want to call this function in onEnteringState using `this.onPlayerActivationChange(args, isCurrentPlayerActive)` at the end of onEnteringState.
   * If your state is not a MULTIPLE_ACTIVE_PLAYER one, you can delete this function.
   */
  onPlayerActivationChange(args, isCurrentPlayerActive) {}

  onConfirm(isHide) {
    if (!this.game.cardSelected || !this.game.positionSelected) {
      console.log("Please select a card and a position before confirming.");
      return;
    }

    const coords = this.game.positionSelected.id.split("_");
    let x = coords[1];
    let y = coords[2];
    if (!this.game.firstPlayer) {
      y = 8 - parseInt(y); // Mirror Y coordinate for second player
    }
    const cardId = this.game.cardSelected.id.split("_")[1];

    this.bga.actions.performAction("actPlayCard", {
      card_id: cardId,
      x: x,
      y: y,
      isHide: isHide,
      player_number: this.game.myPlayerNumber,
    });

    this.game.hidePlayablePositions();
  }

  onCancel() {
    if (this.game.cardSelected) {
      this.game.cardSelected.classList.remove("selected");
      this.game.cardSelected = null;
    }
    if (this.game.positionSelected) {
      this.game.positionSelected.classList.remove("selected");
      this.game.positionSelected = null;
    }
    this.bga.statusBar.setTitle(
      this.isCurrentPlayerActive
        ? _("${you} must choose a card to play")
        : _("${actplayer} must choose a card to play"),
    );
    this.game.hidePlayablePositions();
    this.hideButtons();
  }

  onDestroy() {
    if (!this.game.cardSelected) {
      console.log("Please select a card to throw.");
      return;
    }
    const cardId = this.game.cardSelected.id.split("_")[1];
    this.bga.actions.performAction("actThrowCard", {
      card_id: cardId,
    });
    this.game.hidePlayablePositions();
  }

  hideButtons() {
    this.btnConfirm.style.display = "none";
    this.btnVisible.style.display = "none";
    this.btnHide.style.display = "none";
    this.btnDestroy.style.display = "none";
    this.btnCancel.style.display = "none";
  }
}

const BgaAnimations = await importEsmLib("bga-animations", "1.x");

export class Game {
  constructor(bga) {
    this.bga = bga;

    // Declare the State classes
    this.playerTurn = new PlayerTurn(this, bga);
    this.bga.states.register("PlayerTurn", this.playerTurn);

    this.cardSelected = null;
    this.positionSelected = null;

    this.animationManager = new BgaAnimations.Manager({
      animationsActive: () => this.bga.gameui.bgaAnimationsActive(),
    });
  }

  setup(gamedatas) {
    this.gamedatas = gamedatas;

    this.playable_positions = gamedatas.playable_positions; // Store playable positions for later use
    this.remaining_ap = gamedatas.remaining_ap; // Store remaining action points for later use

    // Store player number
    this.myPlayerNumber = gamedatas.player_number;
    this.firstPlayer = this.myPlayerNumber === 1;
    console.log("I am player:", this.myPlayerNumber); // 1 or 2

    this.bga.gameArea.getElement().insertAdjacentHTML(
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

    const board = document.getElementById("board");

    const myCards = document.getElementById("myCards");
    const myObjective = document.getElementById("myObjective");
    const myDeck = document.getElementById("myDeck");

    const opponentCards = document.getElementById("opponentCards");
    const opponentObjective = document.getElementById("opponentObjective");
    const opponentDeck = document.getElementById("opponentDeck");

    const bin = document.getElementById("bin");

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
        const name = isFlower ? `flower${flowerType}` : "";

        row.insertAdjacentHTML(
          "afterbegin",
          `<div id="card_${x}_${y}" class="${className}"></div>`,
        );
      }
    }

    document.querySelectorAll(".position").forEach((card) => {
      card.addEventListener("click", (e) => this.onPositionSelected(e));
    });

    // Setting up player boards
    Object.values(gamedatas.players).forEach((player) => {
      // example of setting up players boards
      this.bga.playerPanels.getElement(player.id).insertAdjacentHTML(
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

    // TODO: Set up your game interface here, according to "gamedatas"
    const playerColor = this.myPlayerNumber === 1 ? "bee" : "bumblebee";

    // Display player's hand
    for (let card_id in gamedatas.hand) {
      const card = gamedatas.hand[card_id];
      this.addCardToHand(card, playerColor);
    }
    // myCards.querySelectorAll(".myCard").forEach((card) => {
    //   card.addEventListener("click", (e) => this.onCardSelect(e));
    // });

    // Display cards on the board
    if (gamedatas.board) {
      gamedatas.board.forEach((card) => {
        const boardX = card.location_arg[0];
        let boardY = card.location_arg[1];

        const isVisible = card.location_arg[2] == 0;
        if (!this.firstPlayer) {
          boardY = 8 - parseInt(boardY); // Mirror Y coordinate for second player
        }
        const cell = document.getElementById(`card_${boardX}_${boardY}`);
        const color = card.type_arg[0] == 1 ? "bee" : "bumblebee";
        const number = isVisible ? card.type_arg % 100 : "";
        if (cell) {
          const cardDiv = `<div class="card ${card.type} ${color}${number}">                   
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
      const type = lastThrownCard.card_type === "movement" ? "Move" : lastThrownCard.card_type_arg % 100;
      const cardDiv = `<div class="card ${lastThrownCard.card_type} ${color}${type}">                   
                         </div>`;
      bin.insertAdjacentHTML("afterbegin", cardDiv);
    }

    // Setup game notifications to handle (see "setupNotifications" method below)
    this.setupNotifications();
  }

  ///////////////////////////////////////////////////
  //// Utility methods

  onPositionSelected(e) {
    e.preventDefault();
    e.stopPropagation();
    this.playerTurn.btnConfirm.style.display = "none";
    this.playerTurn.btnCancel.style.display = "none";
    this.playerTurn.btnVisible.style.display = "none";
    this.playerTurn.btnHide.style.display = "none";

    const isCurrentPlayerActive = this.playerTurn.isCurrentPlayerActive;
    if (!isCurrentPlayerActive) {
      return; // Not this player's turn
    }

    if (!this.cardSelected) {
      return; // No card selected
    }

    const coords = e.currentTarget.id.split("_");
    const x = coords[1];
    let y = coords[2];

    let cost = "";
    let pos = "";

    // Check if the clicked position is in the list of playable positions
    const index = this.playable_positions.findIndex(
      (pos) => pos.x == x && pos.y == (!this.firstPlayer ? 8 - parseInt(y) : y),
    );
    if (index === -1) return;

    if (y > 4) {
      this.playerTurn.btnVisible.style.display = "inline-block";
      if (this.remaining_ap >= 2) {
        this.playerTurn.btnHide.style.display = "inline-block";
      }
      pos = "your own side";
    } else {
      this.playerTurn.btnConfirm.style.display = "inline-block";
      pos = "opponent's side";
      cost = "(-2 AP)";
    }

    if (this.positionSelected) {
      this.positionSelected.classList.remove("selected");
    }
    this.positionSelected = e.currentTarget;
    this.positionSelected.classList.add("selected");

    const card = this.cardSelected.textContent.trim();

    this.playerTurn.btnCancel.style.display = "inline-block";
    this.bga.statusBar.setTitle(
      _("${you} are about to play ${card} on ${pos} ${cost}")
        .replace("${card}", card)
        .replace("${pos}", pos)
        .replace("${cost}", cost),
    );
  }

  onCardSelect(e) {
    e.preventDefault();
    e.stopPropagation();
    const isCurrentPlayerActive = this.playerTurn.isCurrentPlayerActive;

    if (!isCurrentPlayerActive) {
      return; // Not this player's turn
    }

    if (this.cardSelected) {
      this.cardSelected.classList.remove("selected");
    }
    this.cardSelected = e.currentTarget;
    this.cardSelected.classList.add("selected");

    this.showPlayablePositions(this.playable_positions);

    this.bga.statusBar.setTitle(
      _("${you} must select a position on the board or "),
    );
    this.playerTurn.btnDestroy.style.display = "inline-block";
  }

  showPlayablePositions(positions) {
    // Clear previous highlights
    document.querySelectorAll(".position").forEach((cell) => {
      cell.classList.remove("playable");
    });
    // Highlight new playable positions
    positions.forEach((pos) => {
      let y = pos.y;
      if (!this.firstPlayer) {
        y = 8 - parseInt(y); // Mirror Y coordinate for second player
      }
      const cell = document.getElementById(`card_${pos.x}_${y}`);
      if (cell) {
        cell.classList.add("playable");
      }
    });
  }

  hidePlayablePositions() {
    document.querySelectorAll(".position").forEach((cell) => {
      cell.classList.remove("playable");
    });
  }

  async throwCardToBin() {
    if (!this.cardSelected) {
      console.log("Please select a card to throw.");
      return;
    }

    const cardElement = this.cardSelected;
    const binElement = document.getElementById("bin");

    await this.animationManager.slideAndAttach(cardElement, binElement);
  }

  async addCardToHand(card, playerColor) {
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

    cardElement.addEventListener("click", (e) => this.onCardSelect(e));
    myDeck.appendChild(cardElement);
    await this.animationManager.slideAndAttach(cardElement, myCards);
  }

  displayObjectiveCard(card) {
    // card.type_arg contains the objective number (1-10)
    const objectiveNumber = card.type_arg;

    const cardDiv = `<div id="objective_card_${card.id}" 
                          class="card objective${objectiveNumber}">
                    </div>`;

    // Place in your objective card zone
    myObjective.insertAdjacentHTML("beforeend", cardDiv);
  }

  updateDeckCounter(count) {
    document.getElementById("my_deck_count").textContent = count;
  }

  updateOpponentInfo(opponentData, playerColor) {
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

  ///////////////////////////////////////////////////
  //// Reaction to cometD notifications

  /*
        setupNotifications:
        
        In this method, you associate each of your game notifications with your local method to handle it.
        
        Note: game notification names correspond to "notifyAllPlayers" and "notifyPlayer" calls in
                your pollen.game.php file.
    
    */
  setupNotifications() {
    console.log("notifications subscriptions setup");

    // automatically listen to the notifications, based on the `notif_xxx` function on this class.
    this.bga.notifications.setupPromiseNotifications();
  }

  // TODO: from this point and below, you can write your game notifications handling methods
  async notif_cardPlayed(args) {
    // Update the board with the new card placement
    const { card, x, y, player_id, remaining_ap, is_hide, playable_positions } =
      args;

    this.playable_positions = playable_positions; // Update playable positions after a card is played
    this.remaining_ap = remaining_ap; // Update remaining action points

    // Get the target cell on the board
    let newY = y;
    if (!this.firstPlayer) {
      newY = 8 - parseInt(y); // Mirror Y coordinate for second player
    }
    const targetCell = document.getElementById(`card_${x}_${newY}`);
    if (!targetCell) {
      console.error("Target cell not found:", `card_${x}_${newY}`);
      return;
    }

    const isCurrentPlayerActive = this.playerTurn.isCurrentPlayerActive;

    const color = card.type_arg[0] == 1 ? "bee" : "bumblebee";

    if (isCurrentPlayerActive) {
      // Get the card element (currently in hand)
      const cardElement = document.getElementById(`card_${card.id}`);

      if (!cardElement) {
        console.error("Card element not found:", `card_${card.id}`);
        return;
      }

      // Animate the card moving from hand to board
      await this.animationManager.slideAndAttach(cardElement, targetCell);
      if (is_hide) {
        // Flip the card face down after moving it to the board
        await this.flipCardFaceDown(cardElement, color);
      }
    } else {
      // Get the card element (currently in hand)
      const cardElement = document.getElementById(`opponentCards`).children[0]; // Assuming opponent's hand cards are added as children of opponentCards

      if (!cardElement) {
        console.error("Opponent card element not found in hand");
        return;
      }
      if (!is_hide) {
        cardElement.classList.remove(color); // Remove the back class (e.g., bee)
        cardElement.classList.add(color + (card.type_arg % 100)); // e.g., bee3, bumblebee2...
      }

      // Animate the card moving from hand to board
      await this.animationManager.slideAndAttach(cardElement, targetCell);
    }

    // Update action points display
    //this.updateActionPointsDisplay(player_id, remaining_ap);

    // Clear selection if it's the current player
    if (player_id == this.player_id) {
      this.cardSelected = null;
      this.positionSelected = null;
    }
  }

  async notif_cardsDrawn(args) {
    if (args.cards.length > 0) {
      const color = args.cards[0].type_arg[0] == 1 ? "bee" : "bumblebee";
      args.cards.forEach(async (card) => {
        await this.addCardToHand(card, color);
      });
    }
  }

  async notif_cardsDrawnOpponent(args) {
    if (args.count > 0 && !this.playerTurn.isCurrentPlayerActive) {
      const opponentColor = opponentDeck.children[0].classList.contains(
        "bumblebee",
      )
        ? "bumblebee"
        : "bee";
      for (let i = 0; i < args.count; i++) {
        const cardElement = document.createElement("div");
        cardElement.classList.add("card", opponentColor);
        opponentDeck.appendChild(cardElement);
        await this.animationManager.slideAndAttach(cardElement, opponentCards);
      }
    }
  }

  async notif_cardThrown(args) {
    const { card, player_id } = args;
    const isCurrentPlayerActive = this.playerTurn.isCurrentPlayerActive;
    const color = card.type_arg[0] == 1 ? "bee" : "bumblebee";
    let bin = document.getElementById("bin");
    if (!bin) {
      console.error("Bin element not found");
      return;
    }
    let cardElement = null;
    if (isCurrentPlayerActive) {
      cardElement = document.getElementById(`card_${card.id}`);
    } else {
      const type = card.type === "movement" ? "Move" : card.type_arg % 100;
      cardElement = document.getElementById(`opponentCards`).children[0];
      cardElement.classList.remove(color); // Remove the back class (e.g., bee)
      cardElement.classList.add(color + type); // e.g., bee3, bumblebee2...
    }
    if (!cardElement) {
      console.error("Card element not found:", `card_${card.id}`);
      return;
    }

    // Animate the card moving from board to bin
    await this.animationManager.slideAndAttach(cardElement, bin);
  }
}
