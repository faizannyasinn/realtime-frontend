
const socket = io();

// Game state
let currentRoom = null;
let isHost = false;
let players = [];
let currentGame = null;
let gameState = null;
let playerId = null;
let timerInterval = null;

// DOM elements
const screens = {
    home: document.getElementById('homeScreen'),
    waiting: document.getElementById('waitingScreen'),
    gameSelection: document.getElementById('gameSelectionScreen'),
    game: document.getElementById('gameScreen')
};

const elements = {
    playerName: document.getElementById('playerName'),
    roomCode: document.getElementById('roomCode'),
    createRoomBtn: document.getElementById('createRoomBtn'),
    joinRoomBtn: document.getElementById('joinRoomBtn'),
    currentRoomCode: document.getElementById('currentRoomCode'),
    playersList: document.getElementById('playersList'),
    waitingText: document.getElementById('waitingText'),
    leaveRoomBtn: document.getElementById('leaveRoomBtn'),
    gameButtons: document.querySelectorAll('.game-btn'),
    backToWaitingBtn: document.getElementById('backToWaitingBtn'),
    gameArea: document.getElementById('gameArea'),
    currentGameTitle: document.getElementById('currentGameTitle'),
    turnIndicator: document.getElementById('turnIndicator'),
    player1Info: document.getElementById('player1Info'),
    player2Info: document.getElementById('player2Info'),
    exitGameBtn: document.getElementById('exitGameBtn'),
    newGameBtn: document.getElementById('newGameBtn'),
    winnerModal: document.getElementById('winnerModal'),
    winnerText: document.getElementById('winnerText'),
    playAgainBtn: document.getElementById('playAgainBtn'),
    changeGameBtn: document.getElementById('changeGameBtn'),
    errorMessage: document.getElementById('errorMessage'),
    clickSound: document.getElementById('clickSound')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    playerId = socket.id;
    setupEventListeners();
    showScreen('home');
});

// Socket event handlers
socket.on('connect', () => {
    playerId = socket.id;
});

socket.on('roomCreated', (data) => {
    currentRoom = data.roomCode;
    isHost = data.isHost;
    elements.currentRoomCode.textContent = currentRoom;
    showScreen('waiting');
    playSound();
});

socket.on('roomJoined', (data) => {
    currentRoom = data.roomCode;
    isHost = data.isHost;
    elements.currentRoomCode.textContent = currentRoom;
    showScreen('waiting');
    playSound();
});

socket.on('playerJoined', (data) => {
    players = data.players;
    updatePlayersList();
    
    if (players.length === 2) {
        elements.waitingText.textContent = 'Ready to play!';
        if (isHost) {
            setTimeout(() => showScreen('gameSelection'), 1000);
        }
    }
});

socket.on('playerLeft', (data) => {
    players = data.players;
    updatePlayersList();
    elements.waitingText.textContent = 'Waiting for opponent...';
    
    if (currentScreen !== 'waiting') {
        showScreen('waiting');
    }
});

socket.on('gameSelected', (data) => {
    currentGame = data.gameType;
    showGameScreen(data.gameType);
    
    // Request initial game state
    socket.emit('requestGameState', { roomCode: currentRoom });
});

socket.on('gameUpdate', (data) => {
    gameState = data.gameState;
    updateGameDisplay(data);
    
    if (data.winner) {
        showWinner(data.winner);
    } else if (data.draw) {
        showDraw();
    } else if (data.turnSkipped) {
        showTurnSkipped();
    } else if (data.completedBoxes && currentGame === 'dotsandboxes') {
        showBoxCompleted(data.completedBoxes);
    }
});

socket.on('timerUpdate', (data) => {
    updateTimer(data.timeLeft);
});

socket.on('error', (message) => {
    showError(message);
});

// Event listeners
function setupEventListeners() {
    elements.createRoomBtn.addEventListener('click', createRoom);
    elements.joinRoomBtn.addEventListener('click', joinRoom);
    elements.leaveRoomBtn.addEventListener('click', leaveRoom);
    elements.backToWaitingBtn.addEventListener('click', () => showScreen('waiting'));
    elements.exitGameBtn.addEventListener('click', exitGame);
    elements.playAgainBtn.addEventListener('click', playAgain);
    elements.changeGameBtn.addEventListener('click', changeGame);
    
    elements.gameButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isHost) {
                selectGame(btn.dataset.game);
            }
        });
    });
    
    // Enter key handlers
    elements.playerName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createRoom();
    });
    
    elements.roomCode.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinRoom();
    });
}

// Screen management
let currentScreen = 'home';

function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
    currentScreen = screenName;
    
    // Update game selection visibility
    if (screenName === 'gameSelection' && !isHost) {
        elements.gameButtons.forEach(btn => {
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.6';
        });
        document.querySelector('#gameSelectionScreen h2').textContent = 'Waiting for host to choose game...';
    } else if (screenName === 'gameSelection' && isHost) {
        elements.gameButtons.forEach(btn => {
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
        });
        document.querySelector('#gameSelectionScreen h2').textContent = 'Choose Your Game';
    }
}

// Room functions
function createRoom() {
    const name = elements.playerName.value.trim();
    if (!name) {
        showError('Please enter your name');
        return;
    }
    
    socket.emit('createRoom', name);
    playSound();
}

function joinRoom() {
    const name = elements.playerName.value.trim();
    const code = elements.roomCode.value.trim().toUpperCase();
    
    if (!name || !code) {
        showError('Please enter your name and room code');
        return;
    }
    
    socket.emit('joinRoom', { roomCode: code, playerName: name });
    playSound();
}

function leaveRoom() {
    currentRoom = null;
    isHost = false;
    players = [];
    currentGame = null;
    gameState = null;
    showScreen('home');
    elements.winnerModal.classList.remove('active');
}

function selectGame(gameType) {
    if (!isHost) return;
    
    socket.emit('selectGame', { roomCode: currentRoom, gameType });
    playSound();
}

function exitGame() {
    showScreen('gameSelection');
    elements.winnerModal.classList.remove('active');
}

function playAgain() {
    if (isHost) {
        socket.emit('selectGame', { roomCode: currentRoom, gameType: currentGame });
    }
    elements.winnerModal.classList.remove('active');
}

function changeGame() {
    showScreen('gameSelection');
    elements.winnerModal.classList.remove('active');
}

