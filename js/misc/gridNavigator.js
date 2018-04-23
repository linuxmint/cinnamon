// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;

function nextIndex(itemCount, numCols, currentIndex, symbol) {
    let result = -1;
    if (itemCount > 3 // grid navigation is not suited for a low item count
        && (symbol === Clutter.Down || symbol === Clutter.Up))
    {
        let numRows = Math.ceil(itemCount/numCols);

        let curRow = Math.floor(currentIndex/numCols);
        let curCol = currentIndex % numCols;

        const rowDelta = symbol === Clutter.Down ? 1 : -1;
        let newIndex = (curRow + rowDelta) * numCols + curCol;
        if (rowDelta >= 0) { // down
            if (newIndex < itemCount) {
                return newIndex;
            }

            if (curCol < numCols - 1) {
                // wrap to top row, one column to the right:
                return curCol + 1;
            }

            // wrap to top row, left-most column:
            return 0;
        }
        else { // up
            let numFullRows = Math.floor(itemCount/numCols);
            let numIOILR = itemCount % numCols; //num Items on Incompl. Last Row
            if (newIndex >= 0) {
                return newIndex;
            }

            if (curCol === 0) {
                // Wrap to the bottom of the right-most column, may not be on last row:
                return (numFullRows * numCols) - 1;
            }

            /* If we're on the 
            top row but not in the first column, we want to move to the bottom of the
            column to the left, even though that may not be the bottom of the grid.
            */
            if (numIOILR && curCol > numIOILR) {
                return ((numFullRows - 1) * numCols) + curCol - 1;
            }

            return ((numRows - 1) * numCols) + curCol - 1;
        }
    }
    else if (symbol === Clutter.Left || symbol === Clutter.Up) {
        result = (currentIndex < 1 ? itemCount : currentIndex) - 1;
    }
    else if (symbol === Clutter.Right || symbol === Clutter.Down) {
        result = (currentIndex + 1) % itemCount;
    }
    else if (symbol === Clutter.Home) {
        result = 0;
    }
    else if (symbol === Clutter.End) {
        result = itemCount - 1;
    }
    return result;
}
