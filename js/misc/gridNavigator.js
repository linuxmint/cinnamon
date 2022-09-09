// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;

function nextIndex(itemCount, numCols, currentIndex, symbol) {
    let result = -1;
    if (itemCount > 3 // grid navigation is not suited for a low item count
        && (symbol === Clutter.KEY_Down || symbol === Clutter.KEY_Up))
    {
        let numRows = Math.ceil(itemCount/numCols);

        let curRow = Math.floor(currentIndex/numCols);
        let curCol = currentIndex % numCols;

        let numColsLastRow = itemCount % numCols || numCols;
        let lastRowColStart = Math.floor((numCols - numColsLastRow) / 2);

        if (symbol === Clutter.KEY_Down) {
            if (curRow < numRows - 2) {
                return (curRow + 1) * numCols + curCol;
            }

            if (curRow === numRows - 1) {
                let actualCurCol = curCol + lastRowColStart;
                return (actualCurCol < numCols - 1) ? actualCurCol + 1 : 0;
            }

            if (curCol >= lastRowColStart && curCol < lastRowColStart + numColsLastRow) {
                return (curRow + 1) * numCols + curCol - lastRowColStart;
            }

            return (curCol < numCols - 1) ? curCol + 1 : 0;
        }
        else {
            if (numRows === 1) {
                return (curCol > 0) ? curCol - 1 : itemCount - 1;
            }

            if (curRow > 0 && curRow < numRows - 1) {
                return (curRow - 1) * numCols + curCol;
            }

            if (curRow === numRows - 1) {
                return (curRow - 1) * numCols + curCol + lastRowColStart;
            }

            if (curCol === 0) {
                return (numColsLastRow === numCols) ? itemCount - 1 : (numRows - 1) * numCols - 1;
            }

            if (curCol >= lastRowColStart + 1 && curCol < lastRowColStart + numColsLastRow + 1) {
                return (numRows - 1) * numCols + curCol - 1 - lastRowColStart;
            }

            return (numRows - 2) * numCols + curCol - 1;
        }
    }
    else if (symbol === Clutter.KEY_Left || symbol === Clutter.KEY_Down) {
        result = (currentIndex < 1 ? itemCount : currentIndex) - 1;
    }
    else if (symbol === Clutter.KEY_Right || symbol === Clutter.KEY_Up) {
        result = (currentIndex + 1) % itemCount;
    }
    else if (symbol === Clutter.KEY_Home) {
        result = 0;
    }
    else if (symbol === Clutter.KEY_End) {
        result = itemCount - 1;
    }
    return result;
}