// Game display functions
function showGameScreen(gameType) {
    currentGame = gameType;
    showScreen('game');
    
    const gameNames = {
        tictactoe: 'Tic Tac Toe',
        connect4: 'Connect 4',
        checkers: 'Checkers',
        battleship: 'Battleship',
        gomoku: 'Gomoku (Five in a Row)',
        dotsandboxes: 'Dots and Boxes',
        ludo: 'Ludo',
        minichess: 'Mini Chess',
        memorymatch: 'Memory Match',
        minesweeper: 'Minesweeper Duel'
    };
    
    elements.currentGameTitle.textContent = gameNames[gameType] || gameType;
    updatePlayerInfo();
    createGameBoard(gameType);
}

function updatePlayerInfo() {
    if (players.length >= 1) {
        elements.player1Info.querySelector('.player-name').textContent = players[0].name;
        elements.player1Info.querySelector('.player-status').textContent = 'Player 1';
    }
    
    if (players.length >= 2) {
        elements.player2Info.querySelector('.player-name').textContent = players[1].name;
        elements.player2Info.querySelector('.player-status').textContent = 'Player 2';
    }
}

function updatePlayersList() {
    elements.playersList.innerHTML = '';
    
    players.forEach((player, index) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        playerDiv.innerHTML = `
            <span class="player-name">${player.name}</span>
            <span class="player-status">${index === 0 ? '(Host)' : '(Player 2)'}</span>
        `;
        elements.playersList.appendChild(playerDiv);
    });
}

function updateTurnIndicator() {
    if (!gameState || gameState.gameOver) {
        if (gameState && gameState.gameOver) {
            elements.turnIndicator.textContent = 'Game Over';
            elements.turnIndicator.style.background = 'linear-gradient(45deg, #666, #888)';
        }
        return;
    }
    
    const currentPlayerData = players.find(p => p.id === gameState.currentPlayer);
    if (currentPlayerData) {
        const playerIndex = gameState.players.findIndex(p => p.id === gameState.currentPlayer);
        const symbol = playerIndex === 0 ? 'X' : 'O';
        
        elements.turnIndicator.textContent = `${currentPlayerData.name}'s Turn (${symbol})`;
        
        if (gameState.currentPlayer === playerId) {
            elements.turnIndicator.style.background = 'linear-gradient(45deg, #4ecdc4, #44a08d)';
            elements.turnIndicator.style.boxShadow = '0 0 20px rgba(78, 205, 196, 0.4)';
        } else {
            elements.turnIndicator.style.background = 'linear-gradient(45deg, #ff6b6b, #ffa726)';
            elements.turnIndicator.style.boxShadow = '0 0 20px rgba(255, 107, 107, 0.4)';
        }
    }
}

// Game board creation
function createGameBoard(gameType) {
    elements.gameArea.innerHTML = '';
    
    switch (gameType) {
        case 'tictactoe':
            createTicTacToeBoard();
            break;
        case 'connect4':
            createConnect4Board();
            break;
        case 'checkers':
            createCheckersBoard();
            break;
        case 'battleship':
            createBattleshipBoard();
            break;
        case 'gomoku':
            createGomokuBoard();
            break;
        case 'dotsandboxes':
            createDotsAndBoxesBoard();
            break;
        case 'ludo':
            createLudoBoard();
            break;
        case 'minichess':
            createMiniChessBoard();
            break;
        case 'memorymatch':
            createMemoryMatchBoard();
            break;
        case 'minesweeper':
            createMinesweeperBoard();
            break;
        default:
            elements.gameArea.innerHTML = '<p>Game not implemented yet</p>';
    }
}

function createTicTacToeBoard() {
    // Create timer display
    const timerContainer = document.createElement('div');
    timerContainer.className = 'timer-container';
    timerContainer.innerHTML = `
        <div id="timerDisplay" class="timer-display">
            <div class="timer-circle">
                <div class="timer-number">4</div>
            </div>
            <div class="timer-text">Time Left</div>
        </div>
    `;
    
    const board = document.createElement('div');
    board.className = 'tictactoe-board';
    
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.className = 'tictactoe-cell';
        cell.dataset.index = i;
        cell.addEventListener('click', () => makeTicTacToeMove(i));
        board.appendChild(cell);
    }
    
    elements.gameArea.appendChild(timerContainer);
    elements.gameArea.appendChild(board);
}

function createConnect4Board() {
    const board = document.createElement('div');
    board.className = 'connect4-board';
    
    for (let col = 0; col < 7; col++) {
        const column = document.createElement('div');
        column.className = 'connect4-column';
        column.addEventListener('click', () => makeConnect4Move(col));
        
        for (let row = 0; row < 6; row++) {
            const cell = document.createElement('div');
            cell.className = 'connect4-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            column.appendChild(cell);
        }
        
        board.appendChild(column);
    }
    
    elements.gameArea.appendChild(board);
}

