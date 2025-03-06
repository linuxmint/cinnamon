const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Main = imports.ui.main;
const ByteArray = imports.byteArray;
const {addTween} = imports.ui.tweener;

const wordWrap = text => text.match( /.{1,80}(\s|$|-|=|\+|_|&|\\)|\S+?(\s|$|-|=|\+|_|&|\\)/g ).join('\n');

const graphemeBaseChars = s =>
//decompose and remove discritics (blocks: Combining Diacritical Marks,
//Combining Diacritical Marks Extended and Combining Diacritical Marks Supplement)
            s.normalize('NFKD').replace(/[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF]/g, "");

function escapeRegExp(str) {
    // from: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
    return str.replace(/[-\/.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

//===========================================================

const getThumbnail_gicon = (uri, mimeType) => {
    //Note: this function doesn't check if thumbnail is up to date.
    const file = Gio.File.new_for_uri(uri);
    if (!file.query_exists(null)) {//check because it's possible for isFavoriteFile's to not exist.
        return null;
    }
    //
    const isImage = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/tiff', 'image/bmp',
                                                                'image/gif'].includes(mimeType);
    const fileSize = file.query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null).get_size();

    //----Get thumbnail from cache
    if (!(isImage && fileSize < 50000)) {//Don't bother with thumbnail cache if file is a
                            //small image, quicker to just create icon from file itself and avoids
                            //possible out of date cached thumbnail.
        const ba = ByteArray.fromString(uri, 'UTF-8');
        const md5 = GLib.Checksum.new(GLib.ChecksumType.MD5);
        md5.update(ba);
        const thumbDir = GLib.get_user_cache_dir() + '/thumbnails/';
        const thumbName = md5.get_string() + '.png';
        const thumbPathNormal = thumbDir + 'normal/' + thumbName;
        const thumbPathLarge = thumbDir + 'large/' + thumbName;
        if (GLib.file_test(thumbPathNormal, GLib.FileTest.EXISTS)) {
            return new Gio.FileIcon({ file: Gio.file_new_for_path(thumbPathNormal) });
        }
        if (GLib.file_test(thumbPathLarge, GLib.FileTest.EXISTS)) {
            return new Gio.FileIcon({ file: Gio.file_new_for_path(thumbPathLarge) });
        }
    }

    //----No cached thumbnail available so make icon from image.
    if (isImage && fileSize < 30000000) {//don't read image files > 30MB
        return new Gio.FileIcon({ file: file });
    }

    //----No thumbnail
    return null;
};

//============================================================

let onlyOneTooltip = null;
const showTooltip = (actor, xpos, ypos, center_on_xpos, text) => {
    if (onlyOneTooltip) {
        global.logWarning("gridmenu: Previous tooltip still exists...removing...");
        onlyOneTooltip.destroy();
        onlyOneTooltip = null;
    }
    onlyOneTooltip = new NewTooltip (actor, xpos, ypos, center_on_xpos, text);
};

const hideTooltipIfVisible = () => {
    if (onlyOneTooltip) {
        onlyOneTooltip.destroy();
        onlyOneTooltip = null;
    }
};

class NewTooltip {
    constructor(actor, xpos, ypos, center_on_xpos /*boolean*/, text) {
        this.actor = actor;
        this.xpos = xpos;
        this.ypos = ypos;
        this.center_on_xpos = center_on_xpos;
        this.text = text;
        if (this.text && this.text !== '') {
            this.showTimer = Mainloop.timeout_add(250, () => this.show());
        }
    }

    show() {
        this.showTimer = null;

        this.tooltip = new St.Label({
            name: 'Tooltip'
        });
        this.tooltip.show_on_set_parent = true;
        Main.uiGroup.add_actor(this.tooltip);
        this.tooltip.get_clutter_text().set_markup(this.text);
        this.tooltip.set_style('text-align: left;');

        let tooltipWidth = this.tooltip.get_allocation_box().x2 - this.tooltip.get_allocation_box().x1;
        let tooltipHeight = this.tooltip.get_allocation_box().y2 - this.tooltip.get_allocation_box().y1;
        let monitor = Main.layoutManager.findMonitorForActor(this.actor);
        let tooltipLeft = this.xpos;
        let tooltipTop = this.ypos;
        if (this.center_on_xpos) {
            tooltipLeft -= Math.floor(tooltipWidth / 3);
        }
        tooltipLeft = Math.max(tooltipLeft, monitor.x);
        tooltipLeft = Math.min(tooltipLeft, monitor.x + monitor.width - tooltipWidth);
        tooltipTop = Math.max(tooltipTop, monitor.y);
        tooltipTop = Math.min(tooltipTop, monitor.y + monitor.height - tooltipHeight);

        this.tooltip.set_position(tooltipLeft, tooltipTop);
        this.tooltip.raise_top();
        this.tooltip.show();
    }

    destroy() {
        if (this.showTimer) {
            Mainloop.source_remove(this.showTimer);
            this.showTimer = null;
        }
        if (this.tooltip) {
            this.tooltip.destroy();
            this.tooltip = null;
        }
    }
}

//===================================================
const searchStrPart = (q, str, noFuzzySearch, noSubStringSearch) => {
    if (!str || !q) {
        return 0; //match score = 0
    }

    const str2 = graphemeBaseChars(str).toLocaleUpperCase();
    //q is already graphemeBaseChars().toLocaleUpperCase() in _doSearch()
    let score = 0, bigrams_score = 0;

    if (new RegExp('\\b'+escapeRegExp(q)).test(str2)) { //match substring from beginning of words
        const foundPosition = str2.indexOf(q);
        score = (foundPosition === 0) ? 1.21 : 1.2;//slightly higher score if from beginning
    } else if (!noSubStringSearch && str2.indexOf(q) !== -1) { //else match substring
        score = 1.1;
    } else if (!noFuzzySearch){ //else fuzzy match
        //find longest substring of str2 made up of letters from q
        const found = str2.match(new RegExp('[' + escapeRegExp(q) + ']+','g'));
        let length = 0;
        let longest;
        if (found) {
            for(let i=0; i < found.length; i++){
                if(found[i].length > length){
                    length = found[i].length;
                    longest = found[i];
                }
            }
        }
        if (longest) {
            //get a score for similarity by counting 2 letter pairs (bigrams) that match
            if (q.length >= 2) {
                const max_bigrams = q.length -1;
                let found_bigrams = 0;
                for (let qi = 0; qi < max_bigrams; qi++ ) {
                    if (longest.indexOf(q[qi] + q[qi + 1]) >= 0) {
                        found_bigrams++;
                    }
                }
                bigrams_score = Math.min(found_bigrams / max_bigrams, 1);
            } else {
                bigrams_score = 1;
            }

            //return a fuzzy match score of between 0 and 1.
            score = Math.min(longest.length / q.length, 1.0) * bigrams_score;
        }
    }
        
    return score;
};

const searchStr = (q, str, noFuzzySearch = false, noSubStringSearch = false) => {
    const separatorIndex = q.indexOf(" ");
    if (separatorIndex < 1) {
        return searchStrPart(q, str, noFuzzySearch, noSubStringSearch);
    }

    //There are two search terms separated by a space.
    const part1Score = searchStrPart(q.slice(0, separatorIndex), str, noFuzzySearch, noSubStringSearch);
    const part2Score = searchStrPart(q.slice(separatorIndex + 1), str, noFuzzySearch, noSubStringSearch);
    const avgScore = (part1Score + part2Score) / 2.0;
    
    return avgScore;
};

var scrollToButton = (button, enableAnimation) => {
    let scrollBox = button.actor.get_parent();
    let i = 0;
    while (!(scrollBox instanceof St.ScrollView)) {
        i++;
        if (i > 10 || !scrollBox) {
            global.logWarning('gridmenu: Unable to find scrollbox for' + button.actor.toString());
            return false;
        }
        scrollBox = scrollBox.get_parent();
    }

    const adjustment = scrollBox.vscroll.adjustment;
    let [value, lower, upper, stepIncrement, pageIncrement, pageSize] = adjustment.get_values();

    let offset = 0;
    const vfade = scrollBox.get_effect('fade');//this always seems to return null?
    if (vfade) {
        offset = vfade.vfade_offset;
    }

    const box = button.actor.get_allocation_box();
    const y1 = box.y1, y2 = box.y2;
    const PADDING_ALLOWANCE = 20; //In case button parent(s) have padding meaning y1 won't go to 0
    if (y1 < value + offset) {
        if (y1 < PADDING_ALLOWANCE) {
            value = 0;
        } else {
            value = Math.max(0, y1 - offset);
        }
    } else if (y2 > value + pageSize - offset) {
        if (y2 > upper - offset - PADDING_ALLOWANCE) {
            value = upper - pageSize;
        } else {
            value = Math.min(upper, y2 + offset - pageSize);
        }
    } else {
        return false;
    }

    if (enableAnimation) {
        addTween(adjustment, {value: value, time: 0.1, transition: 'easeOutQuad'});
    } else {
        adjustment.set_value(value);
    }
}

module.exports = {
    wordWrap,
    graphemeBaseChars,
    getThumbnail_gicon,
    showTooltip,
    hideTooltipIfVisible,
    searchStr,
    scrollToButton
};
