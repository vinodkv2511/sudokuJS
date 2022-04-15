/* This file aims to rewrite the sudokuJS.js in  an attempt to separate view layer from the logic */


class Sudoku {

    // STATIC CONSTANTS
    static get #DIFFICULTY() {
        const difficulties = {
            EASY: 'easy',
            MEDIUM: 'medium',
            HARD: 'hard',
            VERY_HARD: 'very hard'
        }
        Object.freeze(difficulties);
        return difficulties;
    }

    static get #SOLVE_MODE() {
        const solveModes = {
            SOLVE_MODE_STEP: "step",
		    SOLVE_MODE_ALL: "all"
        }
        Object.freeze(solveModes);
        return solveModes;
    }

    // FIELDS / INSTANCE VARIABLES
    #solveMode = Sudoku.#SOLVE_MODE.SOLVE_MODE_STEP;
    #boardOptions; // TODO - Reconsider this API and is it actually required
    #difficulty = "unknown"; // TODO - Why is this not part of board options?
    #boardFinished = false;
    #boardError = false;
    #onlyUpdatedCandidates = false;
    #gradingMode = false; //solving without updating UI
    #generatingMode = false; //silence board unsolvable errors
    #invalidCandidates = []; //used by the generateBoard function
    #usedStrategies = []; //nr of times each strategy has been used for solving this board - used to calculate difficulty score

    board = [];
    boardSize;
    boardNumbers; // array of 1-9 by default, generated in initBoard


    //indexes of cells in each house - generated on the fly based on boardSize
    houses = [
        //hor. rows
        [],
        //vert. rows
        [],
        //boxes
        []
    ];


    /* generateHouseIndexList
    * -------------------------------------------------------------------*/
    generateHouseIndexList = () => {
        // reset houses
        this.houses = [
            //hor. rows
            [],
            //vert. rows
            [],
            //boxes
            []
        ]
        let boxSideSize = Math.sqrt(this.boardSize);

        for (let i = 0; i < this.boardSize; i++) {
            let hrow = []; //horisontal row
            let vrow = []; //vertical row
            let box = [];
            for (let j = 0; j < this.boardSize; j++) {
                hrow.push(this.boardSize * i + j);
                vrow.push(this.boardSize * j + i);

                if (j < boxSideSize) {
                    for (let k = 0; k < boxSideSize; k++) {
                        //0, 0,0, 27, 27,27, 54, 54, 54 for a standard sudoku
                        let a = Math.floor(i / boxSideSize) * this.boardSize * boxSideSize;
                        //[0-2] for a standard sudoku
                        let b = (i % boxSideSize) * boxSideSize;
                        let boxStartIndex = a + b; //0 3 6 27 30 33 54 57 60

                        //every boxSideSize box, skip boardSize num rows to next box (on new horizontal row)
                        //Math.floor(i/boxSideSize)*boardSize*2
                        //skip across horizontally to next box
                        //+ i*boxSideSize;


                        box.push(boxStartIndex + this.boardSize * j + k);
                    }
                }
            }
            this.houses[0].push(hrow);
            this.houses[1].push(vrow);
            this.houses[2].push(box);
        }
    };


    /* numbersTaken
    * --------------
    *  returns used numbers in a house
    * -----------------------------------------------------------------*/
    numbersTaken = (house) => {
        let numbers = [];
        for (let i = 0; i < house.length; i++) {
            let n = this.board[house[i]].val;
            if (n !== null)
                numbers.push(n);
        }
        //return remaining numbers
        return numbers;
    };

    /* removeCandidatesFromCell
    -----------------------------------------------------------------*/
    removeCandidatesFromCell = (cell, candidates) => {
        let boardCell = this.board[cell];
        let c = boardCell.candidates;
        
        for(let i=0; i < candidates.length; i++){
            //-1 because candidate '1' is at index 0 etc.
            if(c[candidates[i]-1] !== null) {
                c[candidates[i]-1] = null; //writes to board variable
            }
        }
    };

    resetBoardVariables = () => {
        boardFinished = false;
        boardError = false;
        onlyUpdatedCandidates = false;
        usedStrategies = [];
        gradingMode = false;
    };

    /* clearBoard
    -----------------------------------------------------------------*/
    clearBoard = () => {
        resetBoardVariables();

        //reset board variable
        let cands = this.boardNumbers.slice(0);
        for(let i=0; i <this.boardSize*this.boardSize;i++){
            // TODO - Very imp for react to work. Make sure all the updates to board are immutable
            this.board[i] = {
                val: null,
                candidates: cands.slice()
            };
        }
    };

    getNullCandidatesList = () => {
        let l = [];
        for (let i=0; i < this.boardSize; i++){
            l.push(null);
        }
        return l;
    };

    /* resetCandidates
    -----------------------------------------------------------------*/
    resetCandidates = () => {
        let resetCandidatesList = this.boardNumbers.slice(0);
        for(let i=0; i <this.boardSize*this.boardSize;i++){
            if(this.board[i].val === null){
                this.board[i].candidates = resetCandidatesList.slice(); //otherwise same list (not reference!) on every cell
            }
        }
    };


    /* setBoardCell - does not update UI
    -----------------------------------------------------------------*/
    setBoardCell = (cellIndex, val) => {
        let boardCell = this.board[cellIndex];
        //update val
        boardCell.val = val;
        if(val !== null)
            boardCell.candidates = this.getNullCandidatesList();
    };

    /* analyzeBoard
    * solves a copy of the current board(without updating the UI),
    * reports back: error|finished, usedStrategies and difficulty level and score
    * -----------------------------------------------------------------*/
    analyzeBoard = () => {
        this.#gradingMode = true;
        this.#solveMode = Sudoku.#SOLVE_MODE.SOLVE_MODE_ALL;
        let usedStrategiesClone = JSON.parse(JSON.stringify(this.#usedStrategies));
        let boardClone = JSON.parse(JSON.stringify(this.board));
        let canContinue = true;
        while (canContinue) {
            let startStrat = this.#onlyUpdatedCandidates ? 2 : 0;
            canContinue = this.solveFn(startStrat);
        }

        let data = {};
        if (this.#boardError) {
            data.error = "Board incorrect";
        }
        else {
            data.finished = boardFinished;
            data.usedStrategies = [];
            for (let i = 0; i < this.#usedStrategies.length; i++) {
                let strat = strategies[i];
                //only return strategies that were actually used
                if (typeof this.#usedStrategies[i] !== "undefined") {
                    data.usedStrategies[i] = {
                        title: strat.title,
                        freq: this.#usedStrategies[i]
                    };
                }
            }

            if (this.#boardFinished) {
                let boardDiff = calcBoardDifficulty(this.#usedStrategies);
                data.level = boardDiff.level;
                data.score = boardDiff.score;
            }
        }

        //restore everything to state (before solving)
        this.resetBoardVariables();
        this.#usedStrategies = usedStrategiesClone;
        this.board = boardClone;

        return data;
    };


    digCells = () => {
        let cells = [];
        let given = this.boardSize * this.boardSize;
        let minGiven = 17;
        if (this.#difficulty === Sudoku.#DIFFICULTY.EASY) {
            minGiven = 40;
        } else if (this.#difficulty === Sudoku.#DIFFICULTY.MEDIUM) {
            minGiven = 30;
        }
        if (this.boardSize < 9) {
            minGiven = 4
        }
        for (let i = 0; i < this.boardSize * this.boardSize; i++) {
            cells.push(i);
        }

        while (cells.length > 0 && given > minGiven) {
            let randIndex = Math.round(Math.random() * (cells.length - 1));
            let cellIndex = cells.splice(randIndex, 1);
            let val = this.board[cellIndex].val;

            // remove value from this cell
            this.setBoardCell(cellIndex, null);
            // reset candidates, only in model.
            this.resetCandidates(false);

            let data = this.analyzeBoard();
            if (data.finished !== false && this.easyEnough(data)) {
                given--;
            } else {
                // reset - don't dig this cell
                this.setBoardCell(cellIndex, val);
            }

        }
    };


    /* visualEliminationOfCandidates
    * --------------
    * ALWAYS returns false
    * -- special compared to other strats: doesn't step - updates whole board,
    in one go. Since it also only updates candidates, we can skip straight to next strat, since we know that neither this one nor the one(s) before (that only look at actual numbers on board), will find anything new.
    * -----------------------------------------------------------------*/
    visualEliminationOfCandidates = () => {
        //for each type of house..(hor row / vert row / box)
        let hlength = this.houses.length;
        for(let i=0; i < hlength; i++){

            //for each such house
            for(let j=0; j < this.boardSize; j++){
                let house = this.houses[i][j];
                let candidatesToRemove = this.numbersTaken(house);
                //log(candidatesToRemove);

                // for each cell..
                for (let k=0; k < this.boardSize; k++){
                    let cell = house[k];
                    this.removeCandidatesFromCell(cell, candidatesToRemove);
                }
            }
        }
        return false;
    }

    setBoardCellWithRandomCandidate = function(cellIndex){
        // CHECK still valid
        this.visualEliminationOfCandidates();
        // DRAW RANDOM CANDIDATE
        // don't draw already invalidated candidates for cell
        let invalids = this.#invalidCandidates && this.#invalidCandidates[cellIndex];
        // TODO: don't use JS filter - not supported enough(?)
        let candidates = this.board[cellIndex].candidates.filter(function(candidate){
            if(!candidate || (invalids &&  invalids.includes(candidate)))
                return false;
            return candidate;
        });
        // if cell has 0 candidates - fail to set cell.
        if(candidates.length === 0) {
            return false;
        }
        let randIndex = Math.round ( Math.random() * (candidates.length - 1));
        let randomCandidate = candidates[randIndex];
        // UPDATE BOARD
        this.setBoardCell(cellIndex, randomCandidate);
        return true;
    };


    generateBoardAnswerRecursively = (cellIndex) => {
        if((cellIndex+1) > (this.boardSize*this.boardSize)){
            //done
            this.#invalidCandidates = [];
            return true;
        }
        if(this.setBoardCellWithRandomCandidate(cellIndex)){
            this.generateBoardAnswerRecursively(cellIndex + 1);
        } else {
            if(cellIndex <= 0)
                return false;
            let lastIndex = cellIndex - 1;
            this.#invalidCandidates[lastIndex] = this.#invalidCandidates[lastIndex] || [];
            this.#invalidCandidates[lastIndex].push(this.board[lastIndex].val);
            // set val back to null
            this.setBoardCell(lastIndex, null);
            // reset candidates, only in model.
            this.resetCandidates(false);
            // reset invalid candidates for cellIndex
            this.#invalidCandidates[cellIndex] = [];
            // then try again
            this.generateBoardAnswerRecursively(lastIndex);
            return false;
        }
    };



    /* initBoard
    * --------------
    *  inits board, variables.
    * -----------------------------------------------------------------*/
    initBoard = (opts) => {
        // TODO - Refactor in terms on the opts structure
        let alreadyEnhanced = (this.board[0] !== null && typeof this.board[0] === "object");
        let nullCandidateList = [];
        this.boardNumbers = [];
        this.boardSize = (!this.board.length && opts?.boardSize) || Math.sqrt(this.board.length) || 9;
        if (this.boardSize % 1 !== 0 || Math.sqrt(this.boardSize) % 1 !== 0) {
            log("invalid boardSize: " + this.boardSize);
            if (typeof opts.boardErrorFn === "function")
                opts.boardErrorFn({ msg: "invalid board size" });
            return;
        }
        for (let i = 0; i < this.boardSize; i++) {
            this.boardNumbers.push(i + 1);
            nullCandidateList.push(null);
        }
        this.generateHouseIndexList();

        if (!alreadyEnhanced) {
            //enhance board to handle candidates, and possibly other params
            for (let j = 0; j < this.boardSize * this.boardSize; j++) {
                let cellVal = (typeof this.board[j] === "undefined") ? null : this.board[j];
                let candidates = cellVal === null ? this.boardNumbers.slice() : nullCandidateList.slice();
                this.board[j] = {
                    val: cellVal,
                    candidates: candidates
                    //title: "" possibl add in 'A1. B1...etc
                };
            }
        }
    };


    // generates board puzzle, i.e. the answers for this round
    // requires that a board for boardSize has already been initiated
    generateBoard = (diff, callback) => {

        // TODO - Reconsider this logic of setting difficulty
        if (Object.values(Sudoku.#DIFFICULTY).includes(diff)) {
            this.#difficulty = diff
        } else if (this.boardSize >= 9) {
            this.#difficulty = Sudoku.#DIFFICULTY.MEDIUM
        } else {
            this.#difficulty = Sudoku.#DIFFICULTY.EASY
        }
        this.#generatingMode = true;
        this.#solveMode = Sudoku.#SOLVE_MODE.SOLVE_MODE_ALL;

        // the board generated will possibly not be hard enough
        // (if you asked for "hard", you most likely get "medium")
        this.generateBoardAnswerRecursively(0);

        // attempt one - save the answer, and try digging multiple times.
        let boardAnswer = this.board.slice();

        let boardTooEasy = true;

        while (boardTooEasy) {
            this.digCells();
            let data = analyzeBoard();
            if (hardEnough(data))
                boardTooEasy = false;
            else
                this.board = boardAnswer;
        }
        this.#solveMode = Sudoku.#SOLVE_MODE.SOLVE_MODE_STEP;
        
        visualEliminationOfCandidates();

        if (typeof callback === 'function') {
            callback();
        }
    };

    constructor() {
        // TODO - implementation
    }

}


module.exports = Sudoku;