function createCheckersBoard() {
    // Create timer display
    const timerContainer = document.createElement('div');
    timerContainer.className = 'timer-container';
    timerContainer.innerHTML = `
        <div id="timerDisplay" class="timer-display">
            <div class="timer-circle">
                <div class="timer-number">5</div>
            </div>
            <div class="timer-text">Time Left</div>
        </div>
    `;

    const board = document.createElement('div');
    board.className = 'checkers-board';
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement('div');
            cell.className = `checkers-cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.addEventListener('click', () => handleCheckersClick(row, col));
            board.appendChild(cell);
        }
    }
    
    elements.gameArea.appendChild(timerContainer);
    elements.gameArea.appendChild(board);
}

function createBattleshipBoard() {
    // Create timer display
    const timerContainer = document.createElement('div');
    timerContainer.className = 'timer-container';
    timerContainer.innerHTML = `
        <div id="timerDisplay" class="timer-display">
            <div class="timer-circle">
                <div class="timer-number">8</div>
            </div>
            <div class="timer-text">Time Left</div>
        </div>
    `;

    const container = document.createElement('div');
    container.className = 'battleship-container';
    
    // Create ship placement phase UI
    if (!gameState || gameState.phase === 'setup') {
        container.innerHTML = `
            <div class="setup-phase">
                <h3>Place Your Ships</h3>
                <div class="ship-placement">
                    <div class="ship-list">
                        <div class="ship-item" data-size="5">Carrier (5)</div>
                        <div class="ship-item" data-size="4">Battleship (4)</div>
                        <div class="ship-item" data-size="3">Cruiser (3)</div>
                        <div class="ship-item" data-size="3">Submarine (3)</div>
                        <div class="ship-item" data-size="2">Destroyer (2)</div>
                    </div>
                    <div class="placement-board" id="placementBoard"></div>
                </div>
                <button id="randomPlaceBtn" class="btn btn-secondary">Random Placement</button>
                <button id="confirmShipsBtn" class="btn btn-primary" disabled>Confirm Ships</button>
            </div>
        `;
        
        createBattleshipPlacementBoard();
    } else {
        // Create playing phase UI
        container.innerHTML = `
            <div class="battle-grids">
                <div class="grid-container">
                    <h4>Your Fleet</h4>
                    <div id="ownGrid" class="battleship-grid"></div>
                </div>
                <div class="grid-container">
                    <h4>Enemy Waters</h4>
                    <div id="targetGrid" class="battleship-grid"></div>
                </div>
            </div>
        `;
        
        createBattleshipGameBoards();
    }
    
    elements.gameArea.appendChild(timerContainer);
    elements.gameArea.appendChild(container);
}

function createGomokuBoard() {
    // Create timer display
    const timerContainer = document.createElement('div');
    timerContainer.className = 'timer-container';
    timerContainer.innerHTML = `
        <div id="timerDisplay" class="timer-display">
            <div class="timer-circle">
                <div class="timer-number">5</div>
            </div>
            <div class="timer-text">Time Left</div>
        </div>
    `;

    const board = document.createElement('div');
    board.className = 'gomoku-board';
    
    for (let i = 0; i < 225; i++) {
        const cell = document.createElement('div');
        cell.className = 'gomoku-cell';
        cell.dataset.index = i;
        cell.addEventListener('click', () => makeGomokuMove(i));
        board.appendChild(cell);
    }
    
    elements.gameArea.appendChild(timerContainer);
    elements.gameArea.appendChild(board);
}

function createDotsAndBoxesBoard() {
    // Create timer display
    const timerContainer = document.createElement('div');
    timerContainer.className = 'timer-container';
    timerContainer.innerHTML = `
        <div id="timerDisplay" class="timer-display">
            <div class="timer-circle">
                <div class="timer-number">5</div>
            </div>
            <div class="timer-text">Time Left</div>
        </div>
    `;

    // Create score display
    const scoreContainer = document.createElement('div');
    scoreContainer.className = 'score-display';
    scoreContainer.innerHTML = `
        <div class="player-score">
            <span class="score-label">Player 1</span>
            <span id="player1Score" class="score-value">0</span>
        </div>
        <div class="vs-text">VS</div>
        <div class="player-score">
            <span class="score-label">Player 2</span>
            <span id="player2Score" class="score-value">0</span>
        </div>
    `;

    // Create the dots and boxes board
    const board = document.createElement('div');
    board.className = 'dots-boxes-board';
    
    // Create grid structure
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 7; col++) {
            if (row % 2 === 0 && col % 2 === 0) {
                // Dot
                const dot = document.createElement('div');
                dot.className = 'dot';
                board.appendChild(dot);
            } else if (row % 2 === 0 && col % 2 === 1) {
                // Horizontal line space
                const lineSpace = document.createElement('div');
                lineSpace.className = 'line-space horizontal-line';
                lineSpace.dataset.type = 'horizontal';
                lineSpace.dataset.row = Math.floor(row / 2);
                lineSpace.dataset.col = Math.floor(col / 2);
                lineSpace.addEventListener('click', () => makeDotsAndBoxesMove('horizontal', Math.floor(row / 2), Math.floor(col / 2)));
                board.appendChild(lineSpace);
            } else if (row % 2 === 1 && col % 2 === 0) {
                // Vertical line space
                const lineSpace = document.createElement('div');
                lineSpace.className = 'line-space vertical-line';
                lineSpace.dataset.type = 'vertical';
                lineSpace.dataset.row = Math.floor(row / 2);
                lineSpace.dataset.col = Math.floor(col / 2);
                lineSpace.addEventListener('click', () => makeDotsAndBoxesMove('vertical', Math.floor(row / 2), Math.floor(col / 2)));
                board.appendChild(lineSpace);
            } else {
                // Box space
                const boxSpace = document.createElement('div');
                boxSpace.className = 'box-space';
                boxSpace.dataset.row = Math.floor(row / 2);
                boxSpace.dataset.col = Math.floor(col / 2);
                board.appendChild(boxSpace);
            }
        }
    }

    elements.gameArea.appendChild(timerContainer);
    elements.gameArea.appendChild(scoreContainer);
    elements.gameArea.appendChild(board);
}

function createLudoBoard() {
    // Create timer display
    const timerContainer = document.createElement('div');
    timerContainer.className = 'timer-container';
    timerContainer.innerHTML = `
        <div id="timerDisplay" class="timer-display">
            <div class="timer-circle">
                <div class="timer-number">6</div>
            </div>
            <div class="timer-text">Time Left</div>
        </div>
    `;

    // Create dice area
    const diceContainer = document.createElement('div');
    diceContainer.className = 'dice-container';
    diceContainer.innerHTML = `
        <div class="dice-display">
            <div id="diceValue" class="dice-face">?</div>
            <button id="rollDiceBtn" class="btn btn-primary">Roll Dice</button>
        </div>
    `;

    // Create game board
    const board = document.createElement('div');
    board.className = 'ludo-board';
    
    // Create player areas
    const player1Area = document.createElement('div');
    player1Area.className = 'player-area player1-area';
    player1Area.innerHTML = `
        <h4>Player 1 (Blue)</h4>
        <div class="pieces-container">
            <div class="piece blue-piece" data-player="player1" data-piece="0">1</div>
            <div class="piece blue-piece" data-player="player1" data-piece="1">2</div>
        </div>
        <div class="home-count">Home: <span id="player1Home">0</span></div>
    `;
    
    const player2Area = document.createElement('div');
    player2Area.className = 'player-area player2-area';
    player2Area.innerHTML = `
        <h4>Player 2 (Red)</h4>
        <div class="pieces-container">
            <div class="piece red-piece" data-player="player2" data-piece="0">1</div>
            <div class="piece red-piece" data-player="player2" data-piece="1">2</div>
        </div>
        <div class="home-count">Home: <span id="player2Home">0</span></div>
    `;
    
    board.appendChild(player1Area);
    board.appendChild(player2Area);
    
    elements.gameArea.appendChild(timerContainer);
    elements.gameArea.appendChild(diceContainer);
    elements.gameArea.appendChild(board);
    
    // Add event listeners
    document.getElementById('rollDiceBtn').addEventListener('click', rollDice);
    
    document.querySelectorAll('.piece').forEach(piece => {
        piece.addEventListener('click', (e) => {
            const player = e.target.dataset.player;
            const pieceIndex = parseInt(e.target.dataset.piece);
            moveLudoPiece(player, pieceIndex);
        });
    });
}

function createMiniChessBoard() {
    // Create timer display
    const timerContainer = document.createElement('div');
    timerContainer.className = 'timer-container';
    timerContainer.innerHTML = `
        <div id="timerDisplay" class="timer-display">
            <div class="timer-circle">
                <div class="timer-number">10</div>
            </div>
            <div class="timer-text">Time Left</div>
        </div>
    `;

    const board = document.createElement('div');
    board.className = 'chess-board';
    
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            const cell = document.createElement('div');
            cell.className = `chess-cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.addEventListener('click', () => handleChessClick(row, col));
            board.appendChild(cell);
        }
    }
    
    // Add valid moves display
    const movesContainer = document.createElement('div');
    movesContainer.id = 'validMovesContainer';
    movesContainer.className = 'valid-moves-container';
    
    elements.gameArea.appendChild(timerContainer);
    elements.gameArea.appendChild(board);
    elements.gameArea.appendChild(movesContainer);
}

