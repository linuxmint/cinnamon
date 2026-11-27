const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const noop = () => {};
const context = {
    imports: {gi: {Clutter: {}, Meta: {}, St: {TextDirection: {RTL: 1}}, Gio: {}},
        ui: {main: {}, dnd: {_Draggable: class {}, DragMotionResult: {NO_DROP: 0, MOVE_DROP: 2}},
            popupMenu: {PopupMenu: class {}, PopupMenuManager: class {}},
            applet: {AppletPopupMenu: class {}}, extension: {getCurrentExtension: () => ({imports: {constants: {}}})}},
        misc: {signalManager: {}, windowUtils: {}, util: {}}, mainloop: {}},
    global: {ui_scale: 1}, setTimeout: noop
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../../files/usr/share/cinnamon/applets/grouped-window-list@cinnamon.org/menus.js'), 'utf8'), context);
const Menu = context.AppThumbnailHoverMenu;
function fixture(vertical = true, rtl = false) {
    const m = Object.create(Menu.prototype);
    m.box = {vertical, width: vertical ? 100 : 300, height: vertical ? 300 : 100,
        get_text_direction: () => rtl ? 1 : 0, set_child_at_index: noop};
    m.appThumbnails = ['A', 'B', 'C'].map((name, i) => ({metaWindow: name,
        actor: {x: vertical ? 0 : (rtl ? 2-i : i)*100, y: vertical ? i*100 : 0, width: 100, height: 100},
        refreshThumbnail: noop}));
    m.thumbnailBox = m.box;
    m.scrollOffset = 0;
    m.scrollView = {
        width: m.box.width, height: m.box.height,
        get_transformed_position: () => [100, 200],
        get_transformed_size: () => [m.scrollView.width, m.scrollView.height],
        transform_stage_point: (x, y) => [true, x - 100, y - 200]
    };
    for (const thumbnail of m.appThumbnails) {
        const actor = thumbnail.actor;
        actor.get_transformed_position = () => [
            100 + actor.x - (vertical ? 0 : m.scrollOffset),
            200 + actor.y - (vertical ? m.scrollOffset : 0)
        ];
        actor.get_transformed_size = () => [actor.width, actor.height];
    }
    m.groupState = {metaWindows: ['A','B','C','queued'], set(values) {Object.assign(this, values)}};
    m.draggedThumbnail = m.appThumbnails[0];
    return m;
}
function order(m) {return Array.from(m.appThumbnails, t => t.metaWindow).join('');}
let count = 0;
function test(name, fn) {fn(); console.log('PASS ' + name); count++;}
test('vertical first-to-last keeps queued windows and updates indices', () => {
    const m=fixture(); assert.equal(m.acceptDrop(m.draggedThumbnail, null, 50, 295), true);
    assert.equal(order(m), 'BCA'); assert.equal(Array.from(m.groupState.metaWindows).join(','), 'B,C,A,queued');
    assert.equal(m.groupState.manualWindowOrder,true);
    assert.deepEqual(m.appThumbnails.map(t=>t.index),[0,1,2]);
});
test('vertical last-to-first',()=>{const m=fixture();m.draggedThumbnail=m.appThumbnails[2];m.acceptDrop(m.draggedThumbnail,null,50,5);assert.equal(order(m),'CAB');});
test('horizontal first-to-middle',()=>{const m=fixture(false);m.acceptDrop(m.draggedThumbnail,null,180,50);assert.equal(order(m),'BAC');});
test('RTL rightmost-to-leftmost',()=>{const m=fixture(false,true);m.acceptDrop(m.draggedThumbnail,null,5,50);assert.equal(order(m),'BCA');});
test('RTL leftmost-to-rightmost',()=>{const m=fixture(false,true);m.draggedThumbnail=m.appThumbnails[2];m.acceptDrop(m.draggedThumbnail,null,295,50);assert.equal(order(m),'CAB');});
test('outside drops are rejected without changing order',()=>{for(const [x,y] of [[-1,10],[10,-1],[101,10],[10,301]]){const m=fixture();assert.equal(m.acceptDrop(m.draggedThumbnail,null,x,y),false);assert.equal(order(m),'ABC');}});
test('foreign windows and removed source are rejected',()=>{const m=fixture();assert.equal(m.acceptDrop({},null,50,50),false);const source=m.draggedThumbnail;m.appThumbnails.shift();assert.equal(m.acceptDrop(source,null,50,50),false);});
test('dropping either side of self is a no-op',()=>{for(const y of [5,95]){const m=fixture();assert.equal(m.acceptDrop(m.draggedThumbnail,null,50,y),true);assert.equal(order(m),'ABC');assert.equal(m.groupState.manualWindowOrder,undefined);}});
test('hover and cancellation do not mutate order',()=>{const m=fixture();m.getDropPosition(m.draggedThumbnail,50,295);assert.equal(order(m),'ABC');let destroyed=false;m.dropMarker={destroy(){destroyed=true;}};m.willUnmount=true;m.endThumbnailDrag();assert.equal(destroyed,true);assert.equal(m.draggedThumbnail,null);assert.equal(order(m),'ABC');});
console.log(`${count} tests passed`);
const Draggable = vm.runInContext('WindowThumbnailDraggable', context);
test('drag image stays inside parent bounds in all directions', () => {
    const d=Object.create(Draggable.prototype);
    d.menu={scrollView:{get_transformed_position:()=>[100,200],get_transformed_size:()=>[300,400]}};
    let position;
    d._dragActor={get_transformed_size:()=>[80,60],set_position:(x,y)=>position=[x,y]};
    d._dragOffsetX=-10; d._dragOffsetY=-20;
    for (const [x,y,expected] of [[0,0,[100,200]],[1000,1000,[320,540]],[200,300,[190,280]]]) {
        d._dragX=x;d._dragY=y;d._setDragActorPosition();assert.deepEqual(position,expected);
    }
});

test('scrolled vertical list uses visible coordinates', () => {
    const m = fixture();
    m.scrollOffset = 100;
    m.scrollView.height = 180;
    assert.equal(m.getDropPosition(m.draggedThumbnail, 50, 90), 2);
    assert.equal(m.acceptDrop(m.draggedThumbnail, null, 50, 90), true);
    assert.equal(order(m), 'BAC');
    assert.equal(m.getDropPosition(m.draggedThumbnail, 50, 181), null);
});
test('scrolled horizontal and RTL lists use visible coordinates', () => {
    const m = fixture(false);
    m.scrollOffset = 100;
    m.scrollView.width = 180;
    assert.equal(m.getDropPosition(m.draggedThumbnail, 90, 50), 2);
    const rtl = fixture(false, true);
    rtl.scrollOffset = 100;
    rtl.scrollView.width = 180;
    assert.equal(rtl.getDropPosition(rtl.draggedThumbnail, 90, 50), 1);
});
test('insertion marker stays within the scrolled viewport', () => {
    const m = fixture();
    m.scrollOffset = 125;
    m.scrollView.height = 130;
    let position, size;
    m.dropMarker = {set_position: (x, y) => position = [x, y],
        set_size: (x, y) => size = [x, y], show: noop};
    m.handleDragOver(m.draggedThumbnail, null, 50, 1);
    assert.deepEqual(position, [100, 200]);
    assert.deepEqual(size, [100, 2]);
    m.handleDragOver(m.draggedThumbnail, null, 50, 129);
    assert.deepEqual(position, [100, 328]);
});
console.log(`${count} preview ordering tests passed`);
