const Clutter = imports.gi.Clutter;

// Creates scaled clones of metaWindow and its transients,
// keeping their relative size to each other.
// When scaled, all clones are made to fit in width and height
// if neither width nor height is given, windows are not scaled
function createWindowClone(metaWindow, width, height, withTransients, withPositions) {
  let clones = [];
  let textures = [];
  
  if (!metaWindow) {
    return clones;
  }
  
  let metaWindowActor = metaWindow.get_compositor_private();
  if (!metaWindowActor) {
    return clones;
  }
  let texture = metaWindowActor.get_texture();
  let [windowWidth, windowHeight] = metaWindowActor.get_size();
  let [maxWidth, maxHeight] = [windowWidth, windowHeight];
  let [x, y] = metaWindowActor.get_position();
  let [minX, minY] = [x, y];
  let [maxX, maxY] = [minX + windowWidth, minY + windowHeight];
  textures.push({t: texture, x: x, y: y, w: windowWidth, h: windowHeight});
  if (withTransients) {
    metaWindow.foreach_transient(function(win) {
      let metaWindowActor = win.get_compositor_private();
      texture = metaWindowActor.get_texture();
      [windowWidth, windowHeight] = metaWindowActor.get_size();
      [x, y] = metaWindowActor.get_position();
      maxWidth = Math.max(maxWidth, windowWidth);
      maxHeight = Math.max(maxHeight, windowHeight);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + windowWidth);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + windowHeight);
      textures.push({t: texture, x: x, y: y, w: windowWidth, h: windowHeight});
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
  
  for (let i = 0; i < textures.length; i++) {
    let data = textures[i];
    let [texture, texWidth, texHeight, x, y] = [data.t, data.w, data.h, data.x, data.y];
    if (withPositions) {
      x -= minX;
      y -= minY;
    }
    let params = {};
    params.source = texture;
    if (scale != 1) {
      params.width = Math.round(texWidth * scale);
      params.height = Math.round(texHeight * scale);
      x = Math.round(x * scale);
      y = Math.round(y * scale);
    }
    let clone = {actor: new Clutter.Clone(params), x: x, y: y};
    clones.push(clone);
  }
  return clones;
}
