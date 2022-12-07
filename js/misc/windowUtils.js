const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;

// Creates scaled clones of metaWindow and its transients,
// keeping their relative size to each other.
// When scaled, all clones are made to fit in width and height
// if neither width nor height is given, windows are not scaled

function createWindowClone(metaWindow, width, height, withTransients, withPositions) {
  let cloneData = [];

  if (!metaWindow) {
    return [];
  }

  let metaWindowActor = metaWindow.get_compositor_private();
  if (!metaWindowActor) {
    return [];
  }

  let clone = getCloneOrContent(metaWindowActor)
  let [windowWidth, windowHeight] = metaWindowActor.get_size();
  let [maxWidth, maxHeight] = [windowWidth, windowHeight];
  let {x, y} = metaWindow.get_buffer_rect();
  let [minX, minY] = [x, y];
  let [maxX, maxY] = [minX + windowWidth, minY + windowHeight];
  cloneData.push({c: clone, x: x, y: y, w: windowWidth, h: windowHeight});
  
  if (withTransients) {
    metaWindow.foreach_transient(function(win) {
      let metaWindowActor = win.get_compositor_private();

      let clone = getCloneOrContent(metaWindowActor);
      clone.offscreen_redirect = Clutter.OffscreenRedirect.ALWAYS;

      [windowWidth, windowHeight] = metaWindowActor.get_size();
      let { x, y } = win.get_buffer_rect();
      maxWidth = Math.max(maxWidth, windowWidth);
      maxHeight = Math.max(maxHeight, windowHeight);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + windowWidth);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + windowHeight);
      cloneData.push({c: clone, x: x, y: y, w: windowWidth, h: windowHeight});
    });
  }

  let scale = 1;
  let scaleWidth = 1;
  let scaleHeight = 1;

  if (width) {
    scaleWidth = Math.min(width/(maxX - minX), 1);
  }
  if (height) {
    scaleHeight = Math.min(height/(maxY - minY), 1);
  }
  if (width || height) {
    scale = Math.min(scaleWidth, scaleHeight);
  }

  let clones = [];

  for (let i = 0; i < cloneData.length; i++) {
    let data = cloneData[i];
    let [clone, cloneWidth, cloneHeight, x, y] = [data.c, data.w, data.h, data.x, data.y];
    if (withPositions) {
      x -= minX;
      y -= minY;
    }

    let width = Math.round(cloneWidth * scale);
    let height = Math.round(cloneHeight * scale);

    clone.width = width;
    clone.height = height;

    x = Math.round(x * scale);
    y = Math.round(y * scale);

    clones.push({ actor: clone, x: x, y: y });
  }

  return clones;
}

// Initially minimized windows (either after a restart, or apps that 'start minimized') won't be valid
// clone sources until they've been shown at least once. Displaying their 'content' (MetaShapedTexture)
// is also choppy and bad. Until they've been seen, return static images of the window content as placeholders.

function getCloneOrContent(windowActor, width = -1, height = -1) {
    var clone = null;
    if (Main.wm.windowSeen(windowActor.meta_window)) {
        clone = new Clutter.Clone({
            name: `RealWindowClone ${windowActor.toString()}`,
            source: windowActor,
            width: width,
            height: height
        });
    }
    else {
        const meta_window = windowActor.meta_window;

        if (meta_window === null) {
            return null;
        }

        clone = new Clutter.Actor({
            name: `TextureWindowClone ${windowActor.toString()}`,
            content: windowActor.get_texture(),
            width: width,
            height: height
        });
    }

    return clone;
}