function createMemoryMatchBoard() {
    // Create timer display
    const timerContainer = document.createElement('div');
    timerContainer.className = 'timer-container';
    timerContainer.innerHTML = `
        <div id="timerDisplay" class="timer-display">
            <div class="timer-circle">
                <div class="timer-number">5</div>
            </div>
            <div class="timer-text">Time Left</div>
        </div>
    `;

    // Create score display
    const scoreContainer = document.createElement('div');
    scoreContainer.className = 'score-display';
    scoreContainer.innerHTML = `
        <div class="player-score">
            <span class="score-label">Player 1</span>
            <span id="memoryPlayer1Score" class="score-value">0</span>
        </div>
        <div class="vs-text">VS</div>
        <div class="player-score">
            <span class="score-label">Player 2</span>
            <span id="memoryPlayer2Score" class="score-value">0</span>
        </div>
    `;

    const board = document.createElement('div');
    board.className = 'memory-board';
    
    for (let i = 0; i < 16; i++) {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.dataset.index = i;
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-front">?</div>
                <div class="card-back"></div>
            </div>
        `;
        card.addEventListener('click', () => makeMemoryMatchMove(i));
        board.appendChild(card);
    }
    
    elements.gameArea.appendChild(timerContainer);
    elements.gameArea.appendChild(scoreContainer);
    elements.gameArea.appendChild(board);
}

function createMinesweeperBoard() {
    // Create timer display
    const timerContainer = document.createElement('div');
    timerContainer.className = 'timer-container';
    timerContainer.innerHTML = `
        <div id="timerDisplay" class="timer-display">
            <div class="timer-circle">
                <div class="timer-number">5</div>
            </div>
            <div class="timer-text">Time Left</div>
        </div>
    `;

    // Create score display
    const scoreContainer = document.createElement('div');
    scoreContainer.className = 'score-display';
    scoreContainer.innerHTML = `
        <div class="player-score">
            <span class="score-label">Player 1</span>
            <span id="minesweeperPlayer1Score" class="score-value">0</span>
        </div>
        <div class="vs-text">VS</div>
        <div class="player-score">
            <span class="score-label">Player 2</span>
            <span id="minesweeperPlayer2Score" class="score-value">0</span>
        </div>
    `;

    const board = document.createElement('div');
    board.className = 'minesweeper-board';
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement('div');
            cell.className = 'minesweeper-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.addEventListener('click', () => makeMinesweeperMove(row, col));
            board.appendChild(cell);
        }
    }
    
    elements.gameArea.appendChild(timerContainer);
    elements.gameArea.appendChild(scoreContainer);
    elements.gameArea.appendChild(board);
}

// Game move functions and state
let selectedCheckersPiece = null;
let placedShips = [];
let currentShipSize = 0;
let shipDirection = 'horizontal';

function makeMemoryMatchMove(cardIndex) {
    if (!gameState || gameState.currentPlayer !== playerId || gameState.gameOver) return;
    
    socket.emit('makeMove', {
        roomCode: currentRoom,
        move: { cardIndex },
        gameType: 'memorymatch'
    });
    playSound();
}

function makeMinesweeperMove(row, col) {
    if (!gameState || gameState.currentPlayer !== playerId || gameState.gameOver) return;
    
    socket.emit('makeMove', {
        roomCode: currentRoom,
        move: { row, col },
        gameType: 'minesweeper'
    });
    playSound();
}

function handleCheckersClick(row, col) {
    if (!gameState || gameState.currentPlayer !== playerId || gameState.gameOver) return;
    
    const piece = gameState.board[row][col];
    const playerIndex = gameState.players.findIndex(p => p.id === playerId);
    const playerColor = playerIndex === 0 ? 'red' : 'black';
    
    if (selectedCheckersPiece) {
        // Try to make a move
        socket.emit('makeMove', {
            roomCode: currentRoom,
            move: {
                fromRow: selectedCheckersPiece.row,
                fromCol: selectedCheckersPiece.col,
                toRow: row,
                toCol: col
            },
            gameType: 'checkers'
        });
        playSound();
        
        // Clear selection
        clearCheckersSelection();
    } else if (piece && piece.includes(playerColor)) {
        // Select piece
        selectedCheckersPiece = { row, col };
        showCheckersValidMoves(row, col);
    }
}

function clearCheckersSelection() {
    selectedCheckersPiece = null;
    document.querySelectorAll('.checkers-cell').forEach(cell => {
        cell.classList.remove('selected', 'valid-move');
    });
}

function showCheckersValidMoves(row, col) {
    // Highlight selected piece
    const selectedCell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    selectedCell.classList.add('selected');
    
    // Calculate valid moves (simplified)
    const playerIndex = gameState.players.findIndex(p => p.id === playerId);
    const playerColor = playerIndex === 0 ? 'red' : 'black';
    const piece = gameState.board[row][col];
    
    const directions = piece.includes('king') ? 
        [[-1, -1], [-1, 1], [1, -1], [1, 1]] : 
        playerColor === 'red' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
    
    directions.forEach(([dr, dc]) => {
        // Single move
        const newRow = row + dr;
        const newCol = col + dc;
        if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8 && !gameState.board[newRow][newCol]) {
            const cell = document.querySelector(`[data-row="${newRow}"][data-col="${newCol}"]`);
            cell.classList.add('valid-move');
        }
        
        // Jump move
        const jumpRow = row + dr * 2;
        const jumpCol = col + dc * 2;
        if (jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8 && 
            !gameState.board[jumpRow][jumpCol] && gameState.board[newRow][newCol]) {
            const opponentColor = playerColor === 'red' ? 'black' : 'red';
            if (gameState.board[newRow][newCol].includes(opponentColor)) {
                const cell = document.querySelector(`[data-row="${jumpRow}"][data-col="${jumpCol}"]`);
                cell.classList.add('valid-move');
            }
        }
    });
}

function makeBattleshipMove(row, col) {
    if (!gameState || gameState.currentPlayer !== playerId || gameState.gameOver) return;
    
    if (gameState.phase === 'setup') {
        // Handle ship placement
        return;
    }
    
    socket.emit('makeMove', {
        roomCode: currentRoom,
        move: { row, col },
        gameType: 'battleship'
    });
    playSound();
}

function makeTicTacToeMove(index) {
    if (!gameState || gameState.currentPlayer !== playerId || gameState.gameOver) return;
    
    // Check if cell is already occupied
    if (gameState.board[index] !== null) return;
    
    socket.emit('makeMove', {
        roomCode: currentRoom,
        move: { index },
        gameType: 'tictactoe'
    });
    playSound();
}

function makeConnect4Move(column) {
    if (!gameState || gameState.currentPlayer !== playerId || gameState.gameOver) return;
    
    socket.emit('makeMove', {
        roomCode: currentRoom,
        move: { column },
        gameType: 'connect4'
    });
    playSound();
}

function makeCheckersMove(row, col) {
    if (!gameState || gameState.currentPlayer !== playerId || gameState.gameOver) return;
    
    socket.emit('makeMove', {
        roomCode: currentRoom,
        move: { row, col },
        gameType: 'checkers'
    });
    playSound();
}

function makeGomokuMove(index) {
    if (!gameState || gameState.currentPlayer !== playerId || gameState.gameOver) return;
    
    socket.emit('makeMove', {
        roomCode: currentRoom,
        move: { index },
        gameType: 'gomoku'
    });
    playSound();
}

function makeDotsAndBoxesMove(type, row, col) {
    if (!gameState || gameState.currentPlayer !== playerId || gameState.gameOver) return;
    
    socket.emit('makeMove', {
        roomCode: currentRoom,
        move: { type, row, col },
        gameType: 'dotsandboxes'
    });
    playSound();
}

// Chess game state
let selectedPiece = null;
let validMoves = [];

function handleChessClick(row, col) {
    if (!gameState || gameState.currentPlayer !== playerId || gameState.gameOver) return;
    
    const piece = gameState.board[row][col];
    const playerIndex = gameState.players.findIndex(p => p.id === playerId);
    const isPlayerWhite = playerIndex === 0;
    
    if (selectedPiece) {
        // Try to make a move
        const isValidMove = validMoves.some(move => move.row === row && move.col === col);
        
        if (isValidMove) {
            socket.emit('makeMove', {
                roomCode: currentRoom,
                move: {
                    fromRow: selectedPiece.row,
                    fromCol: selectedPiece.col,
                    toRow: row,
                    toCol: col
                },
                gameType: 'minichess'
            });
            playSound();
        }
        
        // Clear selection
        clearChessSelection();
    } else if (piece) {
        // Select piece if it belongs to current player
        const isPieceWhite = piece === piece.toUpperCase();
        if (isPlayerWhite === isPieceWhite) {
            selectedPiece = { row, col };
            showValidMoves(row, col);
        }
    }
}

function clearChessSelection() {
    selectedPiece = null;
    validMoves = [];
    document.querySelectorAll('.chess-cell').forEach(cell => {
        cell.classList.remove('selected', 'valid-move');
    });
}

function showValidMoves(row, col) {
    // Request valid moves from server
    fetch('/api/valid-moves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: gameState.board, row, col })
    })
    .then(response => response.json())
    .then(moves => {
        validMoves = moves;
        
        // Highlight selected piece
        const selectedCell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        selectedCell.classList.add('selected');
        
        // Highlight valid moves
        moves.forEach(move => {
            const cell = document.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`);
            cell.classList.add('valid-move');
        });
    })
    .catch(() => {
        // Fallback - calculate simple moves client-side
        validMoves = calculateBasicValidMoves(gameState.board, row, col);
        
        const selectedCell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        selectedCell.classList.add('selected');
        
        validMoves.forEach(move => {
            const cell = document.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`);
            cell.classList.add('valid-move');
        });
    });
}

function calculateBasicValidMoves(board, row, col) {
    const moves = [];
    const piece = board[row][col];
    if (!piece) return moves;
    
    // Basic king moves (all adjacent squares)
    if (piece.toLowerCase() === 'k') {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const newRow = row + dr;
                const newCol = col + dc;
                if (newRow >= 0 && newRow < 5 && newCol >= 0 && newCol < 5) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }
    }
    
    return moves;
}

function rollDice() {
    if (!gameState || gameState.currentPlayer !== playerId || gameState.gameOver) return;
    if (gameState.board.diceRolled) return;
    
    socket.emit('makeMove', {
        roomCode: currentRoom,
        move: { action: 'rollDice' },
        gameType: 'ludo'
    });
    playSound();
}

function moveLudoPiece(playerKey, pieceIndex) {
    if (!gameState || gameState.currentPlayer !== playerId || gameState.gameOver) return;
    if (!gameState.board.diceRolled) return;
    
    const playerIndex = gameState.players.findIndex(p => p.id === playerId);
    const currentPlayerKey = playerIndex === 0 ? 'player1' : 'player2';
    
    if (playerKey !== currentPlayerKey) return;
    
    socket.emit('makeMove', {
        roomCode: currentRoom,
        move: { action: 'movePiece', pieceIndex },
        gameType: 'ludo'
    });
    playSound();
}

// Game update functions
function updateGameDisplay(data) {
    gameState = data.gameState;
    updateTurnIndicator();
    initializeTimer();
    
    switch (currentGame) {
        case 'tictactoe':
            updateTicTacToeDisplay();
            break;
        case 'connect4':
            updateConnect4Display();
            break;
        case 'checkers':
            updateCheckersDisplay();
            break;
        case 'gomoku':
            updateGomokuDisplay();
            break;
        case 'dotsandboxes':
            updateDotsAndBoxesDisplay();
            break;
        case 'minichess':
            updateMiniChessDisplay();
            break;
        case 'ludo':
            updateLudoDisplay();
            break;
        case 'checkers':
            updateCheckersDisplay();
            break;
        case 'battleship':
            updateBattleshipDisplay();
            break;
        case 'memorymatch':
            updateMemoryMatchDisplay();
            break;
        case 'minesweeper':
            updateMinesweeperDisplay();
            break;
    }
}

function updateTicTacToeDisplay() {
    const cells = document.querySelectorAll('.tictactoe-cell');
    cells.forEach((cell, index) => {
        const value = gameState.board[index];
        cell.textContent = value || '';
        cell.className = `tictactoe-cell ${value ? value.toLowerCase() : ''}`;
        
        // Add visual styling for X and O
        if (value === 'X') {
            cell.style.color = '#ff6b6b';
            cell.style.textShadow = '0 0 10px rgba(255, 107, 107, 0.5)';
        } else if (value === 'O') {
            cell.style.color = '#4ecdc4';
            cell.style.textShadow = '0 0 10px rgba(78, 205, 196, 0.5)';
        } else {
            cell.style.color = '';
            cell.style.textShadow = '';
        }
    });
}

function updateConnect4Display() {
    const cells = document.querySelectorAll('.connect4-cell');
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const value = gameState.board[row][col];
        
        cell.className = 'connect4-cell';
        if (value === 'R') {
            cell.classList.add('red');
        } else if (value === 'Y') {
            cell.classList.add('yellow');
        }
    });
}

function updateCheckersDisplay() {
    const cells = document.querySelectorAll('.checkers-cell');
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const value = gameState.board[row][col];
        
        // Clear existing pieces
        cell.innerHTML = '';
        
        if (value) {
            const piece = document.createElement('div');
            piece.className = `checkers-piece ${value}`;
            cell.appendChild(piece);
        }
    });
}

function updateGomokuDisplay() {
    const cells = document.querySelectorAll('.gomoku-cell');
    cells.forEach((cell, index) => {
        const row = Math.floor(index / 15);
        const col = index % 15;
        const value = gameState.board[row][col];
        
        cell.innerHTML = '';
        cell.classList.remove('winning-cell');
        
        if (value) {
            const piece = document.createElement('div');
            piece.className = 'gomoku-stone';
            piece.textContent = value;
            
            if (value === '●') {
                piece.classList.add('black-stone');
            } else {
                piece.classList.add('white-stone');
            }
            
            cell.appendChild(piece);
        }
    });
}

function updateMiniChessDisplay() {
    const cells = document.querySelectorAll('.chess-cell');
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const piece = gameState.board[row][col];
        
        // Clear existing content except for selection highlights
        const existingPiece = cell.querySelector('.chess-piece');
        if (existingPiece) {
            existingPiece.remove();
        }
        
        if (piece) {
            const pieceElement = document.createElement('div');
            pieceElement.className = 'chess-piece';
            pieceElement.textContent = getChessPieceSymbol(piece);
            
            if (piece === piece.toUpperCase()) {
                pieceElement.classList.add('white-piece');
            } else {
                pieceElement.classList.add('black-piece');
            }
            
            cell.appendChild(pieceElement);
        }
    });
}

function updateCheckersDisplay() {
    const cells = document.querySelectorAll('.checkers-cell');
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const piece = gameState.board[row][col];
        
        // Clear existing pieces
        const existingPiece = cell.querySelector('.checkers-piece');
        if (existingPiece) {
            existingPiece.remove();
        }
        
        if (piece) {
            const pieceElement = document.createElement('div');
            pieceElement.className = 'checkers-piece';
            
            if (piece.includes('red')) {
                pieceElement.classList.add('red-piece');
            } else if (piece.includes('black')) {
                pieceElement.classList.add('black-piece');
            }
            
            if (piece.includes('king')) {
                pieceElement.classList.add('king');
                pieceElement.innerHTML = '♔';
            }
            
            cell.appendChild(pieceElement);
        }
    });
}

function updateBattleshipDisplay() {
    if (gameState.phase === 'setup') {
        // Update setup display
        return;
    }
    
    const ownGrid = document.getElementById('ownGrid');
    const targetGrid = document.getElementById('targetGrid');
    
    if (!ownGrid || !targetGrid) return;
    
    // Update own grid (show ships and enemy hits)
    const playerBoard = gameState.board[playerId];
    if (playerBoard) {
        updateBattleshipGrid(ownGrid, playerBoard, true);
    }
    
    // Update target grid (show our shots)
    const playerIndex = gameState.players.findIndex(p => p.id === playerId);
    const opponentId = gameState.players[1 - playerIndex].id;
    const opponentBoard = gameState.board[opponentId];
    if (opponentBoard && playerBoard) {
        updateBattleshipGrid(targetGrid, { shots: playerBoard.shots }, false);
    }
}

function updateBattleshipGrid(gridElement, board, showShips) {
    gridElement.innerHTML = '';
    
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            const cell = document.createElement('div');
            cell.className = 'battleship-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            const shotIndex = row * 10 + col;
            const shot = board.shots && board.shots[shotIndex];
            
            if (shot === 'hit') {
                cell.classList.add('hit');
                cell.innerHTML = '💥';
            } else if (shot === 'miss') {
                cell.classList.add('miss');
                cell.innerHTML = '💧';
            } else if (showShips && board.ships) {
                const hasShip = board.ships.some(ship => 
                    ship.positions.some(pos => pos.row === row && pos.col === col)
                );
                if (hasShip) {
                    cell.classList.add('ship');
                }
            }
            
            if (!showShips && !shot) {
                cell.addEventListener('click', () => makeBattleshipMove(row, col));
            }
            
            gridElement.appendChild(cell);
        }
    }
}

function updateMemoryMatchDisplay() {
    const cards = document.querySelectorAll('.memory-card');
    cards.forEach((card, index) => {
        const cardData = gameState.board.cards[index];
        const cardBack = card.querySelector('.card-back');
        
        if (cardData.flipped || cardData.matched) {
            card.classList.add('flipped');
            cardBack.textContent = getMemoryCardSymbol(cardData.value);
        } else {
            card.classList.remove('flipped');
        }
        
        if (cardData.matched) {
            card.classList.add('matched');
        }
    });
    
    // Update scores
    const player1Score = document.getElementById('memoryPlayer1Score');
    const player2Score = document.getElementById('memoryPlayer2Score');
    if (player1Score && player2Score) {
        player1Score.textContent = gameState.board.scores.player1 || 0;
        player2Score.textContent = gameState.board.scores.player2 || 0;
    }
}

function updateMinesweeperDisplay() {
    const cells = document.querySelectorAll('.minesweeper-cell');
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const cellData = gameState.board.board[row][col];
        
        if (cellData.isRevealed) {
            cell.classList.add('revealed');
            
            if (cellData.isMine) {
                cell.classList.add('mine');
                cell.innerHTML = '💣';
            } else {
                const count = cellData.neighborCount;
                cell.textContent = count > 0 ? count : '';
                cell.classList.add(`number-${count}`);
            }
            
            // Color based on who revealed it
            const playerIndex = gameState.players.findIndex(p => p.id === cellData.revealedBy);
            if (playerIndex === 0) {
                cell.classList.add('revealed-by-player1');
            } else if (playerIndex === 1) {
                cell.classList.add('revealed-by-player2');
            }
        }
    });
    
    // Update scores
    const player1Score = document.getElementById('minesweeperPlayer1Score');
    const player2Score = document.getElementById('minesweeperPlayer2Score');
    if (player1Score && player2Score) {
        player1Score.textContent = gameState.board.scores.player1 || 0;
        player2Score.textContent = gameState.board.scores.player2 || 0;
    }
}

function getMemoryCardSymbol(value) {
    const symbols = ['🎮', '🎯', '🎲', '🎨', '🎪', '🎭', '🎸', '🎹'];
    return symbols[value - 1] || value;
}

function createBattleshipPlacementBoard() {
    const placementBoard = document.getElementById('placementBoard');
    if (!placementBoard) return;
    
    placementBoard.innerHTML = '';
    placementBoard.className = 'battleship-placement-grid';
    
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            const cell = document.createElement('div');
            cell.className = 'placement-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            placementBoard.appendChild(cell);
        }
    }
    
    // Add event listeners for ship placement
    document.getElementById('randomPlaceBtn').addEventListener('click', randomShipPlacement);
    document.getElementById('confirmShipsBtn').addEventListener('click', confirmShipPlacement);
}

function createBattleshipGameBoards() {
    const ownGrid = document.getElementById('ownGrid');
    const targetGrid = document.getElementById('targetGrid');
    
    [ownGrid, targetGrid].forEach(grid => {
        if (!grid) return;
        grid.innerHTML = '';
        grid.className = 'battleship-grid';
        
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                const cell = document.createElement('div');
                cell.className = 'battleship-cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                grid.appendChild(cell);
            }
        }
    });
}

function randomShipPlacement() {
    // Implement random ship placement logic
    placedShips = generateRandomShips();
    updatePlacementDisplay();
    document.getElementById('confirmShipsBtn').disabled = false;
}

function generateRandomShips() {
    const ships = [];
    const shipSizes = [5, 4, 3, 3, 2];
    const grid = Array(10).fill().map(() => Array(10).fill(false));
    
    for (const size of shipSizes) {
        let placed = false;
        let attempts = 0;
        
        while (!placed && attempts < 100) {
            const row = Math.floor(Math.random() * 10);
            const col = Math.floor(Math.random() * 10);
            const horizontal = Math.random() < 0.5;
            
            if (canPlaceShip(grid, row, col, size, horizontal)) {
                const positions = [];
                for (let i = 0; i < size; i++) {
                    const r = horizontal ? row : row + i;
                    const c = horizontal ? col + i : col;
                    grid[r][c] = true;
                    positions.push({ row: r, col: c });
                }
                ships.push({ size, positions });
                placed = true;
            }
            attempts++;
        }
    }
    
    return ships;
}

function canPlaceShip(grid, row, col, size, horizontal) {
    // Check if ship can be placed
    for (let i = 0; i < size; i++) {
        const r = horizontal ? row : row + i;
        const c = horizontal ? col + i : col;
        
        if (r >= 10 || c >= 10 || grid[r][c]) {
            return false;
        }
    }
    return true;
}

function updatePlacementDisplay() {
    const cells = document.querySelectorAll('.placement-cell');
    cells.forEach(cell => cell.classList.remove('ship'));
    
    placedShips.forEach(ship => {
        ship.positions.forEach(pos => {
            const cell = document.querySelector(`[data-row="${pos.row}"][data-col="${pos.col}"]`);
            if (cell) cell.classList.add('ship');
        });
    });
}

function confirmShipPlacement() {
    if (placedShips.length === 5) {
        socket.emit('makeMove', {
            roomCode: currentRoom,
            move: { ships: placedShips },
            gameType: 'battleship'
        });
        playSound();
    }
}

function updateLudoDisplay() {
    // Update dice value
    const diceElement = document.getElementById('diceValue');
    if (diceElement) {
        diceElement.textContent = gameState.board.diceValue || '?';
        diceElement.className = `dice-face ${gameState.board.diceValue ? 'rolled' : ''}`;
    }
    
    // Update dice button
    const rollBtn = document.getElementById('rollDiceBtn');
    if (rollBtn) {
        rollBtn.disabled = gameState.board.diceRolled || gameState.currentPlayer !== playerId;
        rollBtn.textContent = gameState.board.diceRolled ? 'Move Piece' : 'Roll Dice';
    }
    
    // Update pieces positions
    Object.keys(gameState.board.players).forEach(playerKey => {
        const player = gameState.board.players[playerKey];
        player.pieces.forEach((position, index) => {
            const pieceElement = document.querySelector(`[data-player="${playerKey}"][data-piece="${index}"]`);
            if (pieceElement) {
                pieceElement.textContent = position === 0 ? (index + 1) : position;
                pieceElement.classList.toggle('at-home', position === 0);
                pieceElement.classList.toggle('finished', position === 57);
                
                // Highlight moveable pieces
                const canMove = gameState.board.diceRolled && 
                              gameState.currentPlayer === playerId &&
                              canPieceMove(position, gameState.board.diceValue);
                pieceElement.classList.toggle('moveable', canMove);
            }
        });
        
        // Update home count
        const homeElement = document.getElementById(`${playerKey}Home`);
        if (homeElement) {
            homeElement.textContent = player.home;
        }
    });
}

function getChessPieceSymbol(piece) {
    const symbols = {
        'K': '♔', 'k': '♚',
        'Q': '♕', 'q': '♛',
        'R': '♖', 'r': '♜',
        'B': '♗', 'b': '♝',
        'N': '♘', 'n': '♞',
        'P': '♙', 'p': '♟'
    };
    return symbols[piece] || piece;
}

function canPieceMove(position, diceValue) {
    // Can start with a 6
    if (position === 0 && diceValue === 6) return true;
    
    // Can move if not at home and won't overshoot finish
    if (position > 0 && position + diceValue <= 57) return true;
    
    return false;
}

function updateDotsAndBoxesDisplay() {
    // Update horizontal lines
    const horizontalLines = document.querySelectorAll('.horizontal-line');
    horizontalLines.forEach(line => {
        const row = parseInt(line.dataset.row);
        const col = parseInt(line.dataset.col);
        if (gameState.board.horizontalLines[row] && gameState.board.horizontalLines[row][col]) {
            line.classList.add('active');
        }
    });

    // Update vertical lines
    const verticalLines = document.querySelectorAll('.vertical-line');
    verticalLines.forEach(line => {
        const row = parseInt(line.dataset.row);
        const col = parseInt(line.dataset.col);
        if (gameState.board.verticalLines[row] && gameState.board.verticalLines[row][col]) {
            line.classList.add('active');
        }
    });

    // Update boxes
    const boxSpaces = document.querySelectorAll('.box-space');
    boxSpaces.forEach(box => {
        const row = parseInt(box.dataset.row);
        const col = parseInt(box.dataset.col);
        const boxValue = gameState.board.boxes[row] && gameState.board.boxes[row][col];
        
        if (boxValue) {
            box.textContent = boxValue;
            box.classList.add('completed');
            if (boxValue === 'P1') {
                box.classList.add('player1');
            } else if (boxValue === 'P2') {
                box.classList.add('player2');
            }
        }
    });

    // Update scores
    const player1Score = document.getElementById('player1Score');
    const player2Score = document.getElementById('player2Score');
    if (player1Score && player2Score) {
        player1Score.textContent = gameState.board.scores.player1;
        player2Score.textContent = gameState.board.scores.player2;
    }
}

// Winner display
function showWinner(winnerId) {
    const winner = players.find(p => p.id === winnerId);
    if (winner) {
        elements.winnerText.textContent = `🎉 ${winner.name} Wins! 🎉`;
    }
    elements.winnerModal.classList.add('active');
    playSound();
}

function showDraw() {
    elements.winnerText.textContent = `🤝 It's a Draw! 🤝`;
    elements.winnerModal.classList.add('active');
    playSound();
}

// Utility functions
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.add('show');
    
    setTimeout(() => {
        elements.errorMessage.classList.remove('show');
    }, 3000);
}

function playSound() {
    try {
        elements.clickSound.currentTime = 0;
        elements.clickSound.play().catch(() => {
            // Ignore audio play errors (user interaction required)
        });
    } catch (e) {
        // Ignore audio errors
    }
}

function updateTimer(timeLeft) {
    const timerDisplay = document.getElementById('timerDisplay');
    const timerNumber = document.querySelector('.timer-number');
    const timerCircle = document.querySelector('.timer-circle');
    
    if (!timerDisplay || !gameState) return;
    
    // Only show timer if first move has been made and game is not over
    if (gameState.firstMoveMade && !gameState.gameOver) {
        timerDisplay.style.display = 'block';
        timerNumber.textContent = timeLeft;
        
        // Different color thresholds for different games
        let warningThreshold, urgentThreshold;
        
        switch (currentGame) {
            case 'dotsandboxes':
            case 'gomoku':
                warningThreshold = 2;
                urgentThreshold = 1;
                break;
            case 'tictactoe':
                warningThreshold = 2;
                urgentThreshold = 1;
                break;
            case 'minichess':
                warningThreshold = 4;
                urgentThreshold = 2;
                break;
            case 'ludo':
                warningThreshold = 3;
                urgentThreshold = 1;
                break;
            default:
                warningThreshold = 2;
                urgentThreshold = 1;
        }
        
        // Change color based on time left
        if (timeLeft <= urgentThreshold) {
            timerCircle.style.background = 'linear-gradient(45deg, #ff416c, #ff4b2b)';
            timerCircle.style.animation = 'pulse 0.5s infinite';
        } else if (timeLeft <= warningThreshold) {
            timerCircle.style.background = 'linear-gradient(45deg, #ffa726, #ff9800)';
            timerCircle.style.animation = 'pulse 1s infinite';
        } else {
            timerCircle.style.background = 'linear-gradient(45deg, #4ecdc4, #44a08d)';
            timerCircle.style.animation = 'none';
        }
    } else {
        timerDisplay.style.display = 'none';
    }
}

// Initialize timer display when game starts
function initializeTimer() {
    const timerDisplay = document.getElementById('timerDisplay');
    if (timerDisplay && !gameState.firstMoveMade) {
        timerDisplay.style.display = 'none';
    }
}

function showTurnSkipped() {
    const notification = document.createElement('div');
    notification.className = 'turn-skipped-notification';
    notification.innerHTML = '⏰ Turn skipped - Time\'s up!';
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(45deg, #ff416c, #ff4b2b);
        color: white;
        padding: 20px 30px;
        border-radius: 12px;
        font-size: 1.2rem;
        font-weight: 600;
        z-index: 1000;
        box-shadow: 0 4px 15px rgba(255, 65, 108, 0.3);
        animation: slideIn 0.5s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 2000);
}

function showBoxCompleted(completedBoxes) {
    if (completedBoxes && completedBoxes.length > 0) {
        const notification = document.createElement('div');
        notification.className = 'box-completed-notification';
        notification.innerHTML = `🎯 ${completedBoxes.length} Box${completedBoxes.length > 1 ? 'es' : ''} Completed! Play Again!`;
        notification.style.cssText = `
            position: fixed;
            top: 30%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(45deg, #4ecdc4, #44a08d);
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            font-size: 1.2rem;
            font-weight: 600;
            z-index: 1000;
            box-shadow: 0 4px 15px rgba(78, 205, 196, 0.3);
            animation: slideIn 0.5s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 2000);
    }
}

// Add some visual enhancements
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn') || e.target.classList.contains('game-btn')) {
        // Create ripple effect
        const ripple = document.createElement('span');
        ripple.style.position = 'absolute';
        ripple.style.borderRadius = '50%';
        ripple.style.background = 'rgba(255, 255, 255, 0.3)';
        ripple.style.transform = 'scale(0)';
        ripple.style.animation = 'ripple 0.6s linear';
        ripple.style.left = e.offsetX + 'px';
        ripple.style.top = e.offsetY + 'px';
        ripple.style.width = ripple.style.height = '20px';
        ripple.style.pointerEvents = 'none';
        
        e.target.style.position = 'relative';
        e.target.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
});

// Add ripple animation CSS
const style = document.createElement('style');
style.textContent = `
@keyframes ripple {
    to {
        transform: scale(4);
        opacity: 0;
    }
}
`;
document.head.appendChild(style);
