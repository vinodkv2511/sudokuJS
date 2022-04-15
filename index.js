const Sudoku = require('./sudokuLib');


let sudoku = new Sudoku();

sudoku.initBoard();
sudoku.generateBoard();

console.log('BOARD --------------', sudoku.board);
console.log('BOARD SIZE --------------', sudoku.boardSize);
console.log('BOARD NUMBERS --------------', sudoku.boardNumbers);
console.log('BOARD HOUSES --------------', sudoku.houses